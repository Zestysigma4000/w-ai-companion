import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface AppSettings {
  rate_limit_enabled: boolean;
  rate_limit_per_hour: number;
  rate_limit_per_minute: number;
  max_message_length: number;
  max_file_size_mb: number;
  max_files_per_message: number;
  default_model: string;
  maintenance_mode: boolean;
  allow_new_signups: boolean;
  app_name: string;
  welcome_message: string;
  logging_level: string;
  auto_cleanup_days: number;
  enable_file_uploads: boolean;
  enable_voice_input: boolean;
  enable_email_notifications: boolean;
  backup_frequency_hours: number;
  theme_mode: string;
}

const defaultSettings: AppSettings = {
  rate_limit_enabled: true,
  rate_limit_per_hour: 60,
  rate_limit_per_minute: 10,
  max_message_length: 10000,
  max_file_size_mb: 20,
  max_files_per_message: 10,
  default_model: "deepseek-v3.1:671b-cloud",
  maintenance_mode: false,
  allow_new_signups: true,
  app_name: "AI Assistant",
  welcome_message: "Hello! How can I help you today?",
  logging_level: "info",
  auto_cleanup_days: 30,
  enable_file_uploads: true,
  enable_voice_input: true,
  enable_email_notifications: false,
  backup_frequency_hours: 24,
  theme_mode: "dark",
};

export function useAppSettings() {
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const { data, error } = await supabase
          .from('app_settings')
          .select('*');

        if (error) {
          console.error('Error loading settings:', error);
          toast.error('Failed to load app settings', {
            description: 'Using default settings. Some features may be limited.'
          });
          setLoading(false);
          return;
        }

        if (data) {
          const settingsObj: any = { ...defaultSettings };
          
          data.forEach((setting) => {
            settingsObj[setting.key] = setting.value;
          });
          
          setSettings(settingsObj as AppSettings);
        }
      } catch (error) {
        console.error('Error loading settings:', error);
        toast.error('Failed to load app settings', {
          description: 'Using default settings. Some features may be limited.'
        });
      } finally {
        setLoading(false);
      }
    };

    loadSettings();

    // Subscribe to real-time changes
    const channel = supabase
      .channel('app-settings-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'app_settings'
        },
        (payload) => {
          console.log('Settings changed:', payload);
          loadSettings();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return { settings, loading };
}
