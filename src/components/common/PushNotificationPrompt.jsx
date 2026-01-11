import React, { useState, useEffect } from 'react';
import { Bell, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { 
  initializePushNotifications, 
  getPushNotificationStatus 
} from '../../utils/registerServiceWorker';

const PushNotificationPrompt = () => {
  const [showPrompt, setShowPrompt] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    const checkPushStatus = async () => {
      // Only show for authenticated users
      if (!user) {
        setShowPrompt(false);
        return;
      }

      // Check if user already dismissed the prompt this session
      const dismissed = sessionStorage.getItem('push_prompt_dismissed');
      if (dismissed) {
        return;
      }

      // Check push notification status
      const status = await getPushNotificationStatus();
      
      // Show prompt if:
      // 1. Push is supported
      // 2. User hasn't subscribed yet
      // 3. Permission isn't denied
      if (status.supported && !status.subscribed && status.permission !== 'denied') {
        // Delay showing the prompt for better UX
        setTimeout(() => setShowPrompt(true), 3000);
      }
    };

    checkPushStatus();
  }, [user]);

  const handleEnable = async () => {
    setIsLoading(true);
    try {
      const result = await initializePushNotifications();
      if (result.success) {
        setShowPrompt(false);
      } else {
        console.warn('Push notification setup failed:', result.error);
        // Still hide the prompt, don't annoy the user
        setShowPrompt(false);
      }
    } catch (error) {
      console.error('Push notification error:', error);
      setShowPrompt(false);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    // Remember dismissal for this session only
    sessionStorage.setItem('push_prompt_dismissed', 'true');
  };

  if (!showPrompt) return null;

  return (
    <div className="fixed bottom-20 right-4 z-50 animate-in slide-in-from-right-5 duration-300">
      <div className="bg-card border border-border rounded-lg shadow-lg p-3 max-w-xs">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
            <Bell className="w-4 h-4 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground">
              Enable notifications?
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Get alerts for new expenses & payments
            </p>
            <div className="flex gap-2 mt-2">
              <button
                onClick={handleEnable}
                disabled={isLoading}
                className="px-3 py-1 text-xs font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {isLoading ? 'Enabling...' : 'Enable'}
              </button>
              <button
                onClick={handleDismiss}
                className="px-3 py-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                Not now
              </button>
            </div>
          </div>
          <button
            onClick={handleDismiss}
            className="flex-shrink-0 text-muted-foreground hover:text-foreground"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default PushNotificationPrompt;
