import { useState, useEffect } from 'react';
import { Modal } from '@/components/ui/Modal';
import { useAuthStore } from '@/store/auth';
import { fetchApi } from '@/lib/api';
import { useToast } from '@/components/ui/Toast';
import { Avatar } from '@/components/ui/Avatar';
import { User, UserSettings } from '@/lib/types';
import { Camera, User as UserIcon, Shield, Bell, MessageCircle, Moon, Monitor, Smartphone, BookOpen } from 'lucide-react';
import { cn } from '@/components/ui/Button';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type Tab = 'profile' | 'appearance' | 'privacy' | 'notifications' | 'chats' | 'linked' | 'stories';

export const SettingsModal = ({ isOpen, onClose }: SettingsModalProps) => {
  const { user, updateUser } = useAuthStore();
  const toast = useToast();
  
  const [activeTab, setActiveTab] = useState<Tab>('profile');
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [loading, setLoading] = useState(false);

  // Form states
  const [displayName, setDisplayName] = useState(user?.display_name || '');
  const [about, setAbout] = useState(user?.about || '');
  const [avatarUrl, setAvatarUrl] = useState(user?.avatar_url || '');

  useEffect(() => {
    if (isOpen) {
      const loadSettings = async () => {
        try {
          const data = await fetchApi<UserSettings>('/users/me/settings');
          setSettings(data);
          if (data.theme) {
            localStorage.setItem('theme', data.theme);
            if (data.theme === 'dark') document.documentElement.classList.add('dark');
            else if (data.theme === 'light') document.documentElement.classList.remove('dark');
            else {
              if (window.matchMedia('(prefers-color-scheme: dark)').matches) document.documentElement.classList.add('dark');
              else document.documentElement.classList.remove('dark');
            }
          }
        } catch (e) {
          toast('Failed to load settings', 'error');
        }
      };
      loadSettings();
      setDisplayName(user?.display_name || '');
      setAbout(user?.about || '');
      setAvatarUrl(user?.avatar_url || '');
    }
  }, [isOpen, user, toast]);

  const saveProfile = async () => {
    try {
      setLoading(true);
      const updated = await fetchApi<User>('/users/me', {
        method: 'PUT',
        body: JSON.stringify({ display_name: displayName, about, avatar_url: avatarUrl })
      });
      updateUser(updated);
      toast('Profile updated', 'success');
    } catch (e) {
      toast('Failed to update profile', 'error');
    } finally {
      setLoading(false);
    }
  };

  const updateSetting = async (updates: Partial<UserSettings>) => {
    if (!settings) return;
    try {
      // Optimistic
      setSettings({ ...settings, ...updates });
      await fetchApi('/users/me/settings', {
        method: 'PATCH',
        body: JSON.stringify(updates)
      });
      // Handle theme change live preview if needed
      if (updates.theme) {
        localStorage.setItem('theme', updates.theme);
        if (updates.theme === 'dark') document.documentElement.classList.add('dark');
        else if (updates.theme === 'light') document.documentElement.classList.remove('dark');
        else {
          if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
            document.documentElement.classList.add('dark');
          } else {
            document.documentElement.classList.remove('dark');
          }
        }
      }
    } catch (e) {
      toast('Failed to update settings', 'error');
      // Revert (simplified)
      const data = await fetchApi<UserSettings>('/users/me/settings');
      setSettings(data);
    }
  };

  const tabs: { id: Tab, label: string, icon: React.ReactNode }[] = [
    { id: 'profile', label: 'Profile', icon: <UserIcon className="w-4 h-4" /> },
    { id: 'appearance', label: 'Appearance', icon: <Moon className="w-4 h-4" /> },
    { id: 'privacy', label: 'Privacy', icon: <Shield className="w-4 h-4" /> },
    { id: 'notifications', label: 'Notifications', icon: <Bell className="w-4 h-4" /> },
    { id: 'chats', label: 'Chats', icon: <MessageCircle className="w-4 h-4" /> },
    { id: 'linked', label: 'Linked Devices', icon: <Monitor className="w-4 h-4" /> },
    { id: 'stories', label: 'Stories', icon: <BookOpen className="w-4 h-4" /> },
  ];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div 
        className="bg-theme-app w-full max-w-4xl h-[80vh] rounded-[12px] shadow-2xl flex overflow-hidden text-theme-text"
        onClick={e => e.stopPropagation()}
      >
        <div className="w-1/3 border-r border-theme-divider bg-theme-app flex flex-col">
          <div className="p-4 border-b border-theme-divider">
            <h2 className="text-xl font-bold">Settings</h2>
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            {tabs.map(t => (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                className={cn(
                  "w-full flex items-center gap-3 px-4 py-3 rounded-[8px] text-left transition-colors mb-1",
                  activeTab === t.id ? "bg-theme-row-active text-theme-primary" : "hover:bg-theme-row-hover"
                )}
              >
                {t.icon}
                <span className="font-medium text-sm">{t.label}</span>
              </button>
            ))}
          </div>
        </div>
        
        <div className="w-2/3 flex flex-col bg-theme-app">
          <div className="p-6 border-b border-theme-divider">
            <h3 className="text-xl font-bold">{tabs.find(t => t.id === activeTab)?.label}</h3>
          </div>
          <div className="flex-1 overflow-y-auto p-6">
            
            {activeTab === 'profile' && (
              <div className="max-w-md flex flex-col gap-6">
                <div className="flex flex-col items-center justify-center">
                  <div className="relative group cursor-pointer">
                    <Avatar 
                      src={avatarUrl} 
                      initials={user?.display_name?.charAt(0).toUpperCase() || '?'} 
                      size="lg" 
                    />
                    <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <Camera className="text-white w-6 h-6" />
                    </div>
                  </div>
                  <input 
                    type="text" 
                    placeholder="Avatar URL" 
                    value={avatarUrl}
                    onChange={e => setAvatarUrl(e.target.value)}
                    className="mt-4 w-full bg-theme-input text-theme-text px-3 py-2 rounded-[8px] border-none outline-none text-sm"
                  />
                </div>
                
                <div className="flex flex-col gap-4">
                  <div className="flex flex-col gap-1">
                    <label className="text-sm font-medium text-theme-text-secondary">Display Name</label>
                    <input 
                      type="text" 
                      value={displayName}
                      onChange={e => setDisplayName(e.target.value)}
                      className="bg-theme-input text-theme-text px-3 py-2 rounded-[8px] border-none outline-none focus:ring-1 focus:ring-theme-primary"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-sm font-medium text-theme-text-secondary">About</label>
                    <textarea 
                      value={about}
                      onChange={e => setAbout(e.target.value)}
                      rows={3}
                      className="bg-theme-input text-theme-text px-3 py-2 rounded-[8px] border-none outline-none resize-none focus:ring-1 focus:ring-theme-primary"
                    />
                  </div>
                  <button 
                    onClick={saveProfile}
                    disabled={loading}
                    className="bg-theme-primary text-white py-2 rounded-[8px] font-medium hover:bg-theme-primary-hover disabled:opacity-50"
                  >
                    {loading ? 'Saving...' : 'Save Profile'}
                  </button>
                </div>
              </div>
            )}

            {activeTab === 'appearance' && settings && (
              <div className="flex flex-col gap-6">
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium text-theme-text-secondary uppercase tracking-wider">Theme</label>
                  <div className="flex flex-col gap-2">
                    {['system', 'light', 'dark'].map(t => (
                      <label key={t} className="flex items-center gap-3 cursor-pointer p-2 hover:bg-theme-row-hover rounded-[8px]">
                        <input 
                          type="radio" 
                          name="theme" 
                          checked={settings.theme === t}
                          onChange={() => updateSetting({ theme: t })}
                          className="w-4 h-4 text-theme-primary focus:ring-theme-primary border-theme-border"
                        />
                        <span className="capitalize">{t}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'privacy' && settings && (
              <div className="flex flex-col gap-6">
                <div className="flex flex-col gap-4">
                  <div className="flex items-center justify-between">
                    <div className="flex flex-col">
                      <span className="font-medium">Read receipts</span>
                      <span className="text-xs text-theme-text-secondary">If disabled, you won't be able to see read receipts from others.</span>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" className="sr-only peer" checked={settings.read_receipts} onChange={e => updateSetting({ read_receipts: e.target.checked })} />
                      <div className="w-11 h-6 bg-theme-border peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-theme-primary"></div>
                    </label>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex flex-col">
                      <span className="font-medium">Typing indicators</span>
                      <span className="text-xs text-theme-text-secondary">If disabled, you won't be able to see typing indicators from others.</span>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" className="sr-only peer" checked={settings.typing_indicators} onChange={e => updateSetting({ typing_indicators: e.target.checked })} />
                      <div className="w-11 h-6 bg-theme-border peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-theme-primary"></div>
                    </label>
                  </div>

                  <div className="flex flex-col gap-2 mt-4">
                    <label className="text-sm font-medium text-theme-text-secondary uppercase tracking-wider">Last seen online</label>
                    <select 
                      value={settings.last_seen_visibility}
                      onChange={e => updateSetting({ last_seen_visibility: e.target.value as 'everyone' | 'nobody' })}
                      className="bg-theme-input text-theme-text px-3 py-2 rounded-[8px] border-none outline-none"
                    >
                      <option value="everyone">Everyone</option>
                      <option value="nobody">Nobody</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'notifications' && settings && (
              <div className="flex flex-col gap-6">
                <div className="flex items-center justify-between">
                  <div className="flex flex-col">
                    <span className="font-medium">Notifications</span>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" className="sr-only peer" checked={settings.notifications_enabled} onChange={e => updateSetting({ notifications_enabled: e.target.checked })} />
                    <div className="w-11 h-6 bg-theme-border peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-theme-primary"></div>
                  </label>
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="flex flex-col">
                    <span className="font-medium">Notification sound</span>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" className="sr-only peer" checked={settings.notification_sound} onChange={e => updateSetting({ notification_sound: e.target.checked })} />
                    <div className="w-11 h-6 bg-theme-border peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-theme-primary"></div>
                  </label>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex flex-col">
                    <span className="font-medium">Message preview</span>
                    <span className="text-xs text-theme-text-secondary">Show message text in notifications</span>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" className="sr-only peer" checked={settings.show_message_preview} onChange={e => updateSetting({ show_message_preview: e.target.checked })} />
                    <div className="w-11 h-6 bg-theme-border peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-theme-primary"></div>
                  </label>
                </div>
              </div>
            )}

            {activeTab === 'chats' && (
              <div className="flex flex-col items-center justify-center h-full text-theme-text-secondary text-sm">
                Placeholder for chats settings (e.g. Chat backups, Enter to send)
              </div>
            )}
            
            {activeTab === 'linked' && (
              <div className="flex flex-col items-center justify-center h-full text-theme-text-secondary text-sm">
                Placeholder for linked devices
              </div>
            )}

            {activeTab === 'stories' && (
              <div className="flex flex-col items-center justify-center h-full text-theme-text-secondary text-sm">
                Placeholder for stories settings
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
};
