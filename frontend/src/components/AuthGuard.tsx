'use client';
import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuthStore } from '@/store/auth';

export const AuthGuard = ({ children }: { children: React.ReactNode }) => {
  const { token, user, _hasHydrated } = useAuthStore();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // Fire and forget health check to wake up the server (e.g. Render free tier)
    const healthUrl = (process.env.NEXT_PUBLIC_API_URL as string).replace(/\/api$/, '') + '/health';
    fetch(healthUrl).catch(() => {});
  }, []);

  useEffect(() => {
    if (!_hasHydrated) return;

    const isAuthRoute = pathname.startsWith('/login') || pathname.startsWith('/verify');

    if (!token) {
      if (!isAuthRoute) {
        router.replace('/login');
      }
    } else {
      if (isAuthRoute) {
        router.replace('/');
      } else if (!user?.display_name && pathname !== '/onboarding') {
        router.replace('/onboarding');
      }
    }
  }, [token, user, _hasHydrated, pathname, router]);

  if (!_hasHydrated) {
    return <div style={{ display: 'none' }}>{children}</div>;
  }

  // Prevent flash of protected content
  const isAuthRoute = pathname.startsWith('/login') || pathname.startsWith('/verify');
  if (!token && !isAuthRoute) {
    return <div style={{ display: 'none' }}>{children}</div>;
  }
  if (token && isAuthRoute) {
    return <div style={{ display: 'none' }}>{children}</div>;
  }

  return <>{children}</>;
};
