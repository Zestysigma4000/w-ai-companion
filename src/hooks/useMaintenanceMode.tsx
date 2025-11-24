import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

export function useMaintenanceMode() {
  const [isMaintenanceMode, setIsMaintenanceMode] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const checkMaintenanceAndRole = async () => {
      try {
        // Check if user is owner
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        
        if (userError) {
          console.error('Error getting user:', userError);
          toast.error('Authentication check failed', {
            description: 'Unable to verify your account status.'
          });
        }
        
        if (user) {
          const { data: roleData, error: roleError } = await supabase
            .from('user_roles')
            .select('role')
            .eq('user_id', user.id)
            .maybeSingle();
          
          if (roleError) {
            console.error('Error fetching user role:', roleError);
            toast.error('Failed to check permissions', {
              description: 'Unable to verify your role.'
            });
          }
          
          const ownerStatus = roleData?.role === 'owner';
          setIsOwner(ownerStatus);
        }

        // Check maintenance mode setting
        const { data: settingsData, error: settingsError } = await supabase
          .from('app_settings')
          .select('value')
          .eq('key', 'maintenance_mode')
          .maybeSingle();

        if (settingsError) {
          console.error('Error fetching maintenance mode:', settingsError);
          // Don't show toast for this as it's not critical
        }

        if (settingsData?.value) {
          setIsMaintenanceMode(settingsData.value as boolean);
        }
      } catch (error) {
        console.error('Error checking maintenance mode:', error);
        toast.error('System check failed', {
          description: 'Unable to connect to the service. Please refresh the page.'
        });
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
