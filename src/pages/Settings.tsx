import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { ThemeSwitcher } from "@/components/ThemeSwitcher";

const Settings = () => {
  const navigate = useNavigate();
  const [temperature, setTemperature] = useState([0.7]);
  const [maxTokens, setMaxTokens] = useState([2000]);
  const [autoSave, setAutoSave] = useState(true);
  const [darkMode, setDarkMode] = useState(true);
  const [notifications, setNotifications] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [language, setLanguage] = useState("en");
  const [fontSize, setFontSize] = useState("medium");
  const [compactMode, setCompactMode] = useState(false);

  const handleSave = () => {
    toast.success("Settings saved successfully!");
  };

  return (
    <div className="h-[100dvh] overflow-y-auto bg-background safe-area-inset">
      <div className="max-w-4xl mx-auto p-4 md:p-6 pb-24">
        <div className="mb-6">
          <Button 
            variant="ghost" 
            onClick={() => navigate("/")}
            className="mb-4 min-h-[44px]"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Chat
          </Button>
          <h1 className="text-2xl md:text-3xl font-bold gradient-text">Settings</h1>
          <p className="text-muted-foreground mt-2 text-sm md:text-base">
            Customize your W ai experience
          </p>
        </div>

        <Tabs defaultValue="general" className="space-y-4">
          <TabsList className="grid w-full grid-cols-2 md:grid-cols-4 h-auto">
            <TabsTrigger value="general" className="text-xs md:text-sm py-2.5">General</TabsTrigger>
            <TabsTrigger value="appearance" className="text-xs md:text-sm py-2.5">Appearance</TabsTrigger>
            <TabsTrigger value="privacy" className="text-xs md:text-sm py-2.5">Privacy</TabsTrigger>
            <TabsTrigger value="advanced" className="text-xs md:text-sm py-2.5">Advanced</TabsTrigger>
          </TabsList>

          <TabsContent value="general" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>General Settings</CardTitle>
                <CardDescription>
                  Manage your general preferences
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Enable Notifications</Label>
                    <p className="text-sm text-muted-foreground">
                      Get notified when AI responds
                    </p>
                  </div>
                  <Switch
                    checked={notifications}
                    onCheckedChange={setNotifications}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Sound Effects</Label>
                    <p className="text-sm text-muted-foreground">
                      Play sounds for notifications
                    </p>
                  </div>
                  <Switch
                    checked={soundEnabled}
                    onCheckedChange={setSoundEnabled}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Auto-save Conversations</Label>
                    <p className="text-sm text-muted-foreground">
                      Automatically save your conversations
                    </p>
                  </div>
                  <Switch
                    checked={autoSave}
                    onCheckedChange={setAutoSave}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Send on Enter</Label>
                    <p className="text-sm text-muted-foreground">
                      Press Enter to send messages
                    </p>
                  </div>
                  <Switch defaultChecked={true} />
                </div>

                <Separator />

                <div className="space-y-2">
                  <Label>Language</Label>
                  <Select value={language} onValueChange={setLanguage}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="en">English</SelectItem>
                      <SelectItem value="es">Español</SelectItem>
                      <SelectItem value="fr">Français</SelectItem>
                      <SelectItem value="de">Deutsch</SelectItem>
                      <SelectItem value="zh">中文</SelectItem>
                      <SelectItem value="ja">日本語</SelectItem>
                      <SelectItem value="it">Italiano</SelectItem>
                      <SelectItem value="pt">Português</SelectItem>
                      <SelectItem value="ko">한국어</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Timezone</Label>
                  <Select defaultValue="utc">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="utc">UTC</SelectItem>
                      <SelectItem value="ny">America/New_York</SelectItem>
                      <SelectItem value="la">America/Los_Angeles</SelectItem>
                      <SelectItem value="london">Europe/London</SelectItem>
                      <SelectItem value="tokyo">Asia/Tokyo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="appearance" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Appearance</CardTitle>
                <CardDescription>
                  Customize the look and feel
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Font Size</Label>
                  <Select value={fontSize} onValueChange={setFontSize}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="small">Small</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="large">Large</SelectItem>
                      <SelectItem value="xlarge">Extra Large</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Message Density</Label>
                  <Select defaultValue="comfortable">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="comfortable">Comfortable</SelectItem>
                      <SelectItem value="compact">Compact</SelectItem>
                      <SelectItem value="spacious">Spacious</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Compact Mode</Label>
                    <p className="text-sm text-muted-foreground">
                      Reduce spacing for more content
                    </p>
                  </div>
                  <Switch
                    checked={compactMode}
                    onCheckedChange={setCompactMode}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Enable Animations</Label>
                    <p className="text-sm text-muted-foreground">
                      Smooth transitions and effects
                    </p>
                  </div>
                  <Switch defaultChecked={true} />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>High Contrast</Label>
                    <p className="text-sm text-muted-foreground">
                      Increase contrast for better visibility
                    </p>
                  </div>
                  <Switch defaultChecked={false} />
                </div>

                <Separator />

                <div className="space-y-2">
                  <Label>Theme</Label>
                  <ThemeSwitcher />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="privacy" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Privacy & Data</CardTitle>
                <CardDescription>
                  Control your data and privacy settings
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Share Usage Data</Label>
                    <p className="text-sm text-muted-foreground">
                      Help improve W ai by sharing anonymous usage data
                    </p>
                  </div>
                  <Switch defaultChecked={false} />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Save Conversation History</Label>
                    <p className="text-sm text-muted-foreground">
                      Store conversations on the server
                    </p>
                  </div>
                  <Switch defaultChecked={true} />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Personalized Experience</Label>
                    <p className="text-sm text-muted-foreground">
                      Use your data to improve recommendations
                    </p>
                  </div>
                  <Switch defaultChecked={true} />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Send Crash Reports</Label>
                    <p className="text-sm text-muted-foreground">
                      Automatically send error reports
                    </p>
                  </div>
                  <Switch defaultChecked={true} />
                </div>

                <Separator />

                <div className="space-y-2">
                  <Button variant="outline" className="w-full justify-start">
                    Export My Data
                  </Button>
                  <Button variant="outline" className="w-full justify-start">
                    Download Conversations
                  </Button>
                  <Button variant="destructive" className="w-full justify-start">
                    Delete All Conversations
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="advanced">
            <Card>
              <CardHeader>
                <CardTitle>Advanced Settings</CardTitle>
                <CardDescription>
                  Advanced configuration options for power users
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="developer-mode">Developer Mode</Label>
                    <Switch id="developer-mode" />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="experimental">Experimental Features</Label>
                    <Switch id="experimental" />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="debug-mode">Debug Mode</Label>
                    <Switch id="debug-mode" />
                  </div>
                  <Separator />
                  <div className="space-y-2">
                    <Label htmlFor="api-endpoint">API Endpoint</Label>
                    <input
                      id="api-endpoint"
                      type="text"
                      placeholder="https://api.example.com"
                      className="w-full px-3 py-2 bg-muted border border-border rounded-md"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="max-tokens">Max Tokens per Request</Label>
                    <input
                      id="max-tokens"
                      type="number"
                      placeholder="4096"
                      className="w-full px-3 py-2 bg-muted border border-border rounded-md"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="temperature">AI Temperature</Label>
                    <input
                      id="temperature"
                      type="number"
                      step="0.1"
                      min="0"
                      max="2"
                      placeholder="0.7"
                      className="w-full px-3 py-2 bg-muted border border-border rounded-md"
                    />
                  </div>
                  <Separator />
                  <div className="space-y-4">
                    <Button variant="outline" className="w-full justify-start">
                      Clear Cache
                    </Button>
                    <Button variant="outline" className="w-full justify-start">
                      Reset to Defaults
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <div className="mt-6 flex justify-end">
          <Button 
            onClick={handleSave}
            className="bg-gradient-primary hover:opacity-90 text-white"
          >
            Save Changes
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Settings;
