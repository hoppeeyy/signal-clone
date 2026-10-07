'use client';
import { useState, useEffect } from 'react';
import { fetchApi } from '@/lib/api';
import { useToast } from '@/components/ui/Toast';
import { Modal } from '@/components/ui/Modal';
import { Avatar } from '@/components/ui/Avatar';
import { Contact, Conversation } from '@/lib/types';
import { SearchBar } from '@/components/ui/SearchBar';
import { Check, ArrowRight } from 'lucide-react';

interface AddMembersModalProps {
  isOpen: boolean;
  onClose: () => void;
  conversation: Conversation;
}

export const AddMembersModal = ({ isOpen, onClose, conversation }: AddMembersModalProps) => {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);
  const toast = useToast();

  useEffect(() => {
    if (isOpen) {
      setSearchQuery('');
      setSelectedIds(new Set());
      const loadContacts = async () => {
        try {
          const data = await fetchApi<Contact[]>('/contacts');
          setContacts(data);
        } catch (e) {
          // ignore
        }
      };
      loadContacts();
    }
  }, [isOpen]);

  const toggleSelection = (userId: number) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(userId)) {
      newSet.delete(userId);
    } else {
      newSet.add(userId);
    }
    setSelectedIds(newSet);
  };

  const handleAdd = async () => {
    if (selectedIds.size === 0) return;
    setLoading(true);
    try {
      await fetchApi(`/conversations/${conversation.id}/members`, {
        method: 'POST',
        body: JSON.stringify({ user_ids: Array.from(selectedIds) })
      });
      onClose();
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : 'Failed to add members', 'error');
    } finally {
      setLoading(false);
    }
  };

  const existingIds = new Set(conversation.members?.map(m => m.user_id) || []);
  
  const filteredContacts = contacts.filter(c => {
    if (existingIds.has(c.contact_user.id)) return false;
    const name = c.nickname || c.contact_user.display_name || c.contact_user.phone_number || 'Unknown';
    return name.toLowerCase().includes(searchQuery.toLowerCase());
  });

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add members">
      <div className="flex flex-col h-[50vh] mt-2">
        <div className="px-1 mb-3">
          <SearchBar 
            value={searchQuery} 
            onChange={setSearchQuery} 
            placeholder="Search contacts" 
          />
        </div>
        
        <div className="flex-1 overflow-y-auto px-1">
          {filteredContacts.length === 0 ? (
            <p className="text-sm text-theme-text-secondary text-center py-4">No new contacts found</p>
          ) : (
            filteredContacts.map(c => {
              const name = c.nickname || c.contact_user.display_name || c.contact_user.phone_number || 'Unknown';
              const isSelected = selectedIds.has(c.contact_user.id);
              
              return (
                <button 
                  key={c.id} 
                  onClick={() => toggleSelection(c.contact_user.id)}
                  className="w-full flex items-center justify-between px-2 py-3 rounded-[12px] hover:bg-theme-row-hover transition-colors text-left"
                >
                  <div className="flex items-center gap-3">
                    <Avatar 
                      src={c.contact_user.avatar_url} 
                      initials={name.charAt(0).toUpperCase()} 
                    />
                    <div className="flex flex-col flex-1 min-w-0">
                      <span className="text-sm font-semibold text-theme-text truncate">{name}</span>
                      {c.nickname && c.contact_user.display_name && (
                        <span className="text-xs text-theme-text-secondary truncate">
                          ~{c.contact_user.display_name}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${isSelected ? 'bg-theme-primary border-theme-primary' : 'border-theme-divider'}`}>
                    {isSelected && <Check className="w-3 h-3 text-white" />}
                  </div>
                </button>
              );
            })
          )}
        </div>
        
        <div className="pt-4 border-t border-theme-divider mt-auto flex justify-end">
          <button 
            onClick={handleAdd}
            disabled={selectedIds.size === 0 || loading}
            className="w-12 h-12 bg-theme-primary text-white rounded-full flex items-center justify-center hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {loading ? (
              <div className="w-5 h-5 rounded-full border-2 border-white border-t-transparent animate-spin" />
            ) : (
              <ArrowRight className="w-6 h-6" />
            )}
          </button>
        </div>
      </div>
    </Modal>
  );
};
