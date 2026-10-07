'use client';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { UserPlus, Users } from 'lucide-react';
import { fetchApi } from '@/lib/api';
import { useToast } from '@/components/ui/Toast';
import { Modal } from '@/components/ui/Modal';
import { Avatar } from '@/components/ui/Avatar';
import { Contact, Conversation } from '@/lib/types';
import { AddContactModal } from './AddContactModal';
import { NewGroupModal } from './NewGroupModal';
import { SearchBar } from './ui/SearchBar';

interface NewChatModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const NewChatModal = ({ isOpen, onClose }: NewChatModalProps) => {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [addContactOpen, setAddContactOpen] = useState(false);
  const [newGroupOpen, setNewGroupOpen] = useState(false);
  
  const router = useRouter();
  const toast = useToast();

  const loadContacts = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchApi<Contact[]>('/contacts');
      setContacts(data);
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : 'Failed to load contacts', 'error');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (isOpen) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      loadContacts();
      setSearchQuery('');
    }
  }, [isOpen, loadContacts]);

  const handleStartChat = async (userId: number) => {
    try {
      const conv = await fetchApi<Conversation>('/conversations/direct', {
        method: 'POST',
        body: JSON.stringify({ user_id: userId }),
      });
      onClose();
      router.push(`/chat/${conv.id}`);
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : 'Failed to start chat', 'error');
    }
  };

  const filteredContacts = contacts.filter(c => {
    const name = c.nickname || c.contact_user.display_name || c.contact_user.phone_number || 'Unknown';
    return name.toLowerCase().includes(searchQuery.toLowerCase());
  });

  return (
    <>
      <Modal isOpen={isOpen} onClose={onClose} title="New chat">
        <div className="flex flex-col gap-4 mt-2 max-h-[60vh] overflow-y-auto overflow-x-hidden p-1">
          <SearchBar 
            value={searchQuery} 
            onChange={setSearchQuery} 
            placeholder="Search contacts" 
          />
          
          <div className="flex flex-col gap-1 mt-2">
            <button 
              onClick={() => { setNewGroupOpen(true); }}
              className="flex items-center gap-3 px-2 py-3 rounded-[12px] hover:bg-theme-row-hover transition-colors"
            >
              <div className="w-10 h-10 rounded-full bg-theme-app border border-theme-divider flex items-center justify-center text-theme-primary">
                <Users className="w-5 h-5" />
              </div>
              <div className="flex flex-col items-start flex-1">
                <span className="text-sm font-semibold text-theme-text">New group</span>
              </div>
            </button>
            
            <button 
              onClick={() => { setAddContactOpen(true); }}
              className="flex items-center gap-3 px-2 py-3 rounded-[12px] hover:bg-theme-row-hover transition-colors"
            >
              <div className="w-10 h-10 rounded-full bg-theme-app border border-theme-divider flex items-center justify-center text-theme-primary">
                <UserPlus className="w-5 h-5" />
              </div>
              <span className="text-sm font-semibold text-theme-text">Add new contact</span>
            </button>
          </div>
          
          <div className="h-[1px] bg-theme-border my-2" />
          
          <div className="flex flex-col">
            <span className="text-xs font-semibold text-theme-text-secondary uppercase tracking-wider mb-2 px-2">
              Contacts
            </span>
            
            {loading ? (
              <div className="flex justify-center p-4"><div className="w-6 h-6 rounded-full border-2 border-theme-primary border-t-transparent animate-spin" /></div>
            ) : filteredContacts.length === 0 ? (
              <p className="text-sm text-theme-text-secondary text-center py-4">No contacts found</p>
            ) : (
              filteredContacts.map(c => {
                const name = c.nickname || c.contact_user.display_name || c.contact_user.phone_number || 'Unknown';
                return (
                  <button 
                    key={c.id} 
                    onClick={() => handleStartChat(c.contact_user.id)}
                    className="flex items-center gap-3 px-2 py-3 rounded-[12px] hover:bg-theme-row-hover transition-colors text-left"
                  >
                    <Avatar 
                      src={c.contact_user.avatar_url} 
                      initials={name.charAt(0).toUpperCase()} 
                      isOnline={c.contact_user.is_online}
                    />
                    <div className="flex flex-col flex-1 min-w-0">
                      <span className="text-sm font-semibold text-theme-text truncate">{name}</span>
                      {c.nickname && c.contact_user.display_name && (
                        <span className="text-xs text-theme-text-secondary truncate">
                          ~{c.contact_user.display_name}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      </Modal>

      <AddContactModal 
        isOpen={addContactOpen} 
        onClose={() => setAddContactOpen(false)}
        onSuccess={loadContacts}
      />
      
      <NewGroupModal
        isOpen={newGroupOpen}
        onClose={() => setNewGroupOpen(false)}
        contacts={contacts}
      />
    </>
  );
};

