import React, { useState, useEffect } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { toast } from '../../hooks/use-toast';
import apiClient from '../../lib/apiClient';
import { Copy, Check, RefreshCw, Link as LinkIcon } from 'lucide-react';

const InviteLinkTab = ({ groupId, expiryHours, onInviteCreated }) => {
  const [invite, setInvite] = useState(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState('');

  // Generate or fetch link invite
  const generateInvite = async () => {
    try {
      setLoading(true);
      const response = await apiClient.post(`/invites/groups/${groupId}/invites`, {
        type: 'link',
        expiryHours,
      });
      const newInvite = response.invites?.[0];
      setInvite(newInvite);
      onInviteCreated?.(newInvite);
      toast({
        title: 'Invite Link Created',
        description: 'Your invite link is ready to share.',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to create invite link',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  // Copy to clipboard
  const copyToClipboard = async () => {
    if (!invite?.inviteUrl) return;
    try {
      await navigator.clipboard.writeText(invite.inviteUrl);
      setCopied(true);
      toast({
        title: 'Copied!',
        description: 'Invite link copied to clipboard.',
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
    const interval = setInterval(updateTimer, 60000); // Update every minute

    return () => clearInterval(interval);
  }, [invite?.expiresAt]);

  // Generate invite on mount if none exists
  useEffect(() => {
    if (groupId && !invite) {
      generateInvite();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <LinkIcon className="h-5 w-5 text-primary" />
        <p className="text-sm text-muted-foreground">
          Share this link with anyone you want to invite to the group.
        </p>
      </div>

      {invite ? (
        <>
          <div className="flex gap-2">
            <Input
              value={invite.inviteUrl || ''}
              readOnly
              className="font-mono text-sm"
            />
            <Button
              variant="outline"
              size="icon"
              onClick={copyToClipboard}
              className="shrink-0"
            >
              {copied ? (
                <Check className="h-4 w-4 text-green-500" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </Button>
          </div>

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
              Regenerate
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
                <LinkIcon className="h-4 w-4 mr-2" />
                Generate Invite Link
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );
};

export default InviteLinkTab;
