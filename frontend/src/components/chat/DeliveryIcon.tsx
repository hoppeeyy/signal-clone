import { memo } from 'react';

interface DeliveryIconProps {
  status: 'sending' | 'sent' | 'delivered' | 'read' | 'failed';
}

export const DeliveryIcon = memo(({ status }: DeliveryIconProps) => {
  if (status === 'sending') {
    return (
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="animate-spin opacity-70">
        <circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="1.2" strokeDasharray="3 3" />
      </svg>
    );
  }

  if (status === 'sent') {
    return (
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="opacity-70">
        <circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="1.2" />
        <path d="M4 7.5L6 9.5L10 4.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }

  if (status === 'delivered') {
    return (
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="opacity-70">
        <circle cx="5" cy="7" r="4.5" stroke="currentColor" strokeWidth="1" />
        <circle cx="9" cy="7" r="4.5" stroke="currentColor" strokeWidth="1" />
        <path d="M3 7.5L4.5 9L7.5 5" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M7 7.5L8.5 9L11.5 5" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }

  if (status === 'read') {
    return (
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="opacity-90">
        <circle cx="5" cy="7" r="4.5" fill="currentColor" />
        <circle cx="9" cy="7" r="4.5" fill="currentColor" />
        <path d="M3 7.5L4.5 9L7.5 5" stroke="white" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M7 7.5L8.5 9L11.5 5" stroke="white" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }

  if (status === 'failed') {
    return (
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="text-red-500">
        <circle cx="7" cy="7" r="6" fill="currentColor" />
        <path d="M7 4V8M7 10H7.01" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }

  return null;
});
DeliveryIcon.displayName = 'DeliveryIcon';
