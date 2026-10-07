import { useState, useEffect } from 'react';
import { Modal } from '@/components/ui/Modal';
import { fetchApi } from '@/lib/api';
import { Shield } from 'lucide-react';
import { useToast } from '@/components/ui/Toast';

interface SafetyNumberModalProps {
  isOpen: boolean;
  onClose: () => void;
  conversationId: number;
}

export const SafetyNumberModal = ({ isOpen, onClose, conversationId }: SafetyNumberModalProps) => {
  const [safetyNumber, setSafetyNumber] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const toast = useToast();

  useEffect(() => {
    if (isOpen && conversationId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLoading(true);
      fetchApi<{safety_number: string}>(`/conversations/${conversationId}/safety-number`)
        .then(res => setSafetyNumber(res.safety_number))
        .catch(() => toast('Failed to load safety number', 'error'))
        .finally(() => setLoading(false));
    }
  }, [isOpen, conversationId, toast]);

  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Verify Safety Number">
      <div className="flex flex-col items-center gap-4 text-theme-text p-4">
        <div className="w-16 h-16 rounded-full bg-theme-border flex items-center justify-center">
          <Shield className="w-8 h-8 text-theme-primary" />
        </div>
        <p className="text-center text-sm text-theme-text-secondary">
          To verify that your messages and calls with this contact are end-to-end encrypted, compare these numbers with them.
        </p>
        
        {loading ? (
          <div className="animate-pulse flex space-x-4 w-full justify-center">
             <div className="h-6 w-48 bg-theme-border/50 rounded"></div>
          </div>
        ) : (
          <div className="grid grid-cols-4 gap-4 mt-2 mb-4">
            {safetyNumber?.match(/.{1,5}/g)?.map((chunk, i) => (
              <span key={i} className="font-mono text-lg font-medium tracking-wider">{chunk}</span>
            ))}
          </div>
        )}

        <button 
          onClick={onClose}
          className="w-full bg-theme-primary text-white py-2 rounded-[8px] font-medium hover:bg-theme-primary-hover transition-colors"
        >
          Close
        </button>
      </div>
    </Modal>
  );
};
