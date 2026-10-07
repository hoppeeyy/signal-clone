'use client';
import { useState, useEffect } from 'react';
import { Search } from 'lucide-react';

export const SearchBar = ({ 
  value, 
  onChange, 
  placeholder = "Search" 
}: { 
  value: string; 
  onChange: (val: string) => void;
  placeholder?: string;
}) => {
  const [innerValue, setInnerValue] = useState(value);
  const [prevValue, setPrevValue] = useState(value);

  if (value !== prevValue) {
    setPrevValue(value);
    setInnerValue(value);
  }

  useEffect(() => {
    const handler = setTimeout(() => {
      if (innerValue !== value) onChange(innerValue);
    }, 250);
    return () => clearTimeout(handler);
  }, [innerValue, onChange, value]);

  return (
    <div className="relative group">
      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-theme-text-secondary group-focus-within:text-theme-primary transition-colors">
        <Search className="w-4 h-4" />
      </div>
      <input 
        type="text" 
        value={innerValue}
        onChange={(e) => setInnerValue(e.target.value)}
        placeholder={placeholder}
        className="w-full h-[36px] pl-9 pr-4 py-0 bg-theme-input border-transparent rounded-full text-sm text-theme-text placeholder:text-theme-text-secondary focus-visible:outline-none focus-visible:border-theme-primary focus-visible:ring-1 focus-visible:ring-theme-primary transition-all"
      />
    </div>
  );
};

