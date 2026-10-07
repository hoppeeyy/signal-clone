import React from 'react';
import { cn } from './Button';

interface AvatarProps {
  src?: string | null;
  initials?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  isOnline?: boolean;
  className?: string;
}

const sizeClasses = {
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-12 h-12 text-base',
  xl: 'w-16 h-16 text-lg',
};

const dotClasses = {
  sm: 'w-2 h-2 bottom-0 right-0',
  md: 'w-2.5 h-2.5 bottom-0 right-0',
  lg: 'w-3 h-3 bottom-0.5 right-0.5',
  xl: 'w-4 h-4 bottom-1 right-1',
};

export const Avatar: React.FC<AvatarProps> = ({ src, initials, size = 'md', isOnline, className }) => {
  return (
    <div className={cn('relative inline-block', className)}>
      <div
        className={cn(
          'rounded-full overflow-hidden flex items-center justify-center bg-theme-primary text-white font-medium',
          sizeClasses[size]
        )}
      >
        {src ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src.startsWith('/') ? `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8001'}${src}` : src} alt="Avatar" className="w-full h-full object-cover" />
          </>
        ) : (
          <span>{initials?.substring(0, 2).toUpperCase() || '?'}</span>
        )}
      </div>
      {isOnline && (
        <span
          className={cn(
            'absolute rounded-full bg-theme-online border-2 border-theme-app',
            dotClasses[size]
          )}
        />
      )}
    </div>
  );
};
