import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Download, X, Share, Plus } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

// Detect iOS
const isIOS = () => {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
};

// Detect if running as standalone PWA
const isStandalone = () => {
  return window.matchMedia('(display-mode: standalone)').matches || 
         (window.navigator as any).standalone === true;
};

export function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
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
      setTimeout(() => setShowPrompt(true), 2000);
      return;
    }

    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      // Show prompt after a short delay
      setTimeout(() => setShowPrompt(true), 2000);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === 'accepted') {
      setShowPrompt(false);
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
            <Download className="w-6 h-6 text-white" />
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
  const [canInstall, setCanInstall] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isIOSDevice, setIsIOSDevice] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    setIsInstalled(isStandalone());
    setIsIOSDevice(isIOS());

    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setCanInstall(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setCanInstall(false);
    }
    setDeferredPrompt(null);
  };

  if (isInstalled) {
    return (
      <div className="flex items-center gap-2 text-sm text-primary">
        <Download className="w-4 h-4" />
        <span>App is installed</span>
      </div>
    );
  }

  if (isIOSDevice) {
    return (
      <div className="text-sm text-muted-foreground">
        <p>To install on iOS:</p>
        <ol className="list-decimal list-inside mt-1 space-y-1">
          <li>Tap the Share button in Safari</li>
          <li>Tap "Add to Home Screen"</li>
        </ol>
      </div>
    );
  }

  if (!canInstall) {
    return (
      <div className="text-sm text-muted-foreground">
        Install option will appear when available
      </div>
    );
  }

  return (
    <Button
      onClick={handleInstall}
      className="bg-gradient-primary hover:opacity-90 text-white"
    >
      <Download className="w-4 h-4 mr-2" />
      Install App
    </Button>
  );
}
