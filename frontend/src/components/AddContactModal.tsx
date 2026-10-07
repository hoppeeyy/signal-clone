'use client';
import { useState } from 'react';
import { fetchApi } from '@/lib/api';
import { useToast } from '@/components/ui/Toast';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { User } from '@/lib/types';

interface AddContactModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const AddContactModal = ({ isOpen, onClose, onSuccess }: AddContactModalProps) => {
  const [identifier, setIdentifier] = useState('');
  const [nickname, setNickname] = useState('');
  const [loading, setLoading] = useState(false);
  const toast = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier.trim()) return;

    setLoading(true);
    try {
      await fetchApi<{ contact_user: User }>('/contacts', {
        method: 'POST',
        body: JSON.stringify({ identifier, nickname: nickname || undefined }),
      });
      toast('Contact added successfully', 'success');
      onSuccess?.();
      onClose();
      setIdentifier('');
      setNickname('');
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : 'Failed to add contact', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add new contact">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4 mt-4">
        <Input
          label="Phone Number or Username"
          placeholder="+1234567890 or alice_w"
          value={identifier}
          onChange={e => setIdentifier(e.target.value)}
          autoFocus
          required
        />
        <Input
          label="Nickname (optional)"
          placeholder="How you want to see this contact"
          value={nickname}
          onChange={e => setNickname(e.target.value)}
        />
        <div className="flex justify-end gap-2 mt-4">
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" isLoading={loading} disabled={!identifier.trim()}>
            Add Contact
          </Button>
        </div>
      </form>
    </Modal>
  );
};

