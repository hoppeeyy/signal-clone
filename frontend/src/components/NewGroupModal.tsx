'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { fetchApi } from '@/lib/api';
import { useToast } from '@/components/ui/Toast';
import { Modal } from '@/components/ui/Modal';
import { Avatar } from '@/components/ui/Avatar';
import { Contact, Conversation } from '@/lib/types';
import { SearchBar } from './ui/SearchBar';
import { X, ArrowRight, Check } from 'lucide-react';

interface NewGroupModalProps {
  isOpen: boolean;
  onClose: () => void;
  contacts: Contact[];
}

export const NewGroupModal = ({ isOpen, onClose, contacts }: NewGroupModalProps) => {
  const [step, setStep] = useState<1 | 2>(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [groupName, setGroupName] = useState('');
  const [loading, setLoading] = useState(false);
  
  const router = useRouter();
  const toast = useToast();

  useEffect(() => {
    if (isOpen) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setStep(1);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSearchQuery('');
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSelectedIds(new Set());
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setGroupName('');
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

  const handleNext = () => {
    if (selectedIds.size < 1) {
      toast('Select at least 1 contact (which makes 2 other members counting you? Wait, min 2 other members, so select at least 2)', 'error');
      // Wait, backend requires 2 other members.
      if (selectedIds.size < 2) {
        toast('Select at least 2 contacts', 'error');
        return;
      }
    }
    setStep(2);
  };

  const handleCreate = async () => {
    if (!groupName.trim()) {
      toast('Group name is required', 'error');
      return;
    }
    
    setLoading(true);
    try {
      const conv = await fetchApi<Conversation>('/conversations/group', {
        method: 'POST',
        body: JSON.stringify({
          name: groupName,
          member_ids: Array.from(selectedIds)
        }),
      });
      onClose();
      router.push(`/chat/${conv.id}`);
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : 'Failed to create group', 'error');
    } finally {
      setLoading(false);
    }
  };

  const filteredContacts = contacts.filter(c => {
    const name = c.nickname || c.contact_user.display_name || c.contact_user.phone_number || 'Unknown';
    return name.toLowerCase().includes(searchQuery.toLowerCase());
  });

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={step === 1 ? 'Add members' : 'Name this group'}>
      <div className="flex flex-col h-[60vh] mt-2">
        {step === 1 ? (
          <>
            <div className="px-1 mb-3">
              <SearchBar 
                value={searchQuery} 
                onChange={setSearchQuery} 
                placeholder="Search contacts" 
              />
            </div>
            
            {/* Selected Chips */}
            {selectedIds.size > 0 && (
              <div className="flex flex-wrap gap-2 mb-3 px-1">
                {Array.from(selectedIds).map(id => {
                  const contact = contacts.find(c => c.contact_user.id === id);
                  if (!contact) return null;
                  const name = contact.nickname || contact.contact_user.display_name || 'Unknown';
                  return (
                    <div key={id} className="flex items-center gap-1 bg-theme-app border border-theme-divider rounded-full py-1 pl-1 pr-2">
                      <Avatar src={contact.contact_user.avatar_url} initials={name.charAt(0).toUpperCase()} size="sm" />
                      <span className="text-xs font-medium text-theme-text ml-1">{name.split(' ')[0]}</span>
                      <button onClick={() => toggleSelection(id)} className="ml-1 text-theme-text-secondary hover:text-theme-text">
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
            
            <div className="flex-1 overflow-y-auto px-1">
              <span className="text-xs font-semibold text-theme-text-secondary uppercase tracking-wider mb-2 block">
                Contacts
              </span>
              
              {filteredContacts.length === 0 ? (
                <p className="text-sm text-theme-text-secondary text-center py-4">No contacts found</p>
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
                onClick={handleNext}
                disabled={selectedIds.size < 2}
                className="w-12 h-12 bg-theme-primary text-white rounded-full flex items-center justify-center hover:opacity-90 disabled:opacity-50 transition-opacity"
              >
                <ArrowRight className="w-6 h-6" />
              </button>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center pt-8 flex-1 gap-6">
            <div className="w-24 h-24 rounded-full bg-theme-app border border-theme-divider flex items-center justify-center text-theme-text-secondary text-2xl font-bold">
              {groupName ? groupName.charAt(0).toUpperCase() : '?'}
            </div>
            
            <div className="w-full max-w-sm px-4">
              <input
                type="text"
                placeholder="Group name"
                value={groupName}
                onChange={e => setGroupName(e.target.value)}
                className="w-full bg-theme-app border-b-2 border-theme-primary px-2 py-2 text-theme-text focus:outline-none"
                autoFocus
              />
            </div>
            
            <div className="mt-auto pt-4 w-full flex justify-end px-4 mb-4">
              <button 
                onClick={handleCreate}
                disabled={!groupName.trim() || loading}
                className="w-12 h-12 bg-theme-primary text-white rounded-full flex items-center justify-center hover:opacity-90 disabled:opacity-50 transition-opacity"
              >
                {loading ? (
                  <div className="w-6 h-6 rounded-full border-2 border-white border-t-transparent animate-spin" />
                ) : (
                  <Check className="w-6 h-6" />
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};
