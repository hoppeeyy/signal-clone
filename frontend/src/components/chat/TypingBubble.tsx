import React from 'react';

export function TypingBubble({ names }: { names: string[] }) {
  let text = '';
  if (names.length === 1) {
    text = `${names[0]} is typing...`;
  } else if (names.length === 2) {
    text = `${names[0]} and ${names[1]} are typing...`;
  } else if (names.length > 2) {
    text = `${names[0]} and ${names.length - 1} others are typing...`;
  }

  if (!text) return null;

  return (
    <div className="flex flex-col mb-4 items-start w-full transition-all duration-300">
      <div className="max-w-[80%] xl:max-w-[70%]">
        <div className="px-3 md:px-4 py-2 rounded-2xl md:rounded-3xl bg-theme-app text-theme-text border border-theme-divider rounded-bl-sm">
          <div className="flex gap-1 items-center h-4 md:h-5 py-1">
            <span className="w-1.5 h-1.5 bg-theme-text-secondary rounded-full animate-bounce [animation-delay:-0.3s]"></span>
            <span className="w-1.5 h-1.5 bg-theme-text-secondary rounded-full animate-bounce [animation-delay:-0.15s]"></span>
            <span className="w-1.5 h-1.5 bg-theme-text-secondary rounded-full animate-bounce"></span>
          </div>
        </div>
      </div>
      <div className="mt-1 ml-1 text-[11px] text-theme-text-secondary">
        {text}
      </div>
    </div>
  );
}
