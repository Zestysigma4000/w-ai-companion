import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Settings, Database, Users, Activity, Shield } from "lucide-react";

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

  useEffect(() => {
    checkOwnerStatus();
  }, []);

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
    const { data } = await supabase
      .from("app_settings")
      .select("key, value");

    if (data) {
      const settingsObj: any = {};
      data.forEach((setting) => {
        settingsObj[setting.key] = setting.value;
      });
      setSettings(settingsObj);
    }
  };

  const loadStats = async () => {
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
  };

  const handleSaveSettings = async () => {
    setSaving(true);
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
    } catch (error) {
      toast.error("Failed to save settings");
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
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="mb-8">
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
  );
};

export default Developer;
