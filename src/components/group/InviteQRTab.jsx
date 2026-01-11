import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '../ui/button';
import { toast } from '../../hooks/use-toast';
import apiClient from '../../lib/apiClient';
import { Copy, Check, RefreshCw, QrCode, Download } from 'lucide-react';
import QRCode from 'qrcode';

const InviteQRTab = ({ groupId, expiryHours, existingInvite, onInviteCreated }) => {
  const [invite, setInvite] = useState(null);
  const [qrDataUrl, setQrDataUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState('');

  // Generate QR code from URL
  const generateQRCode = useCallback(async (url) => {
    try {
      const dataUrl = await QRCode.toDataURL(url, {
        width: 300,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF',
        },
      });
      setQrDataUrl(dataUrl);
    } catch (error) {
      console.error('QR generation failed:', error);
      toast({
        title: 'Error',
        description: 'Failed to generate QR code',
        variant: 'destructive',
      });
    }
  }, []);

  // Generate invite
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

      if (newInvite?.inviteUrl) {
        await generateQRCode(newInvite.inviteUrl);
      }

      toast({
        title: 'QR Code Generated',
        description: 'Scan the QR code to join the group.',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to create invite',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  // Copy URL to clipboard
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

  // Download QR as PNG
  const downloadQR = () => {
    if (!qrDataUrl) return;

    const link = document.createElement('a');
    link.download = `invite-qr-${invite?.code || 'group'}.png`;
    link.href = qrDataUrl;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast({
      title: 'Downloaded!',
      description: 'QR code saved to your device.',
    });
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

  // Use existing invite if available
  useEffect(() => {
    if (existingInvite && !invite) {
      setInvite(existingInvite);
      if (existingInvite.inviteUrl) {
        generateQRCode(existingInvite.inviteUrl);
      }
    }
  }, [existingInvite, invite, generateQRCode]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <QrCode className="h-5 w-5 text-primary" />
        <p className="text-sm text-muted-foreground">
          Let people scan this QR code to join your group instantly.
        </p>
      </div>

      {qrDataUrl ? (
        <>
          {/* QR Code display */}
          <div className="flex flex-col items-center justify-center py-4 bg-white rounded-lg border">
            <img
              src={qrDataUrl}
              alt="Invite QR Code"
              className="w-[200px] h-[200px] sm:w-[250px] sm:h-[250px]"
            />
          </div>

          {/* URL display */}
          <div className="p-2 bg-muted/50 rounded-md text-center">
            <p className="text-xs text-muted-foreground font-mono break-all">
              {invite?.inviteUrl}
            </p>
          </div>

          {/* Action buttons */}
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={copyToClipboard}
              className="flex-1"
            >
              {copied ? (
                <>
                  <Check className="h-4 w-4 mr-2 text-green-500" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4 mr-2" />
                  Copy Link
                </>
              )}
            </Button>
            <Button
              variant="outline"
              onClick={downloadQR}
              className="flex-1"
            >
              <Download className="h-4 w-4 mr-2" />
              Download
            </Button>
          </div>

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
              Regenerate
            </Button>
          </div>
        </>
      ) : (
        <div className="flex flex-col items-center justify-center py-12">
          {loading ? (
            <>
              <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">Generating QR code...</p>
            </>
          ) : (
            <Button onClick={generateInvite}>
              <QrCode className="h-4 w-4 mr-2" />
              Generate QR Code
            </Button>
          )}
        </div>
      )}
    </div>
  );
};

export default InviteQRTab;
