import { memo, useRef, useEffect } from 'react';

const COMMON_EMOJIS = [
  '😀','😂','🤣','😊','😍','🥰','😘','😜','🤪','😎',
  '😭','😢','🥺','😡','🤬','🤯','😳','🥶','😱','👍',
  '👎','👏','🙌','👐','🤝','✌️','🤞','🤙','🤘','🤌',
  '❤️','🔥','✨','🎉','💯','✅','❌','❓','❕','💀'
];

interface EmojiPickerProps {
  onSelect: (emoji: string) => void;
  onClose: () => void;
}

export const EmojiPicker = memo(({ onSelect, onClose }: EmojiPickerProps) => {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  return (
    <div 
      ref={ref}
      className="absolute bottom-full left-0 mb-2 w-64 bg-theme-app border border-theme-divider rounded-[12px] shadow-lg p-2 z-50 grid grid-cols-8 gap-1"
    >
      {COMMON_EMOJIS.map(emoji => (
        <button
          key={emoji}
          onClick={() => {
            onSelect(emoji);
            onClose();
          }}
          className="text-xl w-7 h-7 flex items-center justify-center hover:bg-theme-border/50 rounded transition-colors"
        >
          {emoji}
        </button>
      ))}
    </div>
  );
});
EmojiPicker.displayName = 'EmojiPicker';
