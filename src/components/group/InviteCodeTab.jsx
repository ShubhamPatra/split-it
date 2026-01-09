import React, { useState, useEffect } from 'react';
import { Button } from '../ui/button';
import { toast } from '../../hooks/use-toast';
import apiClient from '../../lib/apiClient';
import { Copy, Check, RefreshCw, Hash } from 'lucide-react';

const InviteCodeTab = ({ groupId, expiryHours, onInviteCreated }) => {
  const [invite, setInvite] = useState(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState('');

  // Generate code invite
  const generateInvite = async () => {
    try {
      setLoading(true);
      const response = await apiClient.post(`/invites/groups/${groupId}/invites`, {
        type: 'code',
        expiryHours,
      });
      const newInvite = response.invites?.[0];
      setInvite(newInvite);
      onInviteCreated?.(newInvite);
      toast({
        title: 'Invite Code Created',
        description: 'Your invite code is ready to share.',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to create invite code',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  // Copy code to clipboard
  const copyToClipboard = async () => {
    if (!invite?.code) return;
    try {
      await navigator.clipboard.writeText(invite.formattedCode || invite.code);
      setCopied(true);
      toast({
        title: 'Copied!',
        description: 'Invite code copied to clipboard.',
      });
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to copy to clipboard',
        variant: 'destructive',
      });
    }
  };

  // Update countdown timer
  useEffect(() => {
    if (!invite?.expiresAt) return;

    const updateTimer = () => {
      const now = new Date();
      const expiry = new Date(invite.expiresAt);
      const diff = expiry - now;

      if (diff <= 0) {
        setTimeRemaining('Expired');
        return;
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

      if (days > 0) {
        setTimeRemaining(`${days}d ${hours}h ${minutes}m`);
      } else if (hours > 0) {
        setTimeRemaining(`${hours}h ${minutes}m`);
      } else {
        setTimeRemaining(`${minutes}m`);
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 60000);

    return () => clearInterval(interval);
  }, [invite?.expiresAt]);

  // Generate invite on mount
  useEffect(() => {
    if (groupId && !invite) {
      generateInvite();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Hash className="h-5 w-5 text-primary" />
        <p className="text-sm text-muted-foreground">
          Share this code with people to let them join your group.
        </p>
      </div>

      {invite ? (
        <>
          {/* Large code display */}
          <div className="flex flex-col items-center justify-center py-6 bg-muted/50 rounded-lg">
            <div className="text-4xl font-mono font-bold tracking-widest text-primary">
              {invite.formattedCode || (
                <>
                  {invite.code?.slice(0, 4)}<span className="text-muted-foreground mx-1">-</span>{invite.code?.slice(4)}
                </>
              )}
            </div>
            <p className="text-sm text-muted-foreground mt-2">
              Enter this code at split-it.com/join or visit split-it.com/join/{invite.code}
            </p>
          </div>

          {/* Copy button */}
          <Button
            variant="outline"
            onClick={copyToClipboard}
            className="w-full"
          >
            {copied ? (
              <>
                <Check className="h-4 w-4 mr-2 text-green-500" />
                Copied!
              </>
            ) : (
              <>
                <Copy className="h-4 w-4 mr-2" />
                Copy Code
              </>
            )}
          </Button>

          {/* Expiry and regenerate */}
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              Expires in: <span className="font-medium text-foreground">{timeRemaining}</span>
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={generateInvite}
              disabled={loading}
            >
              <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
              Generate New Code
            </Button>
          </div>
        </>
      ) : (
        <div className="flex justify-center py-8">
          <Button onClick={generateInvite} disabled={loading}>
            {loading ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Hash className="h-4 w-4 mr-2" />
                Generate Invite Code
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );
};

export default InviteCodeTab;
