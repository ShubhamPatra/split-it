import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Users, Scale, Loader2, AlertCircle, Wallet } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import apiClient from '../lib/apiClient';
import Navbar from '../components/layout/Navbar';
import UnifiedSettlementModal from '../components/settlement/UnifiedSettlementModal';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { useToast } from '../hooks/use-toast';

const PersonDetail = () => {
  const navigate = useNavigate();
  const { personId } = useParams();
  const { isAuthenticated } = useAuth();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [personData, setPersonData] = useState(null);
  const [error, setError] = useState(null);
  const [isSettleDialogOpen, setIsSettleDialogOpen] = useState(false);

  const fetchPersonData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // FIX: apiClient already adds /api prefix, and returns data directly
      const response = await apiClient.get(`/cross-group/person/${personId}`);
      setPersonData(response);
    } catch (err) {
      console.error('Error fetching person data:', err);
      setError(err.response?.data?.message || 'Failed to load person details');
      toast({
        title: 'Error',
        description: err.response?.data?.message || 'Failed to load person details',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [personId, toast]);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    if (!personId) {
      navigate('/people');
      return;
    }
    fetchPersonData();
  }, [isAuthenticated, personId, navigate, fetchPersonData]);

  if (!isAuthenticated) return null;

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <main className="container-responsive py-6 sm:py-8 pb-24 md:pb-8">
          <div className="flex items-center justify-center py-12">
            <Loader2 className="animate-spin text-primary" size={32} />
          </div>
        </main>
      </div>
    );
  }

  if (error || !personData) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <main className="container-responsive py-6 sm:py-8 pb-24 md:pb-8">
          <Button onClick={() => navigate('/people')} variant="ghost" className="mb-4 gap-2">
            <ArrowLeft size={16} />
            Back to People
          </Button>
          <Card className="border-destructive/50">
            <CardContent className="p-8 text-center">
              <AlertCircle className="text-destructive mx-auto mb-4" size={48} />
              <h3 className="font-display font-semibold text-lg text-foreground mb-2">Failed to load person details</h3>
              <p className="text-muted-foreground mb-6">{error || 'Person not found'}</p>
              <Button onClick={() => navigate('/people')}>
                Back to People
              </Button>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  // FIX: API returns 'breakdown' not 'groups', add default empty array
  const { person, balance, breakdown: groups = [] } = personData;
  const isOwed = balance > 0; // Positive = they owe me
  const isOwing = balance < 0; // Negative = I owe them

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container-responsive py-6 sm:py-8 pb-24 md:pb-8">
        {/* Back Button */}
        <Button onClick={() => navigate('/people')} variant="ghost" className="mb-4 gap-2 animate-fade-in">
          <ArrowLeft size={16} />
          Back to People
        </Button>

        {/* Person Header */}
        <div className="mb-6 animate-fade-in" style={{ animationDelay: '0.1s' }}>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-primary/10 border-2 border-primary/20 flex items-center justify-center flex-shrink-0">
                <span className="font-display font-bold text-primary text-2xl">
                  {person.name?.charAt(0).toUpperCase() || '?'}
                </span>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="font-display text-2xl sm:text-3xl font-bold text-foreground">{person.name}</h1>
                  {person.isDeleted && (
                    <Badge variant="outline" className="text-xs text-muted-foreground">
                      Deleted User
                    </Badge>
                  )}
                </div>
                <p className="text-muted-foreground">{person.email || 'No email available'}</p>
              </div>
            </div>
            {balance !== 0 && !person.isDeleted && (
              <Button onClick={() => setIsSettleDialogOpen(true)} className="gap-2 shadow-lg shadow-primary/25">
                <Wallet size={16} />
                Settle Up
              </Button>
            )}
            {person.isDeleted && balance !== 0 && (
              <div className="text-sm text-muted-foreground italic">
                Cannot settle with deleted user
              </div>
            )}
          </div>
        </div>

        {/* Balance Card */}
        <Card className={`mb-6 border-2 shadow-md animate-fade-in ${balance > 0 ? 'border-success/30 bg-success/5' : balance < 0 ? 'border-destructive/30 bg-destructive/5' : 'border-border/50'}`} style={{ animationDelay: '0.15s' }}>
          <CardContent className="p-6">
            <div className="text-center">
              <div className={`inline-flex p-4 rounded-2xl mb-4 ${balance > 0 ? 'bg-success/20 border border-success/30' : balance < 0 ? 'bg-destructive/20 border border-destructive/30' : 'bg-muted/50 border border-border'}`}>
                <Scale size={32} className={balance > 0 ? 'text-success' : balance < 0 ? 'text-destructive' : 'text-muted-foreground'} />
              </div>
              <p className="text-sm text-muted-foreground mb-1">
                {isOwed ? 'They owe you' : isOwing ? 'You owe them' : 'Settled up'}
              </p>
              <p className={`font-display text-4xl font-bold tracking-tight ${balance > 0 ? 'text-success' : balance < 0 ? 'text-destructive' : 'text-muted-foreground'}`}>
                ₹{Math.abs(balance).toFixed(0)}
              </p>
              {balance !== 0 && (
                <p className={`text-xs mt-3 px-3 py-1 rounded-full inline-block ${balance > 0 ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'}`}>
                  {isOwed ? 'Waiting for payment' : 'Time to settle up'}
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Group Breakdown */}
        <div className="animate-fade-in" style={{ animationDelay: '0.2s' }}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-lg md:text-xl font-semibold text-foreground flex items-center gap-2">
              <Users size={20} className="text-primary" />
              Group Breakdown ({groups.length})
            </h2>
          </div>

          {groups.length === 0 ? (
            <Card className="border-border/50 shadow-sm">
              <CardContent className="p-8 text-center">
                <p className="text-muted-foreground">No shared groups</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {groups.map((group, index) => (
                <Card
                  key={group.groupId}
                  onClick={() => navigate(`/group/${group.groupId}`)}
                  className="cursor-pointer border-border/50 shadow-sm hover:shadow-lg hover:border-primary/30 transition-all duration-300 animate-fade-in group"
                  style={{ animationDelay: `${0.05 * index}s` }}
                >
                  <CardContent className="p-4 sm:p-5">
                    <div className="flex items-center justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <h3 className="font-display font-semibold text-base text-foreground truncate mb-1">{group.groupName}</h3>
                        <div className="flex items-center gap-2">
                          {group.balance > 0 && (
                            <Badge variant="outline" className="text-xs text-success border-success/30 bg-success/5">
                              They owe you
                            </Badge>
                          )}
                          {group.balance < 0 && (
                            <Badge variant="outline" className="text-xs text-destructive border-destructive/30 bg-destructive/5">
                              You owe them
                            </Badge>
                          )}
                          {group.balance === 0 && (
                            <Badge variant="outline" className="text-xs text-muted-foreground">
                              Settled
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground mb-0.5">Balance</p>
                        <p className={`font-display font-bold text-lg truncate ${group.balance > 0 ? 'text-success' : group.balance < 0 ? 'text-destructive' : 'text-muted-foreground'}`}>
                          {group.balance > 0 && '+'}₹{Math.abs(group.balance).toFixed(0)}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Settlement Modal - Unified */}
      <UnifiedSettlementModal
        open={isSettleDialogOpen}
        onOpenChange={setIsSettleDialogOpen}
        mode="cross-group"
        person={{
          id: personId,
          name: person.name,
          balance: personData?.balance || 0,
        }}
        getUserProfile={() => ({ name: person.name })}
        onSubmit={async (settlementData) => {
          // FIX: apiClient already adds /api prefix
          await apiClient.post('/cross-group/settlements', settlementData);

          toast({
            title: 'Settlement Created',
            description: 'Cross-group settlement has been recorded successfully',
          });

          // Refresh person data
          fetchPersonData();
        }}
      />
    </div>
  );
};

export default PersonDetail;

