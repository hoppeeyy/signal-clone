'use client';
import { useState } from 'react';
import { UserPlus, MoreVertical } from 'lucide-react';
import { fetchApi } from '@/lib/api';
import { useToast } from '@/components/ui/Toast';
import { Modal } from '@/components/ui/Modal';
import { Avatar } from '@/components/ui/Avatar';
import { Conversation } from '@/lib/types';
import { useAuthStore } from '@/store/auth';
import { AddMembersModal } from './AddMembersModal';

interface GroupInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  conversation: Conversation;
}

export const GroupInfoModal = ({ isOpen, onClose, conversation }: GroupInfoModalProps) => {
  const currentUser = useAuthStore(s => s.user);
  const toast = useToast();
  
  const [name, setName] = useState(conversation.name || 'Group');
  const [editingName, setEditingName] = useState(false);
  const [showAddMembers, setShowAddMembers] = useState(false);
  const [menuOpenFor, setMenuOpenFor] = useState<number | null>(null);

  const myMember = conversation.members?.find(m => m.user_id === currentUser?.id);
  const isAdmin = myMember?.role === 'admin';

  const handleUpdateName = async () => {
    if (!name.trim()) return;
    try {
      await fetchApi(`/conversations/${conversation.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ name }),
      });
      setEditingName(false);
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : 'Failed to rename', 'error');
    }
  };

  const handleLeaveGroup = async () => {
    if (!currentUser) return;
    try {
      await fetchApi(`/conversations/${conversation.id}/members/${currentUser.id}`, {
        method: 'DELETE',
      });
      onClose();
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : 'Failed to leave', 'error');
    }
  };

  const handleRemoveMember = async (userId: number) => {
    try {
      await fetchApi(`/conversations/${conversation.id}/members/${userId}`, {
        method: 'DELETE',
      });
      setMenuOpenFor(null);
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : 'Failed to remove', 'error');
    }
  };

  const handleMakeAdmin = async (userId: number) => {
    try {
      await fetchApi(`/conversations/${conversation.id}/members/${userId}/promote`, {
        method: 'POST',
      });
      setMenuOpenFor(null);
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : 'Failed to promote', 'error');
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Group info">
      <div className="flex flex-col gap-4 mt-2">
        <div className="flex flex-col items-center justify-center p-4">
          <Avatar 
            src={conversation.avatar_url} 
            initials={(conversation.name || 'G').charAt(0).toUpperCase()} 
            size="lg"
          />
          {editingName ? (
            <div className="flex items-center gap-2 mt-4">
              <input 
                type="text" 
                value={name} 
                onChange={e => setName(e.target.value)} 
                className="bg-theme-app border border-theme-divider rounded px-2 py-1 text-theme-text"
              />
              <button onClick={handleUpdateName} className="text-theme-primary font-medium text-sm">Save</button>
            </div>
          ) : (
            <div className="flex items-center gap-2 mt-4 group">
              <span className="text-lg font-semibold text-theme-text">{conversation.name || 'Group'}</span>
              {isAdmin && (
                <button 
                  onClick={() => setEditingName(true)} 
                  className="text-xs text-theme-primary opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  Edit
                </button>
              )}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between px-2">
            <span className="text-xs font-semibold text-theme-text-secondary uppercase tracking-wider">
              {conversation.members?.length || 0} Members
            </span>
            {isAdmin && (
              <button 
                onClick={() => setShowAddMembers(true)}
                className="flex items-center gap-1 text-theme-primary text-xs font-medium hover:underline"
              >
                <UserPlus className="w-4 h-4" /> Add
              </button>
            )}
          </div>
          
          <div className="flex flex-col max-h-[40vh] overflow-y-auto">
            {conversation.members?.map(m => (
              <div key={m.user_id} className="flex items-center justify-between p-2 hover:bg-theme-row-hover rounded-[12px] relative">
                <div className="flex items-center gap-3">
                  <Avatar 
                    src={m.user_avatar_url} 
                    initials={(m.user_display_name || '?').charAt(0).toUpperCase()} 
                    isOnline={m.is_online}
                  />
                  <div className="flex flex-col">
                    <span className="text-sm font-semibold text-theme-text">
                      {m.user_id === currentUser?.id ? 'You' : m.user_display_name}
                    </span>
                    <span className="text-xs text-theme-text-secondary">
                      {m.role === 'admin' ? 'Admin' : 'Member'}
                    </span>
                  </div>
                </div>
                
                {isAdmin && m.user_id !== currentUser?.id && (
                  <div className="relative">
                    <button 
                      onClick={() => setMenuOpenFor(menuOpenFor === m.user_id ? null : m.user_id)}
                      className="p-1 text-theme-text-secondary hover:text-theme-text rounded-full hover:bg-theme-app"
                    >
                      <MoreVertical className="w-4 h-4" />
                    </button>
                    
                    {menuOpenFor === m.user_id && (
                      <div className="absolute right-0 top-full mt-1 w-32 bg-theme-app border border-theme-divider rounded-lg shadow-lg overflow-hidden z-10">
                        {m.role !== 'admin' && (
                          <button 
                            onClick={() => handleMakeAdmin(m.user_id)}
                            className="w-full text-left px-3 py-2 text-sm text-theme-text hover:bg-theme-row-hover"
                          >
                            Make Admin
                          </button>
                        )}
                        <button 
                          onClick={() => handleRemoveMember(m.user_id)}
                          className="w-full text-left px-3 py-2 text-sm text-red-500 hover:bg-theme-row-hover"
                        >
                          Remove
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
        
        <div className="h-[1px] bg-theme-border my-2" />
        
        <button 
          onClick={handleLeaveGroup}
          className="w-full py-3 text-red-500 font-semibold hover:bg-red-500/10 rounded-[12px] transition-colors"
        >
          Leave group
        </button>
      </div>

      {showAddMembers && (
        <AddMembersModal 
          isOpen={showAddMembers}
          onClose={() => setShowAddMembers(false)}
          conversation={conversation}
        />
      )}
    </Modal>
  );
};
