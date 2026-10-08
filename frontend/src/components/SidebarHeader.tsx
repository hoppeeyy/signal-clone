'use client';
import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth';
import { fetchApi } from '@/lib/api';
import { Avatar } from '@/components/ui/Avatar';
import { IconButton } from '@/components/ui/IconButton';
import { PenSquare, Settings, LogOut, UserPlus } from 'lucide-react';
import { SearchBar } from '@/components/ui/SearchBar';
import { NewChatModal } from './NewChatModal';
import { SettingsModal } from './SettingsModal';
import { AddContactModal } from './AddContactModal';
import { useChatsStore } from '@/store/chats';
import { useToast } from '@/components/ui/Toast';

export const SidebarHeader = () => {
  const { user, logout } = useAuthStore();
  const { searchQuery, setSearchQuery } = useChatsStore();
  
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [newChatOpen, setNewChatOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [addContactOpen, setAddContactOpen] = useState(false);
  
  const dropdownRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const toast = useToast();

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = async () => {
    try {
      await fetchApi('/auth/logout', { method: 'POST' });
    } catch {
    }
    logout();
    toast('Logged out successfully', 'info');
    router.push('/login');
  };

  return (
    <>
      <div className="flex items-center h-[56px] px-4 gap-3 bg-theme-app border-b border-theme-divider">
        <div className="relative flex-shrink-0" ref={dropdownRef}>
          <button 
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-theme-primary rounded-full transition-transform active:scale-95 flex items-center justify-center"
          >
            <Avatar 
              src={user?.avatar_url} 
              initials={user?.display_name || user?.phone_number || '?'} 
              isOnline={true}
              size="sm"
            />
          </button>
          
          {dropdownOpen && (
            <div className="absolute top-10 left-0 w-48 bg-theme-app rounded-[12px] shadow-lg border border-theme-divider py-1 z-50 animate-in fade-in zoom-in-95 duration-150">
              <button 
                onClick={() => { setSettingsOpen(true); setDropdownOpen(false); }}
                className="w-full text-left px-4 py-2 text-sm text-theme-text hover:bg-theme-row-hover flex items-center gap-2"
              >
                <Settings className="w-4 h-4" /> Settings
              </button>
              <div className="h-[1px] bg-theme-divider my-1" />
              <button onClick={handleLogout} className="w-full text-left px-4 py-2 text-sm text-theme-danger hover:bg-red-50 flex items-center gap-2">
                <LogOut className="w-4 h-4" /> Log out
              </button>
            </div>
          )}
        </div>
        
        <div className="flex-1 min-w-0">
          <SearchBar value={searchQuery} onChange={setSearchQuery} />
        </div>

        <IconButton onClick={() => setAddContactOpen(true)} title="Add Contact">
          <UserPlus className="w-5 h-5" />
        </IconButton>

        <IconButton onClick={() => setNewChatOpen(true)} title="New Chat">
          <PenSquare className="w-5 h-5" />
        </IconButton>
      </div>

      <NewChatModal isOpen={newChatOpen} onClose={() => setNewChatOpen(false)} />
      <SettingsModal isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <AddContactModal isOpen={addContactOpen} onClose={() => setAddContactOpen(false)} />
    </>
  );
};

