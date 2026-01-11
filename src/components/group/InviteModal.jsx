import React, { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { toast } from '../../hooks/use-toast';
import apiClient from '../../lib/apiClient';
import InviteLinkTab from './InviteLinkTab';
import InviteEmailTab from './InviteEmailTab';
import InviteCodeTab from './InviteCodeTab';
import InviteQRTab from './InviteQRTab';
import { Link, Mail, Hash, QrCode, Trash2, Clock, RefreshCw } from 'lucide-react';

const EXPIRY_OPTIONS = [
  { label: '1 day', value: 24 },
  { label: '3 days', value: 72 },
  { label: '7 days', value: 168 },
  { label: '30 days', value: 720 },
];

const InviteModal = ({ groupId, groupName, isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState('link');
  const [invites, setInvites] = useState([]);
  const [loading, setLoading] = useState(false);
  const [expiryHours, setExpiryHours] = useState(168); // Default 7 days

  // Get existing active invite by type (link or code)
  const getExistingInvite = useCallback((type) => {
    // Link and QR share the same 'link' type invite
    const searchType = type === 'qr' ? 'link' : type;
    return invites.find(inv => 
      inv.type === searchType && 
      inv.status === 'pending' && 
      new Date(inv.expiresAt) > new Date()
    );
  }, [invites]);

  // Fetch active invites
  const fetchInvites = useCallback(async () => {
    if (!groupId) return;
    try {
      setLoading(true);
      const response = await apiClient.get(`/invites/groups/${groupId}/invites`);
      setInvites(response.invites || []);
    } catch (error) {
      console.error('Failed to fetch invites:', error);
    } finally {
      setLoading(false);
    }
  }, [groupId]);

  useEffect(() => {
    if (isOpen && groupId) {
      fetchInvites();
    }
  }, [isOpen, groupId, fetchInvites]);

  // Revoke invite
  const handleRevoke = async (inviteId) => {
    try {
      await apiClient.delete(`/invites/${inviteId}`);
      setInvites(prev => prev.filter(inv => inv.id !== inviteId));
      toast({
        title: 'Invite Revoked',
        description: 'The invite has been successfully revoked.',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to revoke invite',
        variant: 'destructive',
      });
    }
  };

  // Format time remaining
  const formatTimeRemaining = (expiresAt) => {
    const now = new Date();
    const expiry = new Date(expiresAt);
    const diff = expiry - now;

    if (diff <= 0) return 'Expired';

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ${hours % 24}h`;
    if (hours > 0) return `${hours}h`;
    return 'Less than 1h';
  };

  // Get invite type icon
  const getTypeIcon = (type) => {
    switch (type) {
      case 'link': return <Link className="h-4 w-4" />;
      case 'email': return <Mail className="h-4 w-4" />;
      case 'code': return <Hash className="h-4 w-4" />;
      default: return <Link className="h-4 w-4" />;
    }
  };

  // Handle invite created callback
  const handleInviteCreated = (newInvites) => {
    if (Array.isArray(newInvites)) {
      setInvites(prev => [...newInvites, ...prev]);
    } else {
      setInvites(prev => [newInvites, ...prev]);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[550px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Invite Members to {groupName}</DialogTitle>
          <DialogDescription>
            Share an invite link, send email invitations, or show a QR code.
          </DialogDescription>
        </DialogHeader>

        {/* Expiry Selector */}
        <div className="flex items-center gap-2 mb-4">
          <Clock className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Invite expires in:</span>
          <select
            value={expiryHours}
            onChange={(e) => setExpiryHours(Number(e.target.value))}
            className="text-sm border rounded-md px-2 py-1 bg-background"
          >
            {EXPIRY_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="link" className="flex items-center gap-1">
              <Link className="h-4 w-4" />
              <span className="hidden sm:inline">Link</span>
            </TabsTrigger>
            <TabsTrigger value="email" className="flex items-center gap-1">
              <Mail className="h-4 w-4" />
              <span className="hidden sm:inline">Email</span>
            </TabsTrigger>
            <TabsTrigger value="code" className="flex items-center gap-1">
              <Hash className="h-4 w-4" />
              <span className="hidden sm:inline">Code</span>
            </TabsTrigger>
            <TabsTrigger value="qr" className="flex items-center gap-1">
              <QrCode className="h-4 w-4" />
              <span className="hidden sm:inline">QR</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="link" className="mt-4">
            <InviteLinkTab
              groupId={groupId}
              expiryHours={expiryHours}
              existingInvite={getExistingInvite('link')}
              onInviteCreated={handleInviteCreated}
            />
          </TabsContent>

          <TabsContent value="email" className="mt-4">
            <InviteEmailTab
              groupId={groupId}
              expiryHours={expiryHours}
              onInviteCreated={handleInviteCreated}
            />
          </TabsContent>

          <TabsContent value="code" className="mt-4">
            <InviteCodeTab
              groupId={groupId}
              expiryHours={expiryHours}
              existingInvite={getExistingInvite('code')}
              onInviteCreated={handleInviteCreated}
            />
          </TabsContent>

          <TabsContent value="qr" className="mt-4">
            <InviteQRTab
              groupId={groupId}
              expiryHours={expiryHours}
              existingInvite={getExistingInvite('qr')}
              onInviteCreated={handleInviteCreated}
            />
          </TabsContent>
        </Tabs>

        {/* Active Invites List */}
        {invites.length > 0 && (
          <div className="mt-6 border-t pt-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-medium">Active Invites ({invites.length})</h4>
              <Button variant="ghost" size="sm" onClick={fetchInvites} disabled={loading}>
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              </Button>
            </div>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {invites.map(invite => (
                <div
                  key={invite.id}
                  className="flex items-center justify-between p-2 bg-muted/50 rounded-md text-sm"
                >
                  <div className="flex items-center gap-2">
                    {getTypeIcon(invite.type)}
                    <span className="font-mono">
                      {invite.formattedCode || invite.code || invite.invitedEmail || 'Token invite'}
                    </span>
                    <Badge variant="outline" className="text-xs">
                      {formatTimeRemaining(invite.expiresAt)}
                    </Badge>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRevoke(invite.id)}
                    className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default InviteModal;
