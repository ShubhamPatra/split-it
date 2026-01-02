import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useGroups } from '../context/GroupContext';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Users, Loader2, AlertCircle, CheckCircle } from 'lucide-react';
import Loading from '../components/common/Loading';

const JoinGroup = () => {
  const { inviteCode } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated, loading: authLoading } = useAuth();
  const { joinGroupByInvite } = useGroups();
  
  const [status, setStatus] = useState('loading'); // loading, success, error, auth-required
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (authLoading) return;

    if (!isAuthenticated) {
      setStatus('auth-required');
      setMessage('You need to log in to join this group');
      return;
    }

    const joinGroup = async () => {
      try {
        setStatus('loading');
        await joinGroupByInvite(inviteCode);
        setStatus('success');
        setMessage('Successfully joined the group!');
        
        // Redirect to groups page after 2 seconds
        setTimeout(() => {
          navigate('/groups');
        }, 2000);
      } catch (error) {
        setStatus('error');
        if (error.response?.data?.message) {
          setMessage(error.response.data.message);
        } else {
          setMessage('Invalid or expired invite link');
        }
      }
    };

    joinGroup();
  }, [inviteCode, isAuthenticated, authLoading, joinGroupByInvite, navigate]);

  const handleLogin = () => {
    // Save the invite code to redirect back after login
    sessionStorage.setItem('pendingInviteCode', inviteCode);
    navigate('/login');
  };

  const handleSignup = () => {
    // Save the invite code to redirect back after signup
    sessionStorage.setItem('pendingInviteCode', inviteCode);
    navigate('/signup');
  };

  if (authLoading) {
    return <Loading />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
            {status === 'loading' && <Loader2 className="w-8 h-8 text-primary animate-spin" />}
            {status === 'success' && <CheckCircle className="w-8 h-8 text-green-500" />}
            {status === 'error' && <AlertCircle className="w-8 h-8 text-red-500" />}
            {status === 'auth-required' && <Users className="w-8 h-8 text-primary" />}
          </div>
          <CardTitle className="text-2xl">
            {status === 'loading' && 'Joining Group...'}
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
          {status === 'error' && (
            <Button onClick={() => navigate('/groups')} className="w-full">
              Go to Groups
            </Button>
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
