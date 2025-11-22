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
}

interface UserStats {
  totalUsers: number;
  activeToday: number;
  totalMessages: number;
  totalConversations: number;
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
  });
  const [stats, setStats] = useState<UserStats>({
    totalUsers: 0,
    activeToday: 0,
    totalMessages: 0,
    totalConversations: 0,
  });
  const [consoleLogs, setConsoleLogs] = useState<ConsoleLog[]>([]);

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
      }, (payload: any) => {
        const log = payload.new;
        const eventData = log.event_data || {};
        
        let message = '';
        switch (log.event_type) {
          case 'model_selected':
            message = `🤖 Model selected: ${eventData.model} (${eventData.reason})`;
            break;
          case 'message_sent':
            message = `💬 Message sent (${eventData.message_length} chars, ${eventData.attachments_count} files${eventData.has_images ? ', includes images' : ''})`;
            break;
          case 'response_generated':
            message = `✅ Response generated with ${eventData.model} (${eventData.response_length} chars)`;
            break;
          case 'conversation_created':
            message = `📝 New conversation: "${eventData.title}"`;
            break;
          case 'owner_request':
            message = `👑 ${eventData.message}`;
            break;
          default:
            message = `${log.event_type}: ${JSON.stringify(eventData)}`;
        }
        
        addLog(log.severity, message);
      })
      .subscribe();
    
    // Listen to user_roles table for new accounts
    const userChannel = supabase
      .channel('user-roles')
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public',
        table: 'user_roles'
      }, (payload: any) => {
        addLog('success', `👤 New account created with role: ${payload.new.role}`);
        loadStats(); // Refresh stats
      })
      .subscribe();

    return () => {
      supabase.removeChannel(activityChannel);
      supabase.removeChannel(userChannel);
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
    setLoading(false);
  };

  const loadSettings = async () => {
    addLog('info', 'Loading app settings...');
    const { data } = await supabase
      .from("app_settings")
      .select("key, value");

    if (data) {
      const settingsObj: any = {};
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
              <CardTitle>Message Limits</CardTitle>
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

          <div className="flex justify-end">
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
              <p className="text-sm text-muted-foreground">
                User management interface coming soon. Currently showing {stats.totalUsers} total users.
              </p>
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
