/**
 * OfflineSyncIndicator Component
 * 
 * Shows offline status and sync progress.
 * Displays pending actions count and last sync time.
 */

import React from 'react';
import { WifiOff, RefreshCw, CheckCircle2, AlertCircle, Cloud, CloudOff } from 'lucide-react';
import { Button } from '../ui/button';
import { useOffline } from '../../hooks/useOffline';
import { useToast } from '../../hooks/use-toast';

const OfflineSyncIndicator = () => {
  const {
    isOnline,
    isOffline,
    isSyncing,
    syncStatus,
    pendingActions,
    lastSync,
    triggerSync,
  } = useOffline();
  
  const { toast } = useToast();

  // Don't show anything if online and no pending actions
  if (isOnline && !isSyncing && pendingActions === 0 && !syncStatus) {
    return null;
  }

  const handleSync = async () => {
    if (!isOnline) {
      toast({
        title: 'No connection',
        description: 'Cannot sync while offline',
        variant: 'destructive',
      });
      return;
    }

    const result = await triggerSync();
    
    if (result.success) {
      toast({
        title: 'Sync complete',
        description: result.upload?.synced 
          ? `Synced ${result.upload.synced} pending action(s)`
          : 'All data is up to date',
      });
    } else {
      toast({
        title: 'Sync failed',
        description: result.error || 'Please try again',
        variant: 'destructive',
      });
    }
  };

  const formatLastSync = (timestamp) => {
    if (!timestamp) return 'Never';
    
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  };

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <div className="bg-card border border-border rounded-lg shadow-lg p-3 min-w-[280px]">
        {/* Status Header */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            {isOffline ? (
              <>
                <CloudOff size={16} className="text-destructive" />
                <span className="text-sm font-medium text-destructive">Offline</span>
              </>
            ) : isSyncing ? (
              <>
                <RefreshCw size={16} className="text-primary animate-spin" />
                <span className="text-sm font-medium text-primary">Syncing...</span>
              </>
            ) : syncStatus === 'success' ? (
              <>
                <CheckCircle2 size={16} className="text-success" />
                <span className="text-sm font-medium text-success">Synced</span>
              </>
            ) : syncStatus === 'error' ? (
              <>
                <AlertCircle size={16} className="text-destructive" />
                <span className="text-sm font-medium text-destructive">Sync failed</span>
              </>
            ) : (
              <>
                <Cloud size={16} className="text-muted-foreground" />
                <span className="text-sm font-medium">Online</span>
              </>
            )}
          </div>

          {/* Sync Button */}
          {isOnline && !isSyncing && (
            <Button
              size="sm"
              variant="ghost"
              onClick={handleSync}
              className="h-7 px-2"
            >
              <RefreshCw size={14} />
            </Button>
          )}
        </div>

        {/* Details */}
        <div className="space-y-1 text-xs text-muted-foreground">
          {/* Pending Actions */}
          {pendingActions > 0 && (
            <div className="flex items-center justify-between">
              <span>Pending changes:</span>
              <span className="font-medium text-foreground">{pendingActions}</span>
            </div>
          )}

          {/* Last Sync */}
          {lastSync && (
            <div className="flex items-center justify-between">
              <span>Last synced:</span>
              <span className="font-medium text-foreground">{formatLastSync(lastSync)}</span>
            </div>
          )}

          {/* Offline Message */}
          {isOffline && (
            <p className="text-xs text-muted-foreground pt-1 border-t border-border/50">
              Changes will sync when connection is restored
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default OfflineSyncIndicator;
