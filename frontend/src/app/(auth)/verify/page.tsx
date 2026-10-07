'use client';

import { useState, useRef, useEffect, KeyboardEvent, ClipboardEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth';
import { fetchApi } from '@/lib/api';
import { useToast } from '@/components/ui/Toast';
import { Button } from '@/components/ui/Button';
import { AuthResponse } from '@/lib/types';
import { cn } from '@/components/ui/Button';

export default function VerifyPage() {
  const pendingIdentifier = useAuthStore((s) => s.pendingIdentifier);
  const setAuth = useAuthStore((s) => s.setAuth);
  
  const [code, setCode] = useState<string[]>(Array(6).fill(''));
  const [loading, setLoading] = useState(false);
  const [errorShake, setErrorShake] = useState(false);
  const [errorText, setErrorText] = useState('');
  const [countdown, setCountdown] = useState(30);
  
  const router = useRouter();
  const toast = useToast();
  const inputsRef = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (!pendingIdentifier) {
      router.replace('/login');
    }
  }, [pendingIdentifier, router]);

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(c => c - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  const triggerError = (msg: string) => {
    setErrorText(msg);
    setErrorShake(true);
    setTimeout(() => setErrorShake(false), 500);
    setCode(Array(6).fill(''));
    inputsRef.current[0]?.focus();
  };

  const handleVerify = async (fullCode: string) => {
    if (!pendingIdentifier) return;
    setLoading(true);
    setErrorText('');
    
    try {
      const res = await fetchApi<AuthResponse>('/auth/verify-otp', {
        method: 'POST',
        body: JSON.stringify({ identifier: pendingIdentifier, otp: fullCode }),
      });
      
      setAuth(res.access_token, res.user);
      toast('Verification successful', 'success');
      
      if (res.is_new_user || !res.user.display_name) {
        router.push('/onboarding');
      } else {
        router.push('/');
      }
    } catch (err: unknown) {
      triggerError(err instanceof Error ? err.message : 'Invalid code');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (index: number, val: string) => {
    const newVal = val.replace(/[^0-9]/g, '').slice(-1);
    const newCode = [...code];
    newCode[index] = newVal;
    setCode(newCode);

    if (newVal && index < 5) {
      inputsRef.current[index + 1]?.focus();
    }

    const completeCode = newCode.join('');
    if (completeCode.length === 6) {
      handleVerify(completeCode);
    }
  };

  const handleKeyDown = (index: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      inputsRef.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/[^0-9]/g, '').slice(0, 6);
    if (!pasted) return;
    
    const newCode = [...code];
    for (let i = 0; i < pasted.length; i++) {
      newCode[i] = pasted[i];
    }
    setCode(newCode);
    
    if (pasted.length === 6) {
      inputsRef.current[5]?.focus();
      handleVerify(newCode.join(''));
    } else {
      inputsRef.current[pasted.length]?.focus();
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-theme-app p-4">
      <div className={cn(
        "w-full max-w-sm bg-theme-app rounded-2xl shadow-sm border border-theme-divider p-8 transition-transform",
        errorShake && "animate-[shake_0.4s_ease-in-out]"
      )}>
        <style dangerouslySetInnerHTML={{__html: `
          @keyframes shake {
            0%, 100% { transform: translateX(0); }
            25% { transform: translateX(-5px); }
            50% { transform: translateX(5px); }
            75% { transform: translateX(-5px); }
          }
        `}} />
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-theme-text mb-2">Verify your number</h1>
          <p className="text-sm text-theme-text-secondary">We sent a code to {pendingIdentifier}</p>
        </div>

        <div className="flex justify-between mb-2">
          {code.map((digit, i) => (
            <input
              key={i}
              ref={el => { inputsRef.current[i] = el; }}
              type="text"
              inputMode="numeric"
              autoFocus={i === 0}
              value={digit}
              onChange={e => handleChange(i, e.target.value)}
              onKeyDown={e => handleKeyDown(i, e)}
              onPaste={handlePaste}
              disabled={loading}
              className={cn(
                "w-12 h-14 text-center text-2xl font-semibold rounded-[12px] border bg-theme-app focus-visible:outline-none focus-visible:border-theme-primary transition-colors",
                errorText ? "border-red-500" : "border-theme-divider"
              )}
            />
          ))}
        </div>
        
        <div className="h-6 flex items-center justify-center mb-6">
          {errorText ? (
            <span className="text-sm text-red-500 font-medium">{errorText}</span>
          ) : (
            <span className="text-sm text-theme-text-secondary">Demo OTP: 123456</span>
          )}
        </div>

        <div className="flex justify-center">
          <Button 
            variant="ghost" 
            disabled={countdown > 0 || loading}
            onClick={() => setCountdown(30)}
            className="text-theme-primary hover:text-theme-primary-hover"
          >
            {countdown > 0 ? `Resend code in ${countdown}s` : 'Resend code'}
          </Button>
        </div>
      </div>
    </div>
  );
}
