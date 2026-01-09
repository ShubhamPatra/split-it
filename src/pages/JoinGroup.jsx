import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useGroups } from '../context/GroupContext';
import apiClient from '../lib/apiClient';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Users, Loader2, AlertCircle, CheckCircle, UserPlus } from 'lucide-react';
import Loading from '../components/common/Loading';

const JoinGroup = () => {
  const { inviteCode: paramCode } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { isAuthenticated, user, loading: authLoading } = useAuth();
  const { joinGroupByInvite, loading: groupsLoading } = useGroups();
  
  const [status, setStatus] = useState('loading'); // loading, preview, joining, success, error, auth-required
  const [message, setMessage] = useState('');
  const [groupPreview, setGroupPreview] = useState(null);
  const validateAttemptedRef = useRef(false);

  // Get code or token from URL params or search params
  // Path param can be either a code (8-10 uppercase alnum) or token (64-char hex)
  // Query params are kept for backward compatibility
  const isToken = (value) => value && /^[a-f0-9]{64}$/i.test(value);
  const pathParamIsToken = isToken(paramCode);
  
  const code = pathParamIsToken ? searchParams.get('code') : (paramCode || searchParams.get('code'));
  const token = pathParamIsToken ? paramCode : searchParams.get('token');

  useEffect(() => {
    // Reset validate attempt when invite code/token changes
    validateAttemptedRef.current = false;
    setGroupPreview(null);
    setStatus('loading');
  }, [code, token]);

  useEffect(() => {
    if (authLoading) return;

    if (!isAuthenticated) {
      setStatus('auth-required');
      setMessage('You need to log in to join this group');
      return;
    }

    // Wait for groups context to finish loading
    if (groupsLoading) {
      setStatus('loading');
      setMessage('Loading...');
      return;
    }

    // Prevent multiple validation attempts
    if (validateAttemptedRef.current) return;

    const validateInvite = async () => {
      validateAttemptedRef.current = true;
      
      if (!code && !token) {
        setStatus('error');
        setMessage('Invalid invite link');
        return;
      }

      try {
        setStatus('loading');
        setMessage('Validating invite...');
        
        const response = await apiClient.post('/invites/validate', {
          code: code || undefined,
          token: token || undefined,
        });
        
        if (response.valid) {
          setGroupPreview({
            id: response.group.id,
            name: response.group.name,
            memberCount: response.group.memberCount,
            invitedEmail: response.invite?.invitedEmail,
            legacy: response.legacy || false,
          });
          setStatus('preview');
          setMessage(`You've been invited to join ${response.group.name}`);
        } else {
          setStatus('error');
          setMessage(response.message || 'Invalid invite');
        }
      } catch (error) {
        setStatus('error');
        const errorMessage = error.message || 'Invalid or expired invite link';
        
        if (errorMessage.includes('expired')) {
          setMessage('This invite has expired. Please request a new one.');
        } else if (errorMessage.includes('not found') || errorMessage.includes('Invalid')) {
          setMessage('Invalid or expired invite link');
        } else {
          setMessage(errorMessage);
        }
      }
    };

    validateInvite();
  }, [code, token, isAuthenticated, authLoading, groupsLoading]);

  const handleJoinGroup = async () => {
    try {
      setStatus('joining');
      setMessage('Joining group...');
      
      await joinGroupByInvite(code, token);
      
      setStatus('success');
      setMessage('Successfully joined the group!');
      
      // Redirect to groups page after 2 seconds
      setTimeout(() => {
        navigate('/groups');
      }, 2000);
    } catch (error) {
      setStatus('error');
      const errorMessage = error.message || 'Failed to join group';
      
      if (errorMessage.includes('already a member')) {
        setMessage('You are already a member of this group');
      } else if (errorMessage.includes('different email')) {
        setMessage('This invite was sent to a different email address. Please use the correct account.');
      } else {
        setMessage(errorMessage);
      }
    }
  };

  const handleLogin = () => {
    // Save the invite info to redirect back after login
    if (code) {
      sessionStorage.setItem('pendingInviteCode', code);
    } else if (token) {
      sessionStorage.setItem('pendingInviteToken', token);
    }
    navigate('/login');
  };

  const handleSignup = () => {
    // Save the invite info to redirect back after signup
    if (code) {
      sessionStorage.setItem('pendingInviteCode', code);
    } else if (token) {
      sessionStorage.setItem('pendingInviteToken', token);
    }
    navigate('/signup');
  };

  if (authLoading) {
    return <Loading />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
            {(status === 'loading' || status === 'joining') && <Loader2 className="w-8 h-8 text-primary animate-spin" />}
            {status === 'success' && <CheckCircle className="w-8 h-8 text-green-500" />}
            {status === 'error' && <AlertCircle className="w-8 h-8 text-red-500" />}
            {(status === 'auth-required' || status === 'preview') && <Users className="w-8 h-8 text-primary" />}
          </div>
          <CardTitle className="text-2xl">
            {status === 'loading' && 'Validating Invite...'}
            {status === 'preview' && 'Join Group'}
            {status === 'joining' && 'Joining Group...'}
            {status === 'success' && 'Welcome!'}
            {status === 'error' && 'Oops!'}
            {status === 'auth-required' && 'Join Group'}
          </CardTitle>
          <CardDescription>
            {message}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {status === 'auth-required' && (
            <div className="space-y-3">
              <Button onClick={handleLogin} className="w-full">
                Log In to Join
              </Button>
              <Button onClick={handleSignup} variant="outline" className="w-full">
                Sign Up to Join
              </Button>
            </div>
          )}
          
          {status === 'preview' && groupPreview && (
            <div className="space-y-4">
              {/* Group Preview Card */}
              <div className="p-4 bg-muted/50 rounded-lg border border-border/50">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center">
                    <Users className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg">{groupPreview.name}</h3>
                    <p className="text-sm text-muted-foreground">
                      {groupPreview.memberCount} member{groupPreview.memberCount !== 1 ? 's' : ''}
                    </p>
                  </div>
                </div>
              </div>
              
              {/* Email verification notice for email invites */}
              {groupPreview.invitedEmail && (
                <div className="p-3 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900 rounded-lg">
                  <p className="text-sm text-blue-700 dark:text-blue-300">
                    This invite was sent to <strong>{groupPreview.invitedEmail}</strong>
                    {user?.email?.toLowerCase() === groupPreview.invitedEmail?.toLowerCase() 
                      ? " - you're all set!"
                      : ". Make sure you're logged in with the correct account."}
                  </p>
                </div>
              )}
              
              <Button onClick={handleJoinGroup} className="w-full" size="lg">
                <UserPlus className="w-4 h-4 mr-2" />
                Join {groupPreview.name}
              </Button>
              
              <Button onClick={() => navigate('/groups')} variant="ghost" className="w-full">
                Cancel
              </Button>
            </div>
          )}
          
          {status === 'error' && (
            <div className="space-y-3">
              <Button onClick={() => navigate('/groups')} className="w-full">
                Go to Groups
              </Button>
            </div>
          )}
          
          {status === 'success' && (
            <div className="text-center text-sm text-muted-foreground">
              Redirecting to your groups...
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default JoinGroup;
