'use client';

import { SidebarHeader } from './SidebarHeader';
import { ConversationList } from './ConversationList';
import { useChatsStore } from '@/store/chats';
import { useEffect, useState } from 'react';
import { fetchApi } from '@/lib/api';
import { Conversation, User } from '@/lib/types';
import { Avatar } from '@/components/ui/Avatar';
import { useRouter, usePathname } from 'next/navigation';
import { useToast } from '@/components/ui/Toast';
import { useWsStore } from '@/store/ws';

export const Sidebar = () => {
  const { searchQuery } = useChatsStore();
  const [globalUsers, setGlobalUsers] = useState<User[]>([]);
  const [searchingGlobal, setSearchingGlobal] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const toast = useToast();
  const wsStatus = useWsStore((s) => s.status);

  const isChatRoute = pathname.startsWith('/chat/');

  const [prevSearch, setPrevSearch] = useState(searchQuery);
  if (searchQuery !== prevSearch) {
    setPrevSearch(searchQuery);
    if (!searchQuery) {
      setGlobalUsers([]);
    }
  }

  useEffect(() => {
    if (!searchQuery) {
      return;
    }
    const fetchUsers = async () => {
      setSearchingGlobal(true);
      try {
        const users = await fetchApi<User[]>(`/users/search?q=${encodeURIComponent(searchQuery)}`);
        setGlobalUsers(users);
      } catch {
        // ignore search errors
      } finally {
        setSearchingGlobal(false);
      }
    };
    fetchUsers();
  }, [searchQuery]);

  const handleStartChat = async (userId: number) => {
    try {
      const conv = await fetchApi<Conversation>('/conversations/direct', {
        method: 'POST',
        body: JSON.stringify({ user_id: userId }),
      });
      router.push(`/chat/${conv.id}`);
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : 'Failed to start chat', 'error');
    }
  };

  return (
    <div className={`flex-col h-full flex-shrink-0 bg-theme-app border-r border-theme-divider transition-all ${
      isChatRoute ? "hidden md:flex md:w-[320px] lg:w-[380px]" : "flex w-full md:w-[320px] lg:w-[380px]"
    }`}>
      <SidebarHeader />
      
      {wsStatus !== 'open' && (
        <div 
          className={`w-full text-center py-1 text-xs font-medium ${
            wsStatus === 'connecting' 
              ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-200' 
              : 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200'
          }`}
        >
          {wsStatus === 'connecting' ? 'Connecting...' : 'Disconnected, retrying...'}
        </div>
      )}

      <ConversationList />

      {searchQuery && (globalUsers.length > 0 || searchingGlobal) && (
        <div className="flex flex-col border-t border-theme-divider">
          <span className="text-xs font-semibold text-theme-text-secondary uppercase tracking-wider py-2 px-4 bg-theme-app">
            Contacts & People
          </span>
          <div className="overflow-y-auto max-h-[40vh] bg-theme-app">
            {searchingGlobal ? (
              <div className="flex justify-center p-4">
                <div className="w-5 h-5 rounded-full border-2 border-theme-primary border-t-transparent animate-spin" />
              </div>
            ) : (
              globalUsers.map(user => (
                <button 
                  key={user.id} 
                  onClick={() => handleStartChat(user.id)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-theme-row-hover transition-colors text-left"
                >
                  <Avatar 
                    src={user.avatar_url} 
                    initials={(user.display_name || user.phone_number || '?').charAt(0).toUpperCase()} 
                    isOnline={user.is_online}
                  />
                  <div className="flex flex-col flex-1 min-w-0">
                    <span className="text-sm font-semibold text-theme-text truncate">
                      {user.display_name || user.phone_number}
                    </span>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};
