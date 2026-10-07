'use client';
import { Sidebar } from '@/components/Sidebar';
import { useRealtime } from '@/hooks/useRealtime';



export default function AppLayout({ children }: { children: React.ReactNode }) {
  useRealtime();
  
  return (
    <div className="flex h-screen w-full overflow-hidden bg-theme-app relative">
      <Sidebar />
      {children}
    </div>
  );
}
