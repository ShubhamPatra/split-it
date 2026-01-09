import React, { useState } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { toast } from '../../hooks/use-toast';
import apiClient from '../../lib/apiClient';
import { Mail, X, Send, Loader2, Check, Clock } from 'lucide-react';
import { validateEmail } from '../../utils/helperFunctions';

const InviteEmailTab = ({ groupId, expiryHours, onInviteCreated }) => {
  const [emailInput, setEmailInput] = useState('');
  const [emails, setEmails] = useState([]);
  const [sending, setSending] = useState(false);
  const [sentInvites, setSentInvites] = useState([]);

  // Add email to list
  const addEmail = (email) => {
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail) return;

    if (!validateEmail(trimmedEmail)) {
      toast({
        title: 'Invalid Email',
        description: `"${trimmedEmail}" is not a valid email address.`,
        variant: 'destructive',
      });
      return;
    }

    if (emails.includes(trimmedEmail)) {
      toast({
        title: 'Duplicate Email',
        description: 'This email is already in the list.',
        variant: 'destructive',
      });
      return;
    }

    if (emails.length >= 50) {
      toast({
        title: 'Limit Reached',
        description: 'You can only invite up to 50 people at once.',
        variant: 'destructive',
      });
      return;
    }

    setEmails([...emails, trimmedEmail]);
    setEmailInput('');
  };

  // Handle key press (Enter or comma)
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addEmail(emailInput);
    }
  };

  // Handle blur
  const handleBlur = () => {
    if (emailInput) {
      addEmail(emailInput);
    }
  };

  // Remove email from list
  const removeEmail = (emailToRemove) => {
    setEmails(emails.filter(e => e !== emailToRemove));
  };

  // Send invites
  const sendInvites = async () => {
    if (emails.length === 0) {
      toast({
        title: 'No Emails',
        description: 'Please add at least one email address.',
        variant: 'destructive',
      });
      return;
    }

    try {
      setSending(true);
      const response = await apiClient.post(`/invites/groups/${groupId}/invites`, {
        type: 'email',
        emails,
        expiryHours,
      });

      const newInvites = response.invites || [];
      setSentInvites(prev => [...newInvites, ...prev]);
      onInviteCreated?.(newInvites);
      setEmails([]);

      toast({
        title: 'Invites Sent!',
        description: `Successfully sent ${newInvites.length} invite(s).`,
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to send invites',
        variant: 'destructive',
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Mail className="h-5 w-5 text-primary" />
        <p className="text-sm text-muted-foreground">
          Send email invitations directly to people you want to add.
        </p>
      </div>

      {/* Email input with chips */}
      <div className="space-y-2">
        <div className="flex flex-wrap gap-2 p-2 border rounded-md min-h-[42px] bg-background">
          {emails.map(email => (
            <Badge key={email} variant="secondary" className="gap-1 pl-2">
              {email}
              <button
                onClick={() => removeEmail(email)}
                className="ml-1 hover:bg-muted rounded-full p-0.5"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
          <Input
            type="email"
            placeholder={emails.length === 0 ? "Enter email addresses..." : "Add another..."}
            value={emailInput}
            onChange={(e) => setEmailInput(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={handleBlur}
            className="border-0 shadow-none focus-visible:ring-0 flex-1 min-w-[200px] p-0 h-auto"
          />
        </div>
        <p className="text-xs text-muted-foreground">
          Press Enter or comma to add multiple emails. Max 50 per batch.
        </p>
      </div>

      {/* Send button */}
      <Button
        onClick={sendInvites}
        disabled={emails.length === 0 || sending}
        className="w-full"
      >
        {sending ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Sending...
          </>
        ) : (
          <>
            <Send className="h-4 w-4 mr-2" />
            Send {emails.length > 0 ? `${emails.length} ` : ''}Invite{emails.length !== 1 ? 's' : ''}
          </>
        )}
      </Button>

      {/* Sent invites list */}
      {sentInvites.length > 0 && (
        <div className="border-t pt-4 mt-4">
          <h4 className="text-sm font-medium mb-2">Sent Invites</h4>
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {sentInvites.map((invite, idx) => (
              <div
                key={invite.id || idx}
                className="flex items-center justify-between p-2 bg-muted/50 rounded-md text-sm"
              >
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span>{invite.invitedEmail}</span>
                </div>
                <div className="flex items-center gap-2">
                  {invite.status === 'accepted' ? (
                    <Badge variant="default" className="gap-1">
                      <Check className="h-3 w-3" />
                      Accepted
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="gap-1">
                      <Clock className="h-3 w-3" />
                      Pending
                    </Badge>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default InviteEmailTab;
