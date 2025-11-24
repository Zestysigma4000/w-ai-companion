import { useEffect, useState } from 'react';
import { AlertCircle, WifiOff } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

export function OfflineIndicator() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (isOnline) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-50 p-4">
      <Alert variant="destructive" className="max-w-2xl mx-auto">
        <WifiOff className="h-4 w-4" />
        <AlertDescription className="flex items-center gap-2">
          <AlertCircle className="h-4 w-4" />
          <span className="font-semibold">You're offline.</span>
          <span>Some features may not work until your connection is restored.</span>
        </AlertDescription>
      </Alert>
    </div>
  );
}
