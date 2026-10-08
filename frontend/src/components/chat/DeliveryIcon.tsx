import { memo, useId } from 'react';

interface DeliveryIconProps {
  status: 'sending' | 'sent' | 'delivered' | 'read' | 'failed';
}

export const DeliveryIcon = memo(({ status }: DeliveryIconProps) => {
  const maskId = useId();

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
        <path d="M3 7.5L6 10.5L11 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }

  if (status === 'delivered') {
    return (
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="opacity-70">
        <path d="M1 7.5L3.5 10L7.5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M6 7.5L8.5 10L12.5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }

  if (status === 'read') {
    return (
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="opacity-100">
        <defs>
          <mask id={maskId}>
            <rect width="14" height="14" fill="white" />
            <path d="M1 7.5L3.5 10L7.5 5" stroke="black" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M6 7.5L8.5 10L12.5 5" stroke="black" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </mask>
        </defs>
        <circle cx="4.5" cy="7.5" r="4.5" fill="currentColor" mask={`url(#${maskId})`} />
        <circle cx="9.5" cy="7.5" r="4.5" fill="currentColor" mask={`url(#${maskId})`} />
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
