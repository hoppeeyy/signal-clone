import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';

interface DeleteMessageModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDeleteForMe: () => void;
  onDeleteForEveryone?: () => void;
}

export const DeleteMessageModal = ({ isOpen, onClose, onDeleteForMe, onDeleteForEveryone }: DeleteMessageModalProps) => {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Delete Message">
      <div className="space-y-4">
        <p className="text-sm text-theme-text-secondary">
          Are you sure you want to delete this message?
        </p>
        <div className="flex flex-col gap-2">
          {onDeleteForEveryone && (
            <Button variant="primary" onClick={onDeleteForEveryone} className="w-full bg-red-500 hover:bg-red-600 text-white">
              Delete for everyone
            </Button>
          )}
          <Button variant="primary" onClick={onDeleteForMe} className="w-full bg-red-500 hover:bg-red-600 text-white">
            Delete for me
          </Button>
          <Button variant="secondary" onClick={onClose} className="w-full">
            Cancel
          </Button>
        </div>
      </div>
    </Modal>
  );
};
