import { useAuthStore } from '@/store/auth';
import { useWsStore } from '@/store/ws';

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8001/ws';

export class WsClient {
  private ws: WebSocket | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private pingInterval: NodeJS.Timeout | null = null;
  private listeners: Record<string, ((data: unknown) => void)[]> = {};
  private reconnectAttempts = 0;
  private messageQueue: unknown[] = [];

  connect() {
    if (this.ws) return;
    const token = useAuthStore.getState().token;
    if (!token) return;

    useWsStore.getState().setStatus('connecting');
    this.ws = new WebSocket(`${WS_URL}?token=${token}`);

    this.ws.onopen = () => {
      this.reconnectAttempts = 0;
      useWsStore.getState().setStatus('open');
      this.startPing();
      this.flushQueue();
    };

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type) {
          this.emit(data.type, data);
        }
      } catch (e) {
        console.error('WS Parse Error:', e);
      }
    };

    this.ws.onclose = () => {
      this.ws = null;
      useWsStore.getState().setStatus('closed');
      this.stopPing();
      this.scheduleReconnect();
    };
  }

  disconnect() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.stopPing();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    useWsStore.getState().setStatus('closed');
  }

  send(payload: unknown) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(payload));
    } else {
      this.messageQueue.push(payload);
    }
  }

  private flushQueue() {
    while (this.messageQueue.length > 0 && this.ws?.readyState === WebSocket.OPEN) {
      const payload = this.messageQueue.shift();
      this.ws.send(JSON.stringify(payload));
    }
  }

  on(type: string, callback: (data: unknown) => void) {
    if (!this.listeners[type]) this.listeners[type] = [];
    this.listeners[type].push(callback);
    return () => this.off(type, callback);
  }

  off(type: string, callback: (data: unknown) => void) {
    if (this.listeners[type]) {
      this.listeners[type] = this.listeners[type].filter((cb) => cb !== callback);
    }
  }

  private emit(type: string, data: unknown) {
    if (this.listeners[type]) {
      this.listeners[type].forEach((cb) => cb(data));
    }
  }

  private startPing() {
    this.pingInterval = setInterval(() => {
      this.send({ type: 'ping' });
    }, 25000);
  }

  private stopPing() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  private scheduleReconnect() {
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 15000);
    this.reconnectAttempts++;
    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, delay);
  }
}

export const wsClient = new WsClient();
