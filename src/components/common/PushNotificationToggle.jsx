import React, { useState, useEffect } from 'react';
import { Bell, BellOff, Loader2 } from 'lucide-react';
import { Button } from '../ui/button';
import { useToast } from '../../hooks/use-toast';
import { useAuth } from '../../context/AuthContext';
import apiClient from '../../lib/apiClient';

// Check if push notifications are supported
const isPushSupported = () => {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
};

const PushNotificationToggle = () => {
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [permission, setPermission] = useState('default');
  useAuth(); // Ensure user is authenticated
  const { toast } = useToast();

  // Check current subscription status
  useEffect(() => {
    const checkSubscription = async () => {
      if (!isPushSupported()) {
        setIsLoading(false);
        return;
      }

      try {
        setPermission(Notification.permission);
        
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();
        setIsSubscribed(!!subscription);
      } catch (error) {
        console.error('Error checking push subscription:', error);
      } finally {
        setIsLoading(false);
      }
    };

    checkSubscription();
  }, []);

  // Subscribe to push notifications
  const subscribe = async () => {
    if (!isPushSupported()) {
      toast({
        title: 'Not supported',
        description: 'Push notifications are not supported in your browser.',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);

    try {
      // Request permission
      const permission = await Notification.requestPermission();
      setPermission(permission);

      if (permission !== 'granted') {
        toast({
          title: 'Permission denied',
          description: 'Please enable notifications in your browser settings.',
          variant: 'destructive',
        });
        setIsLoading(false);
        return;
      }

      // Get service worker registration
      const registration = await navigator.serviceWorker.ready;

      // Get VAPID public key from server
      const { publicKey } = await apiClient.get('/notifications/vapid-public-key');

      // Subscribe to push
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });

      // Send subscription to server
      await apiClient.post('/notifications/push-subscribe', {
        subscription: subscription.toJSON(),
      });

      setIsSubscribed(true);
      toast({
        title: 'Notifications enabled',
        description: 'You will now receive push notifications for important updates.',
      });
    } catch (error) {
      console.error('Error subscribing to push:', error);
      toast({
        title: 'Subscription failed',
        description: 'Could not enable push notifications. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Unsubscribe from push notifications
  const unsubscribe = async () => {
    setIsLoading(true);

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        // Unsubscribe locally
        await subscription.unsubscribe();

        // Notify server
        await apiClient.post('/notifications/push-unsubscribe', {
          endpoint: subscription.endpoint,
        });
      }

      setIsSubscribed(false);
      toast({
        title: 'Notifications disabled',
        description: 'You will no longer receive push notifications.',
      });
    } catch (error) {
      console.error('Error unsubscribing from push:', error);
      toast({
        title: 'Error',
        description: 'Could not disable push notifications.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Convert VAPID key
  const urlBase64ToUint8Array = (base64String) => {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding)
      .replace(/-/g, '+')
      .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  };

  if (!isPushSupported()) {
    return (
      <div className="flex items-center justify-between p-4 rounded-lg bg-muted">
        <div>
          <p className="font-medium">Push Notifications</p>
          <p className="text-sm text-muted-foreground">Not supported in your browser</p>
        </div>
        <BellOff className="h-5 w-5 text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between p-4 rounded-lg bg-muted">
      <div>
        <p className="font-medium">Push Notifications</p>
        <p className="text-sm text-muted-foreground">
          {isSubscribed 
            ? 'You will receive push notifications' 
            : permission === 'denied'
              ? 'Blocked in browser settings'
              : 'Get notified about expenses and settlements'
          }
        </p>
      </div>
      <Button
        variant={isSubscribed ? 'outline' : 'default'}
        size="sm"
        onClick={isSubscribed ? unsubscribe : subscribe}
        disabled={isLoading || permission === 'denied'}
        className="min-h-[44px]"
      >
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : isSubscribed ? (
          <>
            <BellOff className="h-4 w-4 mr-2" />
            Disable
          </>
        ) : (
          <>
            <Bell className="h-4 w-4 mr-2" />
            Enable
          </>
        )}
      </Button>
    </div>
  );
};

export default PushNotificationToggle;
