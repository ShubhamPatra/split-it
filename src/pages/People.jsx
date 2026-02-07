import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, TrendingUp, TrendingDown, Scale, ChevronRight, Loader2, AlertCircle, RefreshCw, History, Download, Filter } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import apiClient from '../lib/apiClient';
import Navbar from '../components/layout/Navbar';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import SettlementCard from '../components/common/SettlementCard';
import { useToast } from '../hooks/use-toast';

const People = () => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [crossGroupData, setCrossGroupData] = useState(null);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('people');
  const [settlements, setSettlements] = useState([]);
  const [settlementsLoading, setSettlementsLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all'); // all, pending, confirmed, failed

  const fetchCrossGroupBalances = useCallback(async (forceRefresh = false) => {
    try {
      if (forceRefresh) {
        setRefreshing(true);
        // Clear frontend cache for this endpoint
        apiClient.clearCache(true, '/cross-group/balances');
      } else {
        setLoading(true);
      }
      setError(null);

      const url = forceRefresh ? '/cross-group/balances?refresh=true' : '/cross-group/balances';
      const response = await apiClient.get(url);
      // FIX: apiClient.get() returns data directly, not response.data
      setCrossGroupData(response);
    } catch (err) {
      console.error('Error fetching cross-group balances:', err);
      setError(err.response?.data?.message || err.message || 'Failed to load balances');
      toast({
        title: 'Error',
        description: err.response?.data?.message || err.message || 'Failed to load balances',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [toast]);

  const fetchSettlements = useCallback(async () => {
    try {
      setSettlementsLoading(true);
      const statusParam = statusFilter !== 'all' ? `?status=${statusFilter}` : '';
      const response = await apiClient.get(`/cross-group/settlements${statusParam}`);

      // Handle different response structures
      const settlementsData = response.data?.settlements || response.data || [];
      setSettlements(Array.isArray(settlementsData) ? settlementsData : []);
    } catch (err) {
      console.error('Error fetching settlements:', err);
      toast({
        title: 'Error',
        description: err.response?.data?.message || 'Failed to load settlement history',
        variant: 'destructive',
      });
      setSettlements([]);
    } finally {
      setSettlementsLoading(false);
    }
  }, [toast, statusFilter]);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    fetchCrossGroupBalances();
  }, [isAuthenticated, navigate, fetchCrossGroupBalances]);

  useEffect(() => {
    if (isAuthenticated && activeTab === 'history') {
      fetchSettlements();
    }
  }, [isAuthenticated, activeTab, statusFilter, fetchSettlements]);

  const handleRefresh = () => {
    fetchCrossGroupBalances(true);
  };

  const handlePersonClick = (personId) => {
    navigate(`/people/${personId}`);
  };

  const handleExportSettlements = () => {
    try {
      // Prepare CSV data
      const csvRows = [];

      // Header
      csvRows.push([
        'Date',
        'From',
        'To',
        'Amount',
        'Currency',
        'Payment Method',
        'Status',
        'Groups',
        'Transaction Ref',
        'Notes'
      ].join(','));

      // Data rows
      settlements.forEach(settlement => {
        const row = [
          new Date(settlement.createdAt).toLocaleDateString(),
          settlement.fromUserId?.name || 'Unknown',
          settlement.toUserId?.name || 'Unknown',
          settlement.amount,
          settlement.currency || 'INR',
          settlement.paymentMethod || 'cash',
          settlement.paymentStatus || 'pending',
          settlement.affectedGroups?.map(g => g.name).join('; ') || '',
          settlement.transactionRef || '',
          (settlement.paymentNotes || '').replace(/,/g, ';') // Escape commas
        ];
        csvRows.push(row.join(','));
      });

      // Create blob and download
      const csvContent = csvRows.join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);

      link.setAttribute('href', url);
      link.setAttribute('download', `cross-group-settlements-${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Revoke the Blob URL to free memory
      URL.revokeObjectURL(url);

      toast({
        title: 'Export Successful',
        description: `Exported ${settlements.length} settlements to CSV`,
      });
    } catch (error) {
      console.error('Export error:', error);
      toast({
        title: 'Export Failed',
        description: 'Failed to export settlements',
        variant: 'destructive',
      });
    }
  };

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

  if (error && !crossGroupData) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <main className="container-responsive py-6 sm:py-8 pb-24 md:pb-8">
          <Card className="border-destructive/50">
            <CardContent className="p-8 text-center">
              <AlertCircle className="text-destructive mx-auto mb-4" size={48} />
              <h3 className="font-display font-semibold text-lg text-foreground mb-2">Failed to load balances</h3>
              <p className="text-muted-foreground mb-6">{error}</p>
              <Button onClick={() => fetchCrossGroupBalances()}>
                <RefreshCw size={16} />
                Try Again
              </Button>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  const { balances = {}, people = {}, totalOwed = 0, totalOwing = 0, netBalance = 0, groupBreakdown = {} } = crossGroupData || {};

  // Convert balances object to array for rendering
  const peopleWithBalances = Object.entries(balances)
    .map(([personId, balance]) => ({
      ...people[personId],
      balance,
      groups: groupBreakdown[personId] || []
    }))
    .sort((a, b) => Math.abs(b.balance) - Math.abs(a.balance)); // Sort by absolute balance (largest first)

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container-responsive py-6 sm:py-8 pb-24 md:pb-8">
        {/* Header */}
        <div className="mb-6 lg:mb-8 animate-fade-in">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="font-display text-2xl sm:text-3xl lg:text-4xl font-bold text-foreground mb-2">People</h1>
              <p className="text-muted-foreground flex items-center gap-2">
                <Users size={14} />
                <span>Your balances across all groups</span>
              </p>
            </div>
            <Button
              onClick={handleRefresh}
              variant="outline"
              disabled={refreshing}
              className="gap-2"
            >
              <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
              Refresh
            </Button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6 lg:mb-8">
          <Card className="group animate-fade-in border-border/50 shadow-sm hover:shadow-lg hover:border-success/30 transition-all duration-300" style={{ animationDelay: '0.1s' }}>
            <CardContent className="p-5">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded bg-success/10 border border-success/20 group-hover:scale-110 transition-transform duration-300">
                  <TrendingUp className="text-success" size={22} />
                </div>
                <div className="min-w-0">
                  <p className="text-sm text-muted-foreground mb-0.5">Total Owed to You</p>
                  <p className="font-display text-2xl sm:text-3xl font-bold text-success truncate tracking-tight">₹{totalOwed.toFixed(0)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="group animate-fade-in border-border/50 shadow-sm hover:shadow-lg hover:border-destructive/30 transition-all duration-300" style={{ animationDelay: '0.15s' }}>
            <CardContent className="p-5">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded bg-destructive/10 border border-destructive/20 group-hover:scale-110 transition-transform duration-300">
                  <TrendingDown className="text-destructive" size={22} />
                </div>
                <div className="min-w-0">
                  <p className="text-sm text-muted-foreground mb-0.5">Total You Owe</p>
                  <p className="font-display text-2xl sm:text-3xl font-bold text-destructive truncate tracking-tight">₹{totalOwing.toFixed(0)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="group animate-fade-in border-border/50 shadow-sm hover:shadow-lg hover:border-primary/30 transition-all duration-300" style={{ animationDelay: '0.2s' }}>
            <CardContent className="p-5">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded bg-primary/10 border border-primary/20 group-hover:scale-110 transition-transform duration-300">
                  <Scale className="text-primary" size={22} />
                </div>
                <div className="min-w-0">
                  <p className="text-sm text-muted-foreground mb-0.5">Net Balance</p>
                  <p className={`font-display text-2xl sm:text-3xl font-bold truncate tracking-tight ${netBalance >= 0 ? 'text-success' : 'text-destructive'}`}>
                    {netBalance >= 0 ? '+' : ''}₹{netBalance.toFixed(0)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* People List */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="animate-fade-in" style={{ animationDelay: '0.3s' }}>
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="people" className="gap-2">
              <Users size={16} />
              People
            </TabsTrigger>
            <TabsTrigger value="history" className="gap-2">
              <History size={16} />
              History
            </TabsTrigger>
          </TabsList>

          <TabsContent value="people">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display text-lg md:text-xl font-semibold text-foreground flex items-center gap-2">
                <Users size={20} className="text-primary" />
                All People ({peopleWithBalances.length})
              </h2>
            </div>

            {peopleWithBalances.length === 0 ? (
              <Card className="border-border/50 shadow-sm">
                <CardContent className="p-8 sm:p-12 text-center">
                  <div className="w-16 h-16 rounded bg-muted/50 flex items-center justify-center mx-auto mb-4">
                    <Users className="text-muted-foreground" size={32} />
                  </div>
                  <h3 className="font-display font-semibold text-lg text-foreground mb-2">No balances yet</h3>
                  <p className="text-muted-foreground mb-6">Start adding expenses in your groups to see balances here</p>
                  <Button onClick={() => navigate('/groups')}>
                    Go to Groups
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {peopleWithBalances.map((person, index) => (
                  <Card
                    key={person.id}
                    onClick={() => handlePersonClick(person.id)}
                    className="cursor-pointer border-border/50 shadow-sm hover:shadow-lg hover:border-primary/30 transition-all duration-300 animate-fade-in group"
                    style={{ animationDelay: `${0.05 * index}s` }}
                  >
                    <CardContent className="p-4 sm:p-5">
                      <div className="flex items-center justify-between gap-4">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <div className="w-10 h-10 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0">
                              <span className="font-display font-semibold text-primary text-sm">
                                {person.name?.charAt(0).toUpperCase() || '?'}
                              </span>
                            </div>
                            <div className="min-w-0">
                              <h3 className="font-display font-semibold text-base text-foreground truncate">
                                {person.name}
                                {person.isDeleted && (
                                  <Badge variant="outline" className="ml-2 text-xs text-muted-foreground">
                                    Deleted
                                  </Badge>
                                )}
                              </h3>
                              <p className="text-xs text-muted-foreground truncate">
                                {person.email || 'No email available'}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge variant="outline" className="text-xs">
                              {person.groups.length} group{person.groups.length !== 1 ? 's' : ''}
                            </Badge>
                            {person.balance > 0 && (
                              <Badge variant="outline" className="text-xs text-success border-success/30 bg-success/5">
                                Owes you
                              </Badge>
                            )}
                            {person.balance < 0 && (
                              <Badge variant="outline" className="text-xs text-destructive border-destructive/30 bg-destructive/5">
                                You owe
                              </Badge>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <p className="text-xs text-muted-foreground mb-0.5">Balance</p>
                            <p className={`font-display font-bold text-lg sm:text-xl truncate ${person.balance > 0 ? 'text-success' : person.balance < 0 ? 'text-destructive' : 'text-muted-foreground'}`}>
                              {person.balance > 0 && '+'}₹{Math.abs(person.balance).toFixed(0)}
                            </p>
                          </div>
                          <ChevronRight size={20} className="text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all flex-shrink-0" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="history">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
              <h2 className="font-display text-lg md:text-xl font-semibold text-foreground flex items-center gap-2">
                <History size={20} className="text-primary" />
                Settlement History ({settlements.length})
              </h2>
              <div className="flex items-center gap-2">
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[140px]">
                    <Filter size={16} className="mr-2" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="confirmed">Confirmed</SelectItem>
                    <SelectItem value="failed">Failed</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  onClick={handleExportSettlements}
                  variant="outline"
                  size="sm"
                  disabled={settlements.length === 0}
                  className="gap-2"
                >
                  <Download size={16} />
                  Export CSV
                </Button>
              </div>
            </div>

            {settlementsLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="animate-spin text-primary" size={32} />
              </div>
            ) : settlements.length === 0 ? (
              <Card className="border-border/50 shadow-sm">
                <CardContent className="p-8 sm:p-12 text-center">
                  <div className="w-16 h-16 rounded bg-muted/50 flex items-center justify-center mx-auto mb-4">
                    <History className="text-muted-foreground" size={32} />
                  </div>
                  <h3 className="font-display font-semibold text-lg text-foreground mb-2">
                    {statusFilter === 'all' ? 'No settlements yet' : `No ${statusFilter} settlements`}
                  </h3>
                  <p className="text-muted-foreground">
                    {statusFilter === 'all'
                      ? 'Cross-group settlements will appear here'
                      : `Change filter to see other settlements`
                    }
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {settlements.map((settlement) => (
                  <SettlementCard key={settlement._id} settlement={settlement} />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default People;
