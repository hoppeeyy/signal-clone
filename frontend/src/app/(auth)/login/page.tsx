'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth';
import { fetchApi } from '@/lib/api';
import { useToast } from '@/components/ui/Toast';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { MessageCircle } from 'lucide-react';

export default function LoginPage() {
  const [identifier, setIdentifier] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const toast = useToast();
  const setPendingIdentifier = useAuthStore((s) => s.setPendingIdentifier);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier.trim()) return;

    setLoading(true);
    try {
      await fetchApi('/auth/request-otp', {
        method: 'POST',
        body: JSON.stringify({ identifier }),
      });
      setPendingIdentifier(identifier);
      router.push('/verify');
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : 'Failed to request OTP', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-theme-app p-4">
      <div className="w-full max-w-sm bg-theme-app rounded-2xl shadow-sm border border-theme-divider p-8 animate-in fade-in zoom-in-95 duration-200">
        <div className="flex flex-col items-center text-center mb-8">
          <div className="w-16 h-16 rounded-full bg-theme-primary flex items-center justify-center mb-6">
            <MessageCircle className="w-8 h-8 text-white fill-current" />
          </div>
          <h1 className="text-2xl font-bold text-theme-text mb-2">Welcome to Signal Clone</h1>
          <p className="text-sm text-theme-text-secondary">Enter your phone number or username to get started.</p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
          <Input
            autoFocus
            label="Phone Number or Username"
            placeholder="e.g. +1234567890"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
          />
          <Button type="submit" isLoading={loading} className="w-full h-12 text-base">
            Continue
          </Button>
        </form>
      </div>
    </div>
  );
}
