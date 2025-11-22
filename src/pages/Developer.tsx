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
import { toast } from "sonner";
import { Settings, Database, Users, Activity, Shield, ArrowLeft, Terminal } from "lucide-react";

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
  session_timeout_minutes: number;
  max_conversations_per_user: number;
  enable_markdown: boolean;
  enable_code_highlighting: boolean;
  enable_analytics: boolean;
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
    default_model: "google/gemini-2.0-flash-exp:free",
    maintenance_mode: false,
    allow_new_signups: true,
    app_name: "AI Assistant",
    welcome_message: "Hello! How can I help you today?",
    logging_level: "info",
    auto_cleanup_days: 30,
    enable_file_uploads: true,
    enable_voice_input: true,
    session_timeout_minutes: 60,
    max_conversations_per_user: 100,
    enable_markdown: true,
    enable_code_highlighting: true,
    enable_analytics: true,
    enable_email_notifications: false,
    backup_frequency_hours: 24,
    theme_mode: "system",
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

  useEffect(() => {
    checkOwnerStatus();
    
    // Set up realtime logging
    addLog('info', 'Developer dashboard initialized');
    
    // Listen to activity logs table for real-time events
    const activityChannel = supabase
      .channel('activity-logs')
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public',
        table: 'activity_logs'
      }, (payload) => {
        const log = payload.new;
        addLog(
          log.severity || 'info',
          `[${log.event_type}] ${JSON.stringify(log.event_data || {})}`
        );
      })
      .subscribe();

    // Listen to app_settings for real-time settings changes
    const settingsChannel = supabase
      .channel('app-settings-realtime')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'app_settings'
      }, (payload: any) => {
        console.log('Settings changed in real-time:', payload);
        addLog('info', `Setting changed: ${payload.new?.key || payload.old?.key || 'unknown'}`);
        // Reload settings when any change occurs
        loadSettings();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(activityChannel);
      supabase.removeChannel(settingsChannel);
    };
  }, []);

  const addLog = (type: ConsoleLog['type'], message: string) => {
    const newLog: ConsoleLog = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      type,
      message
    };
    setConsoleLogs(prev => [newLog, ...prev].slice(0, 100)); // Keep last 100 logs
  };

  const checkOwnerStatus = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      navigate("/auth");
      return;
    }

    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .single();

    if (roleData?.role !== "owner") {
      toast.error("Access denied. Owner permissions required.");
      navigate("/");
      return;
    }

    setIsOwner(true);
    await loadSettings();
    await loadStats();
    await loadUsers();
    setLoading(false);
  };

  const loadSettings = async () => {
    addLog('info', 'Loading app settings...');
    const { data } = await supabase
      .from("app_settings")
      .select("key, value");

    if (data) {
      const settingsObj: any = {
        // Set defaults first
        rate_limit_enabled: true,
        rate_limit_per_hour: 60,
        rate_limit_per_minute: 10,
        max_message_length: 10000,
        max_file_size_mb: 20,
        max_files_per_message: 10,
        default_model: "google/gemini-2.0-flash-exp:free",
        maintenance_mode: false,
        allow_new_signups: true,
        app_name: "AI Assistant",
        welcome_message: "Hello! How can I help you today?",
        logging_level: "info",
        auto_cleanup_days: 30,
        enable_file_uploads: true,
        enable_voice_input: true,
      };
      
      // Override with database values
      data.forEach((setting) => {
        settingsObj[setting.key] = setting.value;
      });
      
      setSettings(settingsObj);
      addLog('success', 'Settings loaded successfully');
    }
  };

  const loadStats = async () => {
    addLog('info', 'Loading statistics...');
    
    // Get total users
    const { count: totalUsers } = await supabase
      .from("user_roles")
      .select("*", { count: "exact", head: true });

    // Get users active today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const { count: activeToday } = await supabase
      .from("messages")
      .select("user_id", { count: "exact", head: true })
      .gte("created_at", today.toISOString());

    // Get total messages
    const { count: totalMessages } = await supabase
      .from("messages")
      .select("*", { count: "exact", head: true });

    // Get total conversations
    const { count: totalConversations } = await supabase
      .from("conversations")
      .select("*", { count: "exact", head: true });

    setStats({
      totalUsers: totalUsers || 0,
      activeToday: activeToday || 0,
      totalMessages: totalMessages || 0,
      totalConversations: totalConversations || 0,
    });
    
    addLog('success', `Statistics loaded: ${totalUsers} users, ${totalMessages} messages`);
  };

  const loadUsers = async () => {
    setLoadingUsers(true);
    addLog('info', 'Loading users...');
    try {
      const { data: userRoles, error } = await supabase
        .from("user_roles")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      if (userRoles) {
        // Fetch emails for all users
        const usersWithEmails = await Promise.all(
          userRoles.map(async (userRole) => {
            const { data: emailData } = await supabase
              .rpc("get_user_email", { _user_id: userRole.user_id });
            
            return {
              ...userRole,
              email: emailData || "Unknown",
            };
          })
        );

        setUsers(usersWithEmails);
        addLog('success', `Loaded ${usersWithEmails.length} users`);
      }
    } catch (error) {
      toast.error("Failed to load users");
      addLog('error', `Failed to load users: ${error}`);
      console.error(error);
    } finally {
      setLoadingUsers(false);
    }
  };

  const handleRoleChange = async (userId: string, newRole: 'owner' | 'guest') => {
    addLog('info', `Changing role for user ${userId} to ${newRole}...`);
    try {
      const { error } = await supabase
        .from("user_roles")
        .update({ role: newRole })
        .eq("user_id", userId);

      if (error) throw error;

      toast.success("Role updated successfully");
      addLog('success', `Role changed to ${newRole} for user ${userId}`);
      await loadUsers();
      await loadStats();
    } catch (error) {
      toast.error("Failed to update role");
      addLog('error', `Failed to update role: ${error}`);
      console.error(error);
    }
  };

  const handleDeleteUser = async (userId: string, userEmail: string) => {
    if (!confirm(`Are you sure you want to delete user ${userEmail}? This action cannot be undone.`)) {
      return;
    }

    addLog('warning', `Deleting user ${userEmail}...`);
    try {
      // Delete from user_roles (RLS will prevent deletion of owner by others)
      const { error: roleError } = await supabase
        .from("user_roles")
        .delete()
        .eq("user_id", userId);

      if (roleError) throw roleError;

      // Note: Deleting from auth.users requires admin privileges
      // We can only delete the role record here
      toast.success("User removed successfully");
      addLog('success', `User ${userEmail} removed from system`);
      await loadUsers();
      await loadStats();
    } catch (error) {
      toast.error("Failed to delete user");
      addLog('error', `Failed to delete user: ${error}`);
      console.error(error);
    }
  };

  const handleSaveSettings = async () => {
    setSaving(true);
    addLog('info', 'Saving settings...');
    try {
      const updates = Object.entries(settings).map(([key, value]) => ({
        key,
        value,
      }));

      for (const update of updates) {
        await supabase
          .from("app_settings")
          .upsert(update, { onConflict: "key" });
      }

      toast.success("Settings saved successfully");
      addLog('success', 'Settings saved successfully');
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

  return (
    <div className="min-h-screen bg-background">
      <ScrollArea className="h-screen">
        <div className="container mx-auto p-6 max-w-7xl">
          <div className="mb-8">
            <Button 
              variant="ghost" 
              onClick={() => navigate("/")}
              className="mb-4"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Chat
            </Button>
            <h1 className="text-4xl font-bold mb-2">Developer Dashboard</h1>
            <p className="text-muted-foreground">
              Manage your AI chatbot application settings and monitor usage
            </p>
          </div>

          <Tabs defaultValue="overview" className="space-y-6">
            <TabsList>
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
                  <span>AI Models</span>
                </div>
                <span className="text-sm font-medium text-green-600">
                  2 Active (deepseek-v3.1, qwen3-vl)
                </span>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

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

        <TabsContent value="settings" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Application Settings</CardTitle>
              <CardDescription>
                Configure general application behavior and branding
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
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
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>AI Model Configuration</CardTitle>
              <CardDescription>
                Select and configure the default AI model
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
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
                  <option value="google/gemini-2.0-flash-exp:free">Gemini 2.0 Flash (Fast)</option>
                  <option value="deepseek/deepseek-r1:free">DeepSeek R1 (Reasoning)</option>
                  <option value="qwen/qwen-2.5-72b-instruct:free">Qwen 2.5 (Balanced)</option>
                </select>
                <p className="text-xs text-muted-foreground">
                  This model will be used by default for new conversations
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Feature Toggles</CardTitle>
              <CardDescription>
                Enable or disable application features
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
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
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Rate Limiting</CardTitle>
              <CardDescription>
                Control API request limits for guest users (Owner account is unlimited)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
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
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Message & Upload Limits</CardTitle>
              <CardDescription>
                Configure message and file upload restrictions
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
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
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>System Maintenance</CardTitle>
              <CardDescription>
                Configure automatic cleanup and logging
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
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
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Session & User Limits</CardTitle>
              <CardDescription>
                Configure session timeouts and user-specific limits
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="session-timeout">Session Timeout (minutes)</Label>
                <Input
                  id="session-timeout"
                  type="number"
                  value={settings.session_timeout_minutes}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      session_timeout_minutes: parseInt(e.target.value),
                    })
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Automatically sign out inactive users after this duration
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="max-conversations">Max Conversations Per User</Label>
                <Input
                  id="max-conversations"
                  type="number"
                  value={settings.max_conversations_per_user}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      max_conversations_per_user: parseInt(e.target.value),
                    })
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Maximum number of conversations each user can create (0 = unlimited)
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>UI & Display Settings</CardTitle>
              <CardDescription>
                Configure user interface and rendering options
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="enable-markdown">Markdown Rendering</Label>
                  <p className="text-sm text-muted-foreground">
                    Enable markdown formatting in messages
                  </p>
                </div>
                <Switch
                  id="enable-markdown"
                  checked={settings.enable_markdown}
                  onCheckedChange={(checked) =>
                    setSettings({ ...settings, enable_markdown: checked })
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="enable-code">Code Highlighting</Label>
                  <p className="text-sm text-muted-foreground">
                    Enable syntax highlighting for code blocks
                  </p>
                </div>
                <Switch
                  id="enable-code"
                  checked={settings.enable_code_highlighting}
                  onCheckedChange={(checked) =>
                    setSettings({ ...settings, enable_code_highlighting: checked })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="theme-mode">Default Theme</Label>
                <select
                  id="theme-mode"
                  className="w-full h-10 px-3 rounded-md border border-input bg-background"
                  value={settings.theme_mode}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      theme_mode: e.target.value,
                    })
                  }
                >
                  <option value="light">Light</option>
                  <option value="dark">Dark</option>
                  <option value="system">System (Auto)</option>
                </select>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Analytics & Notifications</CardTitle>
              <CardDescription>
                Configure tracking and notification settings
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="enable-analytics">Analytics Tracking</Label>
                  <p className="text-sm text-muted-foreground">
                    Track usage statistics and user behavior
                  </p>
                </div>
                <Switch
                  id="enable-analytics"
                  checked={settings.enable_analytics}
                  onCheckedChange={(checked) =>
                    setSettings({ ...settings, enable_analytics: checked })
                  }
                />
              </div>

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
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Backup & Data Management</CardTitle>
              <CardDescription>
                Configure automatic backup frequency
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
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

              <div className="flex gap-2">
                <Button variant="outline" className="flex-1">
                  Create Backup Now
                </Button>
                <Button variant="outline" className="flex-1">
                  Export All Data
                </Button>
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end gap-3">
            <Button 
              variant="outline"
              onClick={loadSettings}
            >
              Reset Changes
            </Button>
            <Button onClick={handleSaveSettings} disabled={saving}>
              {saving ? "Saving..." : "Save All Settings"}
            </Button>
          </div>
        </TabsContent>

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
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <p>
                    Showing {users.filter(user => {
                      const matchesSearch = user.email.toLowerCase().includes(userSearchQuery.toLowerCase());
                      const matchesRole = userRoleFilter === "all" || user.role === userRoleFilter;
                      return matchesSearch && matchesRole;
                    }).length} of {users.length} users
                  </p>
                  {(userSearchQuery || userRoleFilter !== "all") && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setUserSearchQuery("");
                        setUserRoleFilter("all");
                      }}
                    >
                      Clear Filters
                    </Button>
                  )}
                </div>
              </div>

              {loadingUsers ? (
                <div className="text-center py-8 text-muted-foreground">
                  Loading users...
                </div>
              ) : users.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No users found
                </div>
              ) : (() => {
                const filteredUsers = users.filter(user => {
                  const matchesSearch = user.email.toLowerCase().includes(userSearchQuery.toLowerCase());
                  const matchesRole = userRoleFilter === "all" || user.role === userRoleFilter;
                  return matchesSearch && matchesRole;
                });

                return filteredUsers.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No users match your filters
                  </div>
                ) : (
                  <div className="rounded-md border">
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b bg-muted/50">
                            <th className="px-4 py-3 text-left text-sm font-medium">Email</th>
                            <th className="px-4 py-3 text-left text-sm font-medium">Role</th>
                            <th className="px-4 py-3 text-left text-sm font-medium">Registered</th>
                            <th className="px-4 py-3 text-right text-sm font-medium">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredUsers.map((user) => (
                            <tr key={user.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                              <td className="px-4 py-3 text-sm font-medium">{user.email}</td>
                              <td className="px-4 py-3 text-sm">
                                <select
                                  value={user.role}
                                  onChange={(e) => handleRoleChange(user.user_id, e.target.value as 'owner' | 'guest')}
                                  className="px-2 py-1 rounded-md border border-input bg-background text-sm"
                                  disabled={user.email === 'jaidonfigueroa0@gmail.com'}
                                >
                                  <option value="owner">Owner</option>
                                  <option value="guest">Guest</option>
                                </select>
                              </td>
                              <td className="px-4 py-3 text-sm text-muted-foreground">
                                {new Date(user.created_at).toLocaleDateString('en-US', {
                                  year: 'numeric',
                                  month: 'short',
                                  day: 'numeric'
                                })}
                              </td>
                              <td className="px-4 py-3 text-right">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDeleteUser(user.user_id, user.email)}
                                  disabled={user.email === 'jaidonfigueroa0@gmail.com'}
                                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                >
                                  Delete
                                </Button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })()}

              <div className="mt-4 p-4 rounded-md bg-muted/50">
                <p className="text-xs text-muted-foreground">
                  <strong>Note:</strong> The owner account (jaidonfigueroa0@gmail.com) cannot be deleted or have its role changed for security reasons.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Security Overview</CardTitle>
              <CardDescription>
                Monitor security status and policies
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span>Row Level Security (RLS)</span>
                <span className="text-sm font-medium text-green-600">Enabled</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Storage Access Control</span>
                <span className="text-sm font-medium text-green-600">Owner-Only</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Authentication</span>
                <span className="text-sm font-medium text-green-600">Active</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Owner Account</span>
                <span className="text-sm font-medium text-blue-600">
                  jaidonfigueroa0@gmail.com
                </span>
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
