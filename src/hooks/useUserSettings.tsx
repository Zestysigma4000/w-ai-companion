import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface UserSettings {
  // General
  notifications: boolean;
  soundEnabled: boolean;
  autoSave: boolean;
  sendOnEnter: boolean;
  language: string;
  timezone: string;
  
  // Appearance
  fontSize: string;
  messageDensity: string;
  compactMode: boolean;
  enableAnimations: boolean;
  highContrast: boolean;
  
  // Privacy
  shareUsageData: boolean;
  saveConversationHistory: boolean;
  personalizedExperience: boolean;
  sendCrashReports: boolean;
  
  // Advanced
  developerMode: boolean;
  experimentalFeatures: boolean;
  debugMode: boolean;
  maxTokens: number;
  temperature: number;
}

const defaultSettings: UserSettings = {
  notifications: true,
  soundEnabled: true,
  autoSave: true,
  sendOnEnter: true,
  language: 'en',
  timezone: 'utc',
  fontSize: 'medium',
  messageDensity: 'comfortable',
  compactMode: false,
  enableAnimations: true,
  highContrast: false,
  shareUsageData: false,
  saveConversationHistory: true,
  personalizedExperience: true,
  sendCrashReports: true,
  developerMode: false,
  experimentalFeatures: false,
  debugMode: false,
  maxTokens: 4096,
  temperature: 0.7,
};

const STORAGE_KEY = 'w-ai-user-settings';

export function useUserSettings() {
  const [settings, setSettings] = useState<UserSettings>(defaultSettings);
  const [loading, setLoading] = useState(true);
  const [hasChanges, setHasChanges] = useState(false);

  // Load settings from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        setSettings({ ...defaultSettings, ...parsed });
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Apply settings effects
  useEffect(() => {
    // Apply font size
    const fontSizes: Record<string, string> = {
      small: '14px',
      medium: '16px',
      large: '18px',
      xlarge: '20px',
    };
    document.documentElement.style.setProperty('--user-font-size', fontSizes[settings.fontSize] || '16px');
    
    // Apply compact mode
    if (settings.compactMode) {
      document.documentElement.classList.add('compact-mode');
    } else {
      document.documentElement.classList.remove('compact-mode');
    }
    
    // Apply high contrast
    if (settings.highContrast) {
      document.documentElement.classList.add('high-contrast');
    } else {
      document.documentElement.classList.remove('high-contrast');
    }
    
    // Apply animations toggle
    if (!settings.enableAnimations) {
      document.documentElement.classList.add('reduce-motion');
    } else {
      document.documentElement.classList.remove('reduce-motion');
    }

    // Apply message density
    document.documentElement.setAttribute('data-density', settings.messageDensity);
  }, [settings.fontSize, settings.compactMode, settings.highContrast, settings.enableAnimations, settings.messageDensity]);

  const updateSetting = useCallback(<K extends keyof UserSettings>(key: K, value: UserSettings[K]) => {
    setSettings(prev => {
      const newSettings = { ...prev, [key]: value };
      return newSettings;
    });
    setHasChanges(true);
  }, []);

  const saveSettings = useCallback(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
      setHasChanges(false);
      toast.success('Settings saved successfully!');
    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error('Failed to save settings');
    }
  }, [settings]);

  const resetToDefaults = useCallback(() => {
    setSettings(defaultSettings);
    setHasChanges(true);
    toast.info('Settings reset to defaults. Click Save to confirm.');
  }, []);

  const clearCache = useCallback(() => {
    // Clear various caches
    if ('caches' in window) {
      caches.keys().then(names => {
        names.forEach(name => caches.delete(name));
      });
    }
    localStorage.removeItem('w-ai-cache');
    sessionStorage.clear();
    toast.success('Cache cleared successfully!');
  }, []);

  const deleteAllConversations = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('You must be logged in to delete conversations');
        return;
      }

      const { error } = await supabase
        .from('conversations')
        .delete()
        .eq('user_id', user.id);

      if (error) throw error;
      toast.success('All conversations deleted!');
      window.location.reload();
    } catch (error) {
      console.error('Error deleting conversations:', error);
      toast.error('Failed to delete conversations');
    }
  }, []);

  const exportData = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('You must be logged in to export data');
        return;
      }

      const { data: conversations } = await supabase
        .from('conversations')
        .select('*, messages(*)')
        .eq('user_id', user.id);

      const exportData = {
        settings,
        conversations,
        exportedAt: new Date().toISOString(),
      };

      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `w-ai-export-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      
      toast.success('Data exported successfully!');
    } catch (error) {
      console.error('Error exporting data:', error);
      toast.error('Failed to export data');
    }
  }, [settings]);

  const downloadConversations = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('You must be logged in to download conversations');
        return;
      }

      const { data: conversations } = await supabase
        .from('conversations')
        .select('title, created_at, messages(content, role, created_at)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (!conversations || conversations.length === 0) {
        toast.info('No conversations to download');
        return;
      }

      // Format as readable text
      let text = 'W AI Conversations Export\n';
      text += '========================\n\n';

      conversations.forEach((conv: any) => {
        text += `## ${conv.title}\n`;
        text += `Date: ${new Date(conv.created_at).toLocaleDateString()}\n\n`;
        
        conv.messages?.forEach((msg: any) => {
          text += `[${msg.role.toUpperCase()}]: ${msg.content}\n\n`;
        });
        
        text += '\n---\n\n';
      });

      const blob = new Blob([text], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `w-ai-conversations-${new Date().toISOString().split('T')[0]}.txt`;
      a.click();
      URL.revokeObjectURL(url);
      
      toast.success('Conversations downloaded!');
    } catch (error) {
      console.error('Error downloading conversations:', error);
      toast.error('Failed to download conversations');
    }
  }, []);

  return {
    settings,
    loading,
    hasChanges,
    updateSetting,
    saveSettings,
    resetToDefaults,
    clearCache,
    deleteAllConversations,
    exportData,
    downloadConversations,
  };
}
