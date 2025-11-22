import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';

export function useMaintenanceMode() {
  const [isMaintenanceMode, setIsMaintenanceMode] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const checkMaintenanceAndRole = async () => {
      try {
        // Check if user is owner
        const { data: { user } } = await supabase.auth.getUser();
        
        if (user) {
          const { data: roleData } = await supabase
            .from('user_roles')
            .select('role')
            .eq('user_id', user.id)
            .single();
          
          const ownerStatus = roleData?.role === 'owner';
          setIsOwner(ownerStatus);
        }

        // Check maintenance mode setting
        const { data: settingsData } = await supabase
          .from('app_settings')
          .select('value')
          .eq('key', 'maintenance_mode')
          .single();

        if (settingsData?.value) {
          setIsMaintenanceMode(settingsData.value as boolean);
        }
      } catch (error) {
        console.error('Error checking maintenance mode:', error);
      } finally {
        setLoading(false);
      }
    };

    checkMaintenanceAndRole();

    // Subscribe to real-time changes in app_settings
    const channel = supabase
      .channel('app_settings_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'app_settings',
          filter: 'key=eq.maintenance_mode'
        },
        (payload) => {
          console.log('Settings changed:', payload);
          if (payload.new && 'value' in payload.new) {
            setIsMaintenanceMode(payload.new.value as boolean);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [navigate]);

  return { isMaintenanceMode, isOwner, loading };
}
