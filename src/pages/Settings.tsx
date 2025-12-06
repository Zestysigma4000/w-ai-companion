import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { ArrowLeft, Smartphone, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { ThemeSwitcher } from "@/components/ThemeSwitcher";
import { InstallAppButton } from "@/components/PWAInstallPrompt";
import { useUserSettings } from "@/hooks/useUserSettings";

const Settings = () => {
  const navigate = useNavigate();
  const {
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
  } = useUserSettings();

  const [isDeleting, setIsDeleting] = useState(false);

  const handleDeleteAllConversations = async () => {
    setIsDeleting(true);
    await deleteAllConversations();
    setIsDeleting(false);
  };

  if (loading) {
    return (
      <div className="h-[100dvh] flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

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
            {/* Install App Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Smartphone className="w-5 h-5" />
                  Install App
                </CardTitle>
                <CardDescription>
                  Install W ai on your device for the best experience
                </CardDescription>
              </CardHeader>
              <CardContent>
                <InstallAppButton />
              </CardContent>
            </Card>

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
                    checked={settings.notifications}
                    onCheckedChange={(value) => updateSetting('notifications', value)}
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
                    checked={settings.soundEnabled}
                    onCheckedChange={(value) => updateSetting('soundEnabled', value)}
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
                    checked={settings.autoSave}
                    onCheckedChange={(value) => updateSetting('autoSave', value)}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Send on Enter</Label>
                    <p className="text-sm text-muted-foreground">
                      Press Enter to send messages
                    </p>
                  </div>
                  <Switch
                    checked={settings.sendOnEnter}
                    onCheckedChange={(value) => updateSetting('sendOnEnter', value)}
                  />
                </div>

                <Separator />

                <div className="space-y-2">
                  <Label>Language</Label>
                  <Select 
                    value={settings.language} 
                    onValueChange={(value) => updateSetting('language', value)}
                  >
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
                  <Select 
                    value={settings.timezone}
                    onValueChange={(value) => updateSetting('timezone', value)}
                  >
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
                  <Select 
                    value={settings.fontSize} 
                    onValueChange={(value) => updateSetting('fontSize', value)}
                  >
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
                  <Select 
                    value={settings.messageDensity}
                    onValueChange={(value) => updateSetting('messageDensity', value)}
                  >
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
                    checked={settings.compactMode}
                    onCheckedChange={(value) => updateSetting('compactMode', value)}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Enable Animations</Label>
                    <p className="text-sm text-muted-foreground">
                      Smooth transitions and effects
                    </p>
                  </div>
                  <Switch
                    checked={settings.enableAnimations}
                    onCheckedChange={(value) => updateSetting('enableAnimations', value)}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>High Contrast</Label>
                    <p className="text-sm text-muted-foreground">
                      Increase contrast for better visibility
                    </p>
                  </div>
                  <Switch
                    checked={settings.highContrast}
                    onCheckedChange={(value) => updateSetting('highContrast', value)}
                  />
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
                  <Switch
                    checked={settings.shareUsageData}
                    onCheckedChange={(value) => updateSetting('shareUsageData', value)}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Save Conversation History</Label>
                    <p className="text-sm text-muted-foreground">
                      Store conversations on the server
                    </p>
                  </div>
                  <Switch
                    checked={settings.saveConversationHistory}
                    onCheckedChange={(value) => updateSetting('saveConversationHistory', value)}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Personalized Experience</Label>
                    <p className="text-sm text-muted-foreground">
                      Use your data to improve recommendations
                    </p>
                  </div>
                  <Switch
                    checked={settings.personalizedExperience}
                    onCheckedChange={(value) => updateSetting('personalizedExperience', value)}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Send Crash Reports</Label>
                    <p className="text-sm text-muted-foreground">
                      Automatically send error reports
                    </p>
                  </div>
                  <Switch
                    checked={settings.sendCrashReports}
                    onCheckedChange={(value) => updateSetting('sendCrashReports', value)}
                  />
                </div>

                <Separator />

                <div className="space-y-2">
                  <Button 
                    variant="outline" 
                    className="w-full justify-start"
                    onClick={exportData}
                  >
                    Export My Data
                  </Button>
                  <Button 
                    variant="outline" 
                    className="w-full justify-start"
                    onClick={downloadConversations}
                  >
                    Download Conversations
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive" className="w-full justify-start">
                        Delete All Conversations
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This action cannot be undone. This will permanently delete all your conversations and messages.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={handleDeleteAllConversations}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          disabled={isDeleting}
                        >
                          {isDeleting ? (
                            <>
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              Deleting...
                            </>
                          ) : (
                            'Delete All'
                          )}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
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
                    <div className="space-y-0.5">
                      <Label>Developer Mode</Label>
                      <p className="text-sm text-muted-foreground">
                        Enable developer features
                      </p>
                    </div>
                    <Switch
                      checked={settings.developerMode}
                      onCheckedChange={(value) => updateSetting('developerMode', value)}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Experimental Features</Label>
                      <p className="text-sm text-muted-foreground">
                        Try new features before release
                      </p>
                    </div>
                    <Switch
                      checked={settings.experimentalFeatures}
                      onCheckedChange={(value) => updateSetting('experimentalFeatures', value)}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Debug Mode</Label>
                      <p className="text-sm text-muted-foreground">
                        Show debug information
                      </p>
                    </div>
                    <Switch
                      checked={settings.debugMode}
                      onCheckedChange={(value) => updateSetting('debugMode', value)}
                    />
                  </div>
                  <Separator />
                  <div className="space-y-2">
                    <Label>Max Tokens per Request</Label>
                    <Input
                      type="number"
                      value={settings.maxTokens}
                      onChange={(e) => updateSetting('maxTokens', parseInt(e.target.value) || 4096)}
                      min={100}
                      max={100000}
                    />
                    <p className="text-xs text-muted-foreground">
                      Maximum number of tokens in AI responses (100-100000)
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label>AI Temperature ({settings.temperature})</Label>
                    <Input
                      type="number"
                      value={settings.temperature}
                      onChange={(e) => updateSetting('temperature', parseFloat(e.target.value) || 0.7)}
                      min={0}
                      max={2}
                      step={0.1}
                    />
                    <p className="text-xs text-muted-foreground">
                      Controls randomness: 0 = focused, 2 = creative
                    </p>
                  </div>
                  <Separator />
                  <div className="space-y-2">
                    <Button 
                      variant="outline" 
                      className="w-full justify-start"
                      onClick={clearCache}
                    >
                      Clear Cache
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="outline" className="w-full justify-start">
                          Reset to Defaults
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Reset all settings?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will reset all settings to their default values. Your conversations will not be affected.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={resetToDefaults}>
                            Reset Settings
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <div className="mt-6 flex justify-end gap-2">
          {hasChanges && (
            <p className="text-sm text-muted-foreground self-center mr-2">
              You have unsaved changes
            </p>
          )}
          <Button 
            onClick={saveSettings}
            className="bg-gradient-primary hover:opacity-90 text-white"
            disabled={!hasChanges}
          >
            Save Changes
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Settings;
