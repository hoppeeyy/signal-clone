import { memo } from 'react';
import { format, isToday, isYesterday, differenceInDays } from 'date-fns';

interface DaySeparatorProps {
  date: Date;
}

export const DaySeparator = memo(({ date }: DaySeparatorProps) => {
  let text = '';
  if (isToday(date)) {
    text = 'Today';
  } else if (isYesterday(date)) {
    text = 'Yesterday';
  } else if (differenceInDays(new Date(), date) < 7) {
    text = format(date, 'EEEE');
  } else {
    text = format(date, 'EEE, d MMM');
  }

  return (
    <div className="flex justify-center my-4">
      <span className="bg-theme-row-active text-theme-text-secondary text-[12px] font-medium px-3 py-1 rounded-full">
        {text}
      </span>
    </div>
  );
});
DaySeparator.displayName = 'DaySeparator';
