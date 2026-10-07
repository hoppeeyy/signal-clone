import { MessageSquare, Lock } from 'lucide-react';

export default function AppShell() {
  return (
    <div className="hidden md:flex flex-1 flex-col items-center justify-center bg-theme-app relative">
      <div className="flex flex-col items-center max-w-sm text-center">
        <div className="w-20 h-20 rounded-full bg-theme-app flex items-center justify-center mb-6 text-theme-primary">
          <MessageSquare className="w-10 h-10 fill-current opacity-20" />
        </div>
        <h2 className="text-xl font-semibold text-theme-text mb-2">Select a chat to start messaging</h2>
        <p className="text-theme-text-secondary text-sm">Choose a conversation from the left pane or start a new one.</p>
      </div>
      
      {/* E2EE indicator */}
      <div className="absolute bottom-6 flex items-center gap-1.5 text-xs text-theme-text-secondary font-medium">
        <Lock className="w-3.5 h-3.5" /> Your messages are end-to-end encrypted (simulated)
      </div>
    </div>
  );
}
