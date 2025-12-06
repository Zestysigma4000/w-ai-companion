import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Download, X, Share, Plus, Smartphone, Check, Menu, MoreVertical } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

declare global {
  interface WindowEventMap {
    beforeinstallprompt: BeforeInstallPromptEvent;
  }
}

type BrowserType = 'chrome' | 'firefox' | 'opera' | 'safari' | 'edge' | 'samsung' | 'other';

// Detect browser
const detectBrowser = (): BrowserType => {
  if (typeof navigator === 'undefined') return 'other';
  const ua = navigator.userAgent.toLowerCase();
  
  if (ua.includes('opr') || ua.includes('opera')) return 'opera';
  if (ua.includes('firefox') || ua.includes('fxios')) return 'firefox';
  if (ua.includes('edg')) return 'edge';
  if (ua.includes('samsungbrowser')) return 'samsung';
  if (ua.includes('safari') && !ua.includes('chrome')) return 'safari';
  if (ua.includes('chrome')) return 'chrome';
  return 'other';
};

// Detect iOS
const isIOS = () => {
  if (typeof navigator === 'undefined') return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
};

// Detect Android
const isAndroid = () => {
  if (typeof navigator === 'undefined') return false;
  return /android/i.test(navigator.userAgent);
};

// Detect if running as standalone PWA
const isStandalone = () => {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(display-mode: standalone)').matches || 
         (window.navigator as any).standalone === true;
};

// Store the deferred prompt globally so it persists across component instances
let globalDeferredPrompt: BeforeInstallPromptEvent | null = null;

// Listen for the event at the module level
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    globalDeferredPrompt = e;
    // Dispatch custom event so components can react
    window.dispatchEvent(new CustomEvent('pwainstallready'));
  });
}

export function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(globalDeferredPrompt);
  const [showPrompt, setShowPrompt] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [isIOSDevice, setIsIOSDevice] = useState(false);

  useEffect(() => {
    // Don't show if already installed
    if (isStandalone()) {
      return;
    }

    // Check if already dismissed this session
    const wasDismissed = sessionStorage.getItem('pwa-install-dismissed');
    if (wasDismissed) {
      setDismissed(true);
      return;
    }

    // Check for iOS
    if (isIOS()) {
      setIsIOSDevice(true);
      // Show iOS prompt after a delay
      const timer = setTimeout(() => setShowPrompt(true), 3000);
      return () => clearTimeout(timer);
    }

    // Check if we already have the deferred prompt
    if (globalDeferredPrompt) {
      setDeferredPrompt(globalDeferredPrompt);
      const timer = setTimeout(() => setShowPrompt(true), 3000);
      return () => clearTimeout(timer);
    }

    // Listen for the custom event
    const handleInstallReady = () => {
      setDeferredPrompt(globalDeferredPrompt);
      setTimeout(() => setShowPrompt(true), 3000);
    };

    window.addEventListener('pwainstallready', handleInstallReady);

    return () => {
      window.removeEventListener('pwainstallready', handleInstallReady);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    try {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;

      if (outcome === 'accepted') {
        setShowPrompt(false);
        globalDeferredPrompt = null;
      }
    } catch (error) {
      console.error('Install prompt error:', error);
    }
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    setDismissed(true);
    sessionStorage.setItem('pwa-install-dismissed', 'true');
  };

  if (!showPrompt || dismissed) return null;
  
  // Don't show if no install method available (non-iOS without beforeinstallprompt)
  if (!isIOSDevice && !deferredPrompt) return null;

  return (
    <div className="fixed bottom-20 left-4 right-4 md:left-auto md:right-4 md:w-96 z-50 animate-slide-in-right safe-area-bottom">
      <div className="bg-card border border-border rounded-xl p-4 shadow-xl backdrop-blur-sm">
        <div className="flex items-start gap-3">
          <div className="w-12 h-12 bg-gradient-primary rounded-xl flex items-center justify-center flex-shrink-0 glow-primary">
            <Smartphone className="w-6 h-6 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-foreground">Install W ai</h3>
            <p className="text-sm text-muted-foreground mt-0.5">
              {isIOSDevice 
                ? "Add to your home screen for the best experience"
                : "Install for faster access and offline support"
              }
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 -mt-1 -mr-1 hover:bg-muted"
            onClick={handleDismiss}
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
        
        {isIOSDevice ? (
          <div className="mt-4 space-y-3">
            <div className="flex items-center gap-3 text-sm text-muted-foreground bg-muted/50 rounded-lg p-3">
              <div className="flex items-center gap-2">
                <span className="font-medium text-foreground">1.</span>
                <span>Tap</span>
                <Share className="w-4 h-4 text-primary" />
                <span>Share</span>
              </div>
            </div>
            <div className="flex items-center gap-3 text-sm text-muted-foreground bg-muted/50 rounded-lg p-3">
              <div className="flex items-center gap-2">
                <span className="font-medium text-foreground">2.</span>
                <span>Tap</span>
                <Plus className="w-4 h-4 text-primary" />
                <span>Add to Home Screen</span>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="w-full mt-2"
              onClick={handleDismiss}
            >
              Got it
            </Button>
          </div>
        ) : (
          <div className="flex gap-2 mt-4">
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={handleDismiss}
            >
              Not now
            </Button>
            <Button
              size="sm"
              className="flex-1 bg-gradient-primary hover:opacity-90 text-white glow-primary"
              onClick={handleInstall}
            >
              <Download className="w-4 h-4 mr-2" />
              Install
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

// Export a manual install button for settings page
export function InstallAppButton() {
  const [canInstall, setCanInstall] = useState(!!globalDeferredPrompt);
  const [isIOSDevice, setIsIOSDevice] = useState(false);
  const [isAndroidDevice, setIsAndroidDevice] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [browser, setBrowser] = useState<BrowserType>('other');

  useEffect(() => {
    setIsInstalled(isStandalone());
    setIsIOSDevice(isIOS());
    setIsAndroidDevice(isAndroid());
    setBrowser(detectBrowser());
    setCanInstall(!!globalDeferredPrompt);

    const handleInstallReady = () => {
      setCanInstall(true);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setCanInstall(false);
    };

    window.addEventListener('pwainstallready', handleInstallReady);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('pwainstallready', handleInstallReady);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstall = async () => {
    if (!globalDeferredPrompt) return;
    
    setInstalling(true);
    try {
      await globalDeferredPrompt.prompt();
      const { outcome } = await globalDeferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setCanInstall(false);
        globalDeferredPrompt = null;
      }
    } catch (error) {
      console.error('Install error:', error);
    } finally {
      setInstalling(false);
    }
  };

  if (isInstalled) {
    return (
      <div className="flex items-center gap-2 text-sm text-primary bg-primary/10 px-4 py-3 rounded-lg">
        <Check className="w-5 h-5" />
        <span className="font-medium">App is installed!</span>
      </div>
    );
  }

  // iOS Safari instructions
  if (isIOSDevice) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">To install on iOS/Safari:</p>
        <div className="space-y-2">
          <div className="flex items-center gap-3 text-sm bg-muted/50 rounded-lg p-3">
            <span className="font-medium text-foreground">1.</span>
            <Share className="w-4 h-4 text-primary" />
            <span>Tap the Share button in Safari</span>
          </div>
          <div className="flex items-center gap-3 text-sm bg-muted/50 rounded-lg p-3">
            <span className="font-medium text-foreground">2.</span>
            <Plus className="w-4 h-4 text-primary" />
            <span>Tap "Add to Home Screen"</span>
          </div>
        </div>
      </div>
    );
  }

  // If we have the install prompt available (Chrome, Edge, Opera on Android/desktop)
  if (canInstall) {
    return (
      <Button
        onClick={handleInstall}
        disabled={installing}
        className="bg-gradient-primary hover:opacity-90 text-white w-full sm:w-auto"
      >
        {installing ? (
          <>
            <div className="w-4 h-4 mr-2 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            Installing...
          </>
        ) : (
          <>
            <Download className="w-4 h-4 mr-2" />
            Install App
          </>
        )}
      </Button>
    );
  }

  // Firefox Android instructions
  if (browser === 'firefox' && isAndroidDevice) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">To install on Firefox for Android:</p>
        <div className="space-y-2">
          <div className="flex items-center gap-3 text-sm bg-muted/50 rounded-lg p-3">
            <span className="font-medium text-foreground">1.</span>
            <MoreVertical className="w-4 h-4 text-primary" />
            <span>Tap the menu button (⋮)</span>
          </div>
          <div className="flex items-center gap-3 text-sm bg-muted/50 rounded-lg p-3">
            <span className="font-medium text-foreground">2.</span>
            <Plus className="w-4 h-4 text-primary" />
            <span>Tap "Install"</span>
          </div>
        </div>
      </div>
    );
  }

  // Firefox Desktop - doesn't support PWA installation
  if (browser === 'firefox' && !isAndroidDevice) {
    return (
      <div className="text-sm text-muted-foreground bg-muted/50 p-4 rounded-lg">
        <p className="font-medium mb-2">Firefox Desktop Limitation</p>
        <p>Firefox on desktop doesn't support app installation. To install this app, please use:</p>
        <ul className="list-disc list-inside mt-2 space-y-1">
          <li>Chrome, Edge, or Opera on desktop</li>
          <li>Firefox, Chrome, or Samsung Internet on Android</li>
          <li>Safari on iOS</li>
        </ul>
      </div>
    );
  }

  // Opera instructions (if beforeinstallprompt didn't fire)
  if (browser === 'opera') {
    return (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">To install on Opera:</p>
        <div className="space-y-2">
          <div className="flex items-center gap-3 text-sm bg-muted/50 rounded-lg p-3">
            <span className="font-medium text-foreground">1.</span>
            <Menu className="w-4 h-4 text-primary" />
            <span>Click the menu button</span>
          </div>
          <div className="flex items-center gap-3 text-sm bg-muted/50 rounded-lg p-3">
            <span className="font-medium text-foreground">2.</span>
            <Plus className="w-4 h-4 text-primary" />
            <span>Click "Install app" or "Add to Home screen"</span>
          </div>
        </div>
      </div>
    );
  }

  // Samsung Internet
  if (browser === 'samsung') {
    return (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">To install on Samsung Internet:</p>
        <div className="space-y-2">
          <div className="flex items-center gap-3 text-sm bg-muted/50 rounded-lg p-3">
            <span className="font-medium text-foreground">1.</span>
            <Menu className="w-4 h-4 text-primary" />
            <span>Tap the menu button</span>
          </div>
          <div className="flex items-center gap-3 text-sm bg-muted/50 rounded-lg p-3">
            <span className="font-medium text-foreground">2.</span>
            <Plus className="w-4 h-4 text-primary" />
            <span>Tap "Add page to" → "Home screen"</span>
          </div>
        </div>
      </div>
    );
  }

  // Generic fallback
  return (
    <div className="text-sm text-muted-foreground bg-muted/50 p-4 rounded-lg">
      <p className="font-medium mb-1">Installation</p>
      <p>Open this app in a supported browser to install:</p>
      <ul className="list-disc list-inside mt-2 space-y-1">
        <li>Chrome, Edge, or Opera on desktop/Android</li>
        <li>Firefox on Android</li>
        <li>Safari on iOS</li>
      </ul>
    </div>
  );
}