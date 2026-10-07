'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth';
import { fetchApi } from '@/lib/api';
import { useToast } from '@/components/ui/Toast';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Avatar } from '@/components/ui/Avatar';
import { Camera } from 'lucide-react';
import { User } from '@/lib/types';

export default function OnboardingPage() {
  const { user, updateUser } = useAuthStore();
  const router = useRouter();
  const toast = useToast();
  
  const [displayName, setDisplayName] = useState(user?.display_name || '');
  const [about, setAbout] = useState(user?.about || '');
  const [loading, setLoading] = useState(false);
  
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(user?.avatar_url || null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast('Please select an image file', 'error');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      toast('Image must be less than 2MB', 'error');
      return;
    }

    setAvatarFile(file);
    const objectUrl = URL.createObjectURL(file);
    setAvatarPreview(objectUrl);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName.trim()) return;

    setLoading(true);
    try {
      // 1. Update Profile
      const updatedUser = await fetchApi<User>('/users/me', {
        method: 'PUT',
        body: JSON.stringify({ display_name: displayName, about }),
      });

      // 2. Upload Avatar if selected
      if (avatarFile) {
        const formData = new FormData();
        formData.append('file', avatarFile);
        
        const avatarRes = await fetchApi<{ avatar_url: string }>('/users/me/avatar', {
          method: 'POST',
          body: formData,
        });
        updatedUser.avatar_url = avatarRes.avatar_url;
      }

      updateUser(updatedUser);
      toast('Profile setup complete', 'success');
      router.push('/');
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : 'Failed to update profile', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-theme-app p-4">
      <div className="w-full max-w-sm bg-theme-app rounded-2xl shadow-sm border border-theme-divider p-8 animate-in fade-in zoom-in-95 duration-200">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-theme-text mb-2">Set up your profile</h1>
          <p className="text-sm text-theme-text-secondary">Your profile and changes to it will be visible to people you message.</p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
          <div className="flex justify-center mb-2">
            <div className="relative cursor-pointer group" onClick={() => fileInputRef.current?.click()}>
              <Avatar 
                size="xl" 
                src={avatarPreview} 
                initials={displayName || '?'} 
                className="w-24 h-24 text-3xl group-hover:opacity-80 transition-opacity"
              />
              <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
                <Camera className="w-8 h-8 text-white" />
              </div>
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileSelect} 
                accept="image/*" 
                className="hidden"
              />
            </div>
          </div>

          <Input
            label="Display Name (required)"
            placeholder="What should people call you?"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            required
          />
          
          <Input
            label="About (optional)"
            placeholder="Write a few words about yourself..."
            value={about}
            onChange={(e) => setAbout(e.target.value)}
          />

          <Button type="submit" isLoading={loading} disabled={!displayName.trim()} className="w-full h-12 text-base mt-2">
            Finish
          </Button>
        </form>
      </div>
    </div>
  );
}
