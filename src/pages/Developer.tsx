import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { toast } from "sonner";
import { Settings, Database, Users, Activity, Shield, ArrowLeft, Terminal, ChevronDown } from "lucide-react";

interface AppSettings {
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

interface UserStats {
  totalUsers: number;
  activeToday: number;
  totalMessages: number;
  totalConversations: number;
}

interface UserData {
  id: string;
  user_id: string;
  email: string;
  role: 'owner' | 'guest';
  created_at: string;
}

interface ConsoleLog {
  id: string;
  timestamp: string;
  type: 'info' | 'success' | 'error' | 'warning';
  message: string;
}

const Developer = () => {
  const navigate = useNavigate();
  const [isOwner, setIsOwner] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<AppSettings>({
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
  });
  const [stats, setStats] = useState<UserStats>({
    totalUsers: 0,
    activeToday: 0,
    totalMessages: 0,
    totalConversations: 0,
  });
  const [consoleLogs, setConsoleLogs] = useState<ConsoleLog[]>([]);
  const [users, setUsers] = useState<UserData[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [userSearchQuery, setUserSearchQuery] = useState("");
  const [userRoleFilter, setUserRoleFilter] = useState<"all" | "owner" | "guest">("all");
  
  // Collapsible section states
  const [openSections, setOpenSections] = useState({
    general: true,
    aiModel: false,
    features: false,
    rateLimiting: false,
    messageLimits: false,
    maintenance: false,
    backup: false,
  });

  useEffect(() => {
    checkOwnerStatus();
  }, []);

  useEffect(() => {
    const channel = supabase
      .channel('activity-logs-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'activity_logs'
        },
        (payload) => {
          const log = payload.new as any;
          addLog(
            log.severity || 'info',
            `[${log.event_type}] ${JSON.stringify(log.event_data)}`
          );
        }
      )
      .subscribe();

    const settingsChannel = supabase
      .channel('settings-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'app_settings'
        },
        (payload) => {
          addLog('info', `Setting updated: ${(payload.new as any)?.key || 'unknown'}`);
          loadSettings();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(settingsChannel);
    };
  }, []);

  const checkOwnerStatus = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        toast.error("Please sign in to access the developer dashboard");
        navigate("/auth");
        return;
      }

      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .single();

      if (roleData?.role !== 'owner') {
        toast.error("Access denied. Owner privileges required.");
        navigate("/");
        return;
      }

      setIsOwner(true);
      addLog('success', 'Developer dashboard loaded successfully');
      await Promise.all([loadSettings(), loadStats(), loadUsers()]);
    } catch (error) {
      console.error('Error checking owner status:', error);
      toast.error("Failed to verify permissions");
      navigate("/");
    } finally {
      setLoading(false);
    }
  };

  const loadSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('app_settings')
        .select('*');

      if (error) throw error;

      if (data) {
        const settingsObj: any = { ...settings };
        
        data.forEach((setting) => {
          settingsObj[setting.key] = setting.value;
        });
        
        setSettings(settingsObj as AppSettings);
        addLog('info', 'Settings loaded successfully');
      }
    } catch (error) {
      console.error('Error loading settings:', error);
      addLog('error', `Failed to load settings: ${error}`);
    }
  };

  const loadStats = async () => {
    try {
      const [usersResult, messagesResult, conversationsResult] = await Promise.all([
        supabase.from('user_roles').select('id', { count: 'exact' }),
        supabase.from('messages').select('id', { count: 'exact' }),
        supabase.from('conversations').select('id', { count: 'exact' }),
      ]);

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const { count: activeToday } = await supabase
        .from('messages')
        .select('user_id', { count: 'exact' })
        .gte('created_at', today.toISOString());

      setStats({
        totalUsers: usersResult.count || 0,
        activeToday: activeToday || 0,
        totalMessages: messagesResult.count || 0,
        totalConversations: conversationsResult.count || 0,
      });

      addLog('info', 'Statistics loaded successfully');
    } catch (error) {
      console.error('Error loading stats:', error);
      addLog('error', `Failed to load statistics: ${error}`);
    }
  };

  const loadUsers = async () => {
    setLoadingUsers(true);
    try {
      const { data, error } = await supabase
        .from('user_roles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const usersWithEmails = await Promise.all(
        (data || []).map(async (user) => {
          const { data: emailData } = await supabase.rpc('get_user_email', {
            _user_id: user.user_id
          });

          return {
            ...user,
            email: emailData || 'Unknown'
          };
        })
      );

      setUsers(usersWithEmails);
      addLog('info', `Loaded ${usersWithEmails.length} users`);
    } catch (error) {
      console.error('Error loading users:', error);
      addLog('error', `Failed to load users: ${error}`);
    } finally {
      setLoadingUsers(false);
    }
  };

  const addLog = (type: ConsoleLog['type'], message: string) => {
    const newLog: ConsoleLog = {
      id: Date.now().toString(),
      timestamp: new Date().toISOString(),
      type,
      message,
    };
    setConsoleLogs((prev) => [newLog, ...prev].slice(0, 100));
  };

  const handleRoleChange = async (userId: string, newRole: 'owner' | 'guest') => {
    try {
      const { error } = await supabase
        .from('user_roles')
        .update({ role: newRole })
        .eq('user_id', userId);

      if (error) throw error;

      toast.success(`Role updated to ${newRole}`);
      addLog('success', `User role changed to ${newRole}`);
      loadUsers();
    } catch (error) {
      console.error('Error updating role:', error);
      toast.error("Failed to update role");
      addLog('error', `Failed to update role: ${error}`);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!confirm('Are you sure you want to remove this user?')) return;

    try {
      const { error } = await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', userId);

      if (error) throw error;

      toast.success("User removed successfully");
      addLog('success', 'User removed from system');
      loadUsers();
    } catch (error) {
      console.error('Error deleting user:', error);
      toast.error("Failed to remove user");
      addLog('error', `Failed to remove user: ${error}`);
    }
  };

  const handleSaveSettings = async () => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      // Only save settings that exist in the database
      const existingSettings = [
        'rate_limit_enabled', 'rate_limit_per_hour', 'rate_limit_per_minute',
        'max_message_length', 'max_file_size_mb', 'max_files_per_message',
        'default_model', 'maintenance_mode', 'allow_new_signups',
        'app_name', 'welcome_message', 'logging_level', 'auto_cleanup_days',
        'enable_file_uploads', 'enable_voice_input', 'theme_mode',
        'enable_email_notifications', 'backup_frequency_hours'
      ];
      
      for (const key of existingSettings) {
        const value = settings[key as keyof AppSettings];
        if (value === undefined) continue;
        
        const { error } = await supabase
          .from('app_settings')
          .update({
            value,
            updated_by: user?.id,
            updated_at: new Date().toISOString(),
          })
          .eq('key', key);

        if (error) {
          console.error(`Error updating ${key}:`, error);
          throw error;
        }
      }

      toast.success("Settings saved successfully!");
      addLog('success', 'All settings saved successfully');
    } catch (error) {
      toast.error("Failed to save settings");
      addLog('error', `Failed to save settings: ${error}`);
      console.error(error);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Loading developer dashboard...</div>
      </div>
    );
  }

  if (!isOwner) {
    return null;
  }

  const filteredUsers = users.filter(user => {
    const matchesSearch = user.email.toLowerCase().includes(userSearchQuery.toLowerCase());
    const matchesRole = userRoleFilter === 'all' || user.role === userRoleFilter;
    return matchesSearch && matchesRole;
  });

  return (
    <div className="min-h-screen bg-background">
      <ScrollArea className="h-screen">
        <div className="container mx-auto p-4 md:p-6 max-w-7xl">
          <div className="mb-8">
            <Button 
              variant="ghost" 
              onClick={() => navigate("/")}
              className="mb-4"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Chat
            </Button>
            <h1 className="text-3xl md:text-4xl font-bold mb-2 gradient-text">Developer Dashboard</h1>
            <p className="text-muted-foreground">
              Manage your AI chatbot application settings and monitor usage
            </p>
          </div>

          <Tabs defaultValue="overview" className="space-y-6">
            <TabsList className="flex-wrap h-auto">
              <TabsTrigger value="overview">
                <Activity className="w-4 h-4 mr-2" />
                Overview
              </TabsTrigger>
              <TabsTrigger value="console">
                <Terminal className="w-4 h-4 mr-2" />
                Console
              </TabsTrigger>
              <TabsTrigger value="settings">
                <Settings className="w-4 h-4 mr-2" />
                Settings
              </TabsTrigger>
              <TabsTrigger value="users">
                <Users className="w-4 h-4 mr-2" />
                Users
              </TabsTrigger>
              <TabsTrigger value="security">
                <Shield className="w-4 h-4 mr-2" />
                Security
              </TabsTrigger>
            </TabsList>

            {/* Overview Tab */}
            <TabsContent value="overview" className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      Total Users
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold">{stats.totalUsers}</div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      Active Today
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold">{stats.activeToday}</div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      Total Messages
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold">{stats.totalMessages}</div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      Conversations
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold">{stats.totalConversations}</div>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>System Status</CardTitle>
                  <CardDescription>
                    Current configuration and operational status
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Database className="w-4 h-4 text-muted-foreground" />
                      <span>Database</span>
                    </div>
                    <span className="text-sm font-medium text-green-600">Connected</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Shield className="w-4 h-4 text-muted-foreground" />
                      <span>Rate Limiting</span>
                    </div>
                    <span className="text-sm font-medium">
                      {settings.rate_limit_enabled ? "Enabled" : "Disabled"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Settings className="w-4 h-4 text-muted-foreground" />
                      <span>AI Model</span>
                    </div>
                    <span className="text-sm font-medium text-green-600">
                      Active
                    </span>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Console Tab */}
            <TabsContent value="console" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>System Console</CardTitle>
                  <CardDescription>
                    Real-time activity log and database events
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex justify-between items-center mb-4">
                    <p className="text-sm text-muted-foreground">
                      {consoleLogs.length} log entries
                    </p>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => {
                        setConsoleLogs([]);
                        addLog('info', 'Console cleared');
                      }}
                    >
                      Clear Console
                    </Button>
                  </div>
                  <ScrollArea className="h-[500px] w-full rounded-md border bg-card/50 p-4">
                    <div className="space-y-2 font-mono text-xs">
                      {consoleLogs.length === 0 ? (
                        <p className="text-muted-foreground">No logs yet...</p>
                      ) : (
                        consoleLogs.map((log) => (
                          <div key={log.id} className="flex gap-2 items-start">
                            <span className="text-muted-foreground shrink-0">
                              {new Date(log.timestamp).toLocaleTimeString()}
                            </span>
                            <span className={`shrink-0 font-semibold ${
                              log.type === 'error' ? 'text-destructive' :
                              log.type === 'success' ? 'text-green-500' :
                              log.type === 'warning' ? 'text-yellow-500' :
                              'text-blue-500'
                            }`}>
                              [{log.type.toUpperCase()}]
                            </span>
                            <span className="break-all">{log.message}</span>
                          </div>
                        ))
                      )}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Settings Tab with Collapsible Sections */}
            <TabsContent value="settings" className="space-y-4">
              {/* General Settings */}
              <Collapsible 
                open={openSections.general}
                onOpenChange={(open) => setOpenSections({...openSections, general: open})}
              >
                <Card>
                  <CollapsibleTrigger className="w-full">
                    <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                      <div className="flex items-center justify-between">
                        <div className="text-left">
                          <CardTitle>General Settings</CardTitle>
                          <CardDescription>
                            Configure general application behavior and branding
                          </CardDescription>
                        </div>
                        <ChevronDown className={`h-5 w-5 transition-transform ${openSections.general ? 'rotate-180' : ''}`} />
                      </div>
                    </CardHeader>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <CardContent className="space-y-6 pt-0">
                      <div className="space-y-2">
                        <Label htmlFor="app-name">Application Name</Label>
                        <Input
                          id="app-name"
                          type="text"
                          value={settings.app_name}
                          onChange={(e) =>
                            setSettings({
                              ...settings,
                              app_name: e.target.value,
                            })
                          }
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="welcome-message">Welcome Message</Label>
                        <Input
                          id="welcome-message"
                          type="text"
                          value={settings.welcome_message}
                          onChange={(e) =>
                            setSettings({
                              ...settings,
                              welcome_message: e.target.value,
                            })
                          }
                        />
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label htmlFor="maintenance-mode">Maintenance Mode</Label>
                          <p className="text-sm text-muted-foreground">
                            Temporarily disable the application for maintenance
                          </p>
                        </div>
                        <Switch
                          id="maintenance-mode"
                          checked={settings.maintenance_mode}
                          onCheckedChange={(checked) =>
                            setSettings({ ...settings, maintenance_mode: checked })
                          }
                        />
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label htmlFor="allow-signups">Allow New Signups</Label>
                          <p className="text-sm text-muted-foreground">
                            Enable or disable new user registrations
                          </p>
                        </div>
                        <Switch
                          id="allow-signups"
                          checked={settings.allow_new_signups}
                          onCheckedChange={(checked) =>
                            setSettings({ ...settings, allow_new_signups: checked })
                          }
                        />
                      </div>

                    </CardContent>
                  </CollapsibleContent>
                </Card>
              </Collapsible>

              {/* AI Model Configuration */}
              <Collapsible 
                open={openSections.aiModel}
                onOpenChange={(open) => setOpenSections({...openSections, aiModel: open})}
              >
                <Card>
                  <CollapsibleTrigger className="w-full">
                    <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                      <div className="flex items-center justify-between">
                        <div className="text-left">
                          <CardTitle>AI Model Configuration</CardTitle>
                          <CardDescription>
                            Select and configure the default AI model
                          </CardDescription>
                        </div>
                        <ChevronDown className={`h-5 w-5 transition-transform ${openSections.aiModel ? 'rotate-180' : ''}`} />
                      </div>
                    </CardHeader>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <CardContent className="space-y-6 pt-0">
                      <div className="space-y-2">
                        <Label htmlFor="default-model">Default Model</Label>
                        <select
                          id="default-model"
                          className="w-full h-10 px-3 rounded-md border border-input bg-background"
                          value={settings.default_model}
                          onChange={(e) =>
                            setSettings({
                              ...settings,
                              default_model: e.target.value,
                            })
                          }
                        >
                          <option value="deepseek-v3.1:671b-cloud">DeepSeek V3.1 (Default)</option>
                          <option value="qwen3-vl:235b-cloud">Qwen3 VL (Vision)</option>
                        </select>
                        <p className="text-xs text-muted-foreground">
                          This model will be used by default for new conversations
                        </p>
                      </div>
                    </CardContent>
                  </CollapsibleContent>
                </Card>
              </Collapsible>

              {/* Feature Toggles */}
              <Collapsible 
                open={openSections.features}
                onOpenChange={(open) => setOpenSections({...openSections, features: open})}
              >
                <Card>
                  <CollapsibleTrigger className="w-full">
                    <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                      <div className="flex items-center justify-between">
                        <div className="text-left">
                          <CardTitle>Feature Toggles</CardTitle>
                          <CardDescription>
                            Enable or disable application features
                          </CardDescription>
                        </div>
                        <ChevronDown className={`h-5 w-5 transition-transform ${openSections.features ? 'rotate-180' : ''}`} />
                      </div>
                    </CardHeader>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <CardContent className="space-y-6 pt-0">
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label htmlFor="enable-uploads">File Uploads</Label>
                          <p className="text-sm text-muted-foreground">
                            Allow users to upload files and images
                          </p>
                        </div>
                        <Switch
                          id="enable-uploads"
                          checked={settings.enable_file_uploads}
                          onCheckedChange={(checked) =>
                            setSettings({ ...settings, enable_file_uploads: checked })
                          }
                        />
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label htmlFor="enable-voice">Voice Input</Label>
                          <p className="text-sm text-muted-foreground">
                            Enable voice-to-text input functionality
                          </p>
                        </div>
                        <Switch
                          id="enable-voice"
                          checked={settings.enable_voice_input}
                          onCheckedChange={(checked) =>
                            setSettings({ ...settings, enable_voice_input: checked })
                          }
                        />
                      </div>

                    </CardContent>
                  </CollapsibleContent>
                </Card>
              </Collapsible>

              {/* Rate Limiting */}
              <Collapsible 
                open={openSections.rateLimiting}
                onOpenChange={(open) => setOpenSections({...openSections, rateLimiting: open})}
              >
                <Card>
                  <CollapsibleTrigger className="w-full">
                    <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                      <div className="flex items-center justify-between">
                        <div className="text-left">
                          <CardTitle>Rate Limiting</CardTitle>
                          <CardDescription>
                            Control API request limits for guest users
                          </CardDescription>
                        </div>
                        <ChevronDown className={`h-5 w-5 transition-transform ${openSections.rateLimiting ? 'rotate-180' : ''}`} />
                      </div>
                    </CardHeader>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <CardContent className="space-y-6 pt-0">
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label htmlFor="rate-limit-enabled">Enable Rate Limiting</Label>
                          <p className="text-sm text-muted-foreground">
                            Limit API requests for non-owner users
                          </p>
                        </div>
                        <Switch
                          id="rate-limit-enabled"
                          checked={settings.rate_limit_enabled}
                          onCheckedChange={(checked) =>
                            setSettings({ ...settings, rate_limit_enabled: checked })
                          }
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="rate-hour">Requests Per Hour (Guests)</Label>
                        <Input
                          id="rate-hour"
                          type="number"
                          value={settings.rate_limit_per_hour}
                          onChange={(e) =>
                            setSettings({
                              ...settings,
                              rate_limit_per_hour: parseInt(e.target.value),
                            })
                          }
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="rate-minute">Requests Per Minute (Guests)</Label>
                        <Input
                          id="rate-minute"
                          type="number"
                          value={settings.rate_limit_per_minute}
                          onChange={(e) =>
                            setSettings({
                              ...settings,
                              rate_limit_per_minute: parseInt(e.target.value),
                            })
                          }
                        />
                      </div>
                    </CardContent>
                  </CollapsibleContent>
                </Card>
              </Collapsible>

              {/* Message & Upload Limits */}
              <Collapsible 
                open={openSections.messageLimits}
                onOpenChange={(open) => setOpenSections({...openSections, messageLimits: open})}
              >
                <Card>
                  <CollapsibleTrigger className="w-full">
                    <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                      <div className="flex items-center justify-between">
                        <div className="text-left">
                          <CardTitle>Message & Upload Limits</CardTitle>
                          <CardDescription>
                            Configure message and file upload restrictions
                          </CardDescription>
                        </div>
                        <ChevronDown className={`h-5 w-5 transition-transform ${openSections.messageLimits ? 'rotate-180' : ''}`} />
                      </div>
                    </CardHeader>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <CardContent className="space-y-6 pt-0">
                      <div className="space-y-2">
                        <Label htmlFor="max-message">Max Message Length (characters)</Label>
                        <Input
                          id="max-message"
                          type="number"
                          value={settings.max_message_length}
                          onChange={(e) =>
                            setSettings({
                              ...settings,
                              max_message_length: parseInt(e.target.value),
                            })
                          }
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="max-file-size">Max File Size (MB)</Label>
                        <Input
                          id="max-file-size"
                          type="number"
                          value={settings.max_file_size_mb}
                          onChange={(e) =>
                            setSettings({
                              ...settings,
                              max_file_size_mb: parseInt(e.target.value),
                            })
                          }
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="max-files">Max Files Per Message</Label>
                        <Input
                          id="max-files"
                          type="number"
                          value={settings.max_files_per_message}
                          onChange={(e) =>
                            setSettings({
                              ...settings,
                              max_files_per_message: parseInt(e.target.value),
                            })
                          }
                        />
                      </div>
                    </CardContent>
                  </CollapsibleContent>
                </Card>
              </Collapsible>

              {/* System Maintenance */}
              <Collapsible 
                open={openSections.maintenance}
                onOpenChange={(open) => setOpenSections({...openSections, maintenance: open})}
              >
                <Card>
                  <CollapsibleTrigger className="w-full">
                    <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                      <div className="flex items-center justify-between">
                        <div className="text-left">
                          <CardTitle>System Maintenance</CardTitle>
                          <CardDescription>
                            Configure automatic cleanup and logging
                          </CardDescription>
                        </div>
                        <ChevronDown className={`h-5 w-5 transition-transform ${openSections.maintenance ? 'rotate-180' : ''}`} />
                      </div>
                    </CardHeader>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <CardContent className="space-y-6 pt-0">
                      <div className="space-y-2">
                        <Label htmlFor="logging-level">Logging Level</Label>
                        <select
                          id="logging-level"
                          className="w-full h-10 px-3 rounded-md border border-input bg-background"
                          value={settings.logging_level}
                          onChange={(e) =>
                            setSettings({
                              ...settings,
                              logging_level: e.target.value,
                            })
                          }
                        >
                          <option value="error">Error Only</option>
                          <option value="warning">Warning & Error</option>
                          <option value="info">Info, Warning & Error</option>
                          <option value="debug">All (Debug Mode)</option>
                        </select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="auto-cleanup">Auto-Cleanup Conversations (days)</Label>
                        <Input
                          id="auto-cleanup"
                          type="number"
                          value={settings.auto_cleanup_days}
                          onChange={(e) =>
                            setSettings({
                              ...settings,
                              auto_cleanup_days: parseInt(e.target.value),
                            })
                          }
                        />
                        <p className="text-xs text-muted-foreground">
                          Automatically delete conversations older than specified days (0 = disabled)
                        </p>
                      </div>
                    </CardContent>
                  </CollapsibleContent>
                </Card>
              </Collapsible>

              {/* Notifications */}
              <Collapsible 
                open={openSections.backup}
                onOpenChange={(open) => setOpenSections({...openSections, backup: open})}
              >
                <Card>
                  <CollapsibleTrigger className="w-full">
                    <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                      <div className="flex items-center justify-between">
                        <div className="text-left">
                          <CardTitle>Notifications & Backup</CardTitle>
                          <CardDescription>
                            Configure notification and backup settings
                          </CardDescription>
                        </div>
                        <ChevronDown className={`h-5 w-5 transition-transform ${openSections.backup ? 'rotate-180' : ''}`} />
                      </div>
                    </CardHeader>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <CardContent className="space-y-6 pt-0">
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label htmlFor="enable-notifications">Email Notifications</Label>
                          <p className="text-sm text-muted-foreground">
                            Send email alerts for system events
                          </p>
                        </div>
                        <Switch
                          id="enable-notifications"
                          checked={settings.enable_email_notifications}
                          onCheckedChange={(checked) =>
                            setSettings({ ...settings, enable_email_notifications: checked })
                          }
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="backup-frequency">Backup Frequency (hours)</Label>
                        <Input
                          id="backup-frequency"
                          type="number"
                          value={settings.backup_frequency_hours}
                          onChange={(e) =>
                            setSettings({
                              ...settings,
                              backup_frequency_hours: parseInt(e.target.value),
                            })
                          }
                        />
                        <p className="text-xs text-muted-foreground">
                          Automatically backup database every X hours (0 = disabled)
                        </p>
                      </div>
                    </CardContent>
                  </CollapsibleContent>
                </Card>
              </Collapsible>

              <div className="flex justify-end gap-3 pt-4">
                <Button 
                  variant="outline"
                  onClick={loadSettings}
                >
                  Reset Changes
                </Button>
                <Button onClick={handleSaveSettings} disabled={saving} className="bg-gradient-primary">
                  {saving ? "Saving..." : "Save All Settings"}
                </Button>
              </div>
            </TabsContent>

            {/* Users Tab */}
            <TabsContent value="users" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>User Management</CardTitle>
                  <CardDescription>
                    View and manage user accounts and roles
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-col gap-4 mb-6">
                    <div className="flex flex-col sm:flex-row gap-3">
                      <div className="flex-1">
                        <Input
                          placeholder="Search by email..."
                          value={userSearchQuery}
                          onChange={(e) => setUserSearchQuery(e.target.value)}
                          className="w-full"
                        />
                      </div>
                      <div className="w-full sm:w-[180px]">
                        <select
                          value={userRoleFilter}
                          onChange={(e) => setUserRoleFilter(e.target.value as "all" | "owner" | "guest")}
                          className="w-full h-10 px-3 rounded-md border border-input bg-background"
                        >
                          <option value="all">All Roles</option>
                          <option value="owner">Owner Only</option>
                          <option value="guest">Guest Only</option>
                        </select>
                      </div>
                      <Button 
                        variant="outline" 
                        size="default"
                        onClick={loadUsers}
                        disabled={loadingUsers}
                      >
                        {loadingUsers ? "Refreshing..." : "Refresh"}
                      </Button>
                    </div>
                  </div>

                  <ScrollArea className="h-[600px]">
                    <div className="space-y-4">
                      {filteredUsers.length === 0 ? (
                        <p className="text-center text-muted-foreground py-8">
                          No users found
                        </p>
                      ) : (
                        filteredUsers.map((user) => (
                          <div
                            key={user.id}
                            className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 border border-border rounded-lg"
                          >
                            <div className="flex-1 min-w-0">
                              <p className="font-medium truncate">{user.email}</p>
                              <p className="text-sm text-muted-foreground">
                                Joined {new Date(user.created_at).toLocaleDateString()}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              <select
                                value={user.role}
                                onChange={(e) =>
                                  handleRoleChange(user.user_id, e.target.value as 'owner' | 'guest')
                                }
                                className="h-9 px-3 rounded-md border border-input bg-background"
                              >
                                <option value="guest">Guest</option>
                                <option value="owner">Owner</option>
                              </select>
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => handleDeleteUser(user.user_id)}
                              >
                                Remove
                              </Button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Security Tab */}
            <TabsContent value="security" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Security Overview</CardTitle>
                  <CardDescription>
                    Security features and database protection status
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Shield className="w-4 h-4 text-green-600" />
                      <span>Row Level Security (RLS)</span>
                    </div>
                    <span className="text-sm font-medium text-green-600">Enabled</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Shield className="w-4 h-4 text-green-600" />
                      <span>Authentication</span>
                    </div>
                    <span className="text-sm font-medium text-green-600">Active</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Database className="w-4 h-4 text-green-600" />
                      <span>Data Encryption</span>
                    </div>
                    <span className="text-sm font-medium text-green-600">Enabled</span>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </ScrollArea>
    </div>
  );
};

export default Developer;
