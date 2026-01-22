import React, { useState, useEffect } from 'react';
import { Users, User, Wallet, RefreshCw, History, Settings, TrendingUp, TrendingDown } from 'lucide-react';
import Navbar from '../components/layout/Navbar';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/tabs';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import PeopleSettlementView from '../components/settlements/PeopleSettlementView';
import GroupSettlementView from '../components/settlements/GroupSettlementView';
import SettlementHistoryView from '../components/settlements/SettlementHistoryView';
import InGroupSettlementModal from '../components/settlements/InGroupSettlementModal';
import { SettlementsProvider, useSettlements } from '../context/SettlementsContext';
import { useAuth } from '../context/AuthContext';
import { cn } from '../lib/utils';
import { useNavigate } from 'react-router-dom';

/**
 * Settlements Page Content
 * Wrapped in SettlementsProvider
 */
const SettlementsContent = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [mode, setMode] = useState('people'); // 'people', 'groups', or 'history'
    const [settlementModalOpen, setSettlementModalOpen] = useState(false);
    const [selectedGroup, setSelectedGroup] = useState(null);

    const {
        peopleBalances,
        groupBalances,
        loading,
        error,
        fetchPeopleBalances,
        fetchGroupBalances,
        refreshBalances,
    } = useSettlements();

    // Fetch data on mount and mode change
    useEffect(() => {
        if (mode === 'people') {
            fetchPeopleBalances();
        } else if (mode === 'groups') {
            fetchGroupBalances();
        }
        // Don't fetch for 'history' mode - it handles its own data fetching
    }, [mode, fetchPeopleBalances, fetchGroupBalances]);

    const handleRefresh = async () => {
        await refreshBalances();
    };

    const handleSettleInGroup = (group) => {
        // Open in-group settlement modal with proper debt data
        console.log('[Settlements] Opening modal for group:', {
            groupId: group.groupId,
            groupName: group.groupName,
            suggestionsCount: group.suggestions?.length || 0,
            suggestions: group.suggestions,
            user: user,
            userId: user?._id,
            userIdAlt: user?.id,
        });
        
        setSelectedGroup(group);
        setSettlementModalOpen(true);
    };

    const handleSettlementCreated = async () => {
        // Refresh balances after settlement creation
        await refreshBalances();
    };

    const getUserProfileFromGroup = (userId) => {
        // Get user profile from selected group members cache
        if (!selectedGroup) return null;
        const member = selectedGroup.members?.find(m => m.userId === userId);
        return member ? {
            name: member.name,
            email: member.email,
            upiId: member.upiId
        } : null;
    };

    // Calculate summary stats
    const summaryStats = React.useMemo(() => {
        const people = peopleBalances.people || [];
        const theyOwe = people
            .filter(p => p.netBalance > 0)
            .reduce((sum, p) => sum + p.netBalance, 0);
        const iOwe = people
            .filter(p => p.netBalance < 0)
            .reduce((sum, p) => sum + Math.abs(p.netBalance), 0);
        return { theyOwe, iOwe, net: theyOwe - iOwe };
    }, [peopleBalances]);

    // Select loading and error state based on current mode
    const isLoading = mode === 'people' ? loading.people :
        mode === 'groups' ? loading.groups : false;

    const currentError = mode === 'people' ? error.people :
        mode === 'groups' ? error.groups : null;

    return (
        <div className="min-h-screen bg-background">
            <Navbar />

            <main className="container-responsive py-6 sm:py-8 pb-safe md:pb-8">
                {/* Header */}
                <div className="flex items-center justify-between mb-6 animate-fade-in">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded bg-primary/10 border border-primary/20">
                            <Wallet className="text-primary" size={24} />
                        </div>
                        <div>
                            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-display font-bold">Settlements</h1>
                            <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                                <Settings size={14} />
                                Settle balances across all your groups
                            </p>
                        </div>
                    </div>
                    <div className="flex gap-2" style={{ animationDelay: '0.1s' }}>
                        <Button
                            variant="outline"
                            size="icon"
                            onClick={handleRefresh}
                            disabled={isLoading}
                            className="min-h-[44px] min-w-[44px]"
                        >
                            <RefreshCw className={cn('h-4 w-4', isLoading && 'animate-spin')} />
                        </Button>
                    </div>
                </div>

                {/* Desktop Layout with Sidebar */}
                <div className="lg:grid lg:grid-cols-12 lg:gap-8">
                    {/* Main Content */}
                    <div className="lg:col-span-8 xl:col-span-9">

                        {/* Mode Tabs */}
                        <Tabs value={mode} onValueChange={setMode} className="w-full">
                            <TabsList className="grid grid-cols-3 w-full mb-6 h-12 sm:h-11">
                            <TabsTrigger
                                value="people"
                                className="flex items-center gap-2 px-2 sm:px-3 min-h-[48px] data-[state=active]:bg-primary/10"
                            >
                                <User size={16} />
                                <span>People</span>
                            </TabsTrigger>
                            <TabsTrigger
                                value="groups"
                                className="flex items-center gap-2 px-2 sm:px-3 min-h-[48px] data-[state=active]:bg-primary/10"
                            >
                                <Users size={16} />
                                <span>Groups</span>
                            </TabsTrigger>
                            <TabsTrigger
                                value="history"
                                className="flex items-center gap-2 px-2 sm:px-3 min-h-[48px] data-[state=active]:bg-primary/10"
                            >
                                <History size={16} />
                                <span>History</span>
                            </TabsTrigger>
                        </TabsList>

                            {/* Error State */}
                            {currentError && (
                                <div className="p-4 mb-4 rounded border border-destructive/20 bg-card text-destructive shadow-sm">
                                    <p className="text-sm">{currentError}</p>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={handleRefresh}
                                        className="mt-2"
                                    >
                                        Try Again
                                    </Button>
                                </div>
                            )}

                            {/* People Mode */}
                            <TabsContent value="people" className="mt-0">
                                <PeopleSettlementView
                                    people={peopleBalances.people || []}
                                    loading={loading.people}
                                />
                            </TabsContent>

                            {/* Groups Mode */}
                            <TabsContent value="groups" className="mt-0">
                                <GroupSettlementView
                                    groups={groupBalances || []}
                                    loading={loading.groups}
                                    onSettleInGroup={handleSettleInGroup}
                                    currentUserId={user?.id || user?._id}
                                />
                            </TabsContent>

                            {/* History Mode */}
                            <TabsContent value="history" className="mt-0">
                                <SettlementHistoryView />
                            </TabsContent>
                        </Tabs>
                    </div>

                    {/* Desktop Sidebar */}
                    <div className="hidden lg:block lg:col-span-4 xl:col-span-3">
                        <div className="sticky top-24 space-y-4">
                            {/* Summary Stats Card */}
                            <Card className="border-border shadow-sm animate-fade-in" style={{ animationDelay: '0.2s' }}>
                                <CardHeader>
                                    <CardTitle className="text-lg font-display">Summary</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="p-3 rounded-lg bg-success/10 border border-success/20">
                                        <div className="flex items-center gap-2 text-success mb-1">
                                            <TrendingUp size={16} />
                                            <span className="text-sm font-medium">You're Owed</span>
                                        </div>
                                        <p className="text-2xl font-bold text-success">
                                            ₹{summaryStats.theyOwe.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                                        </p>
                                    </div>
                                    <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                                        <div className="flex items-center gap-2 text-destructive mb-1">
                                            <TrendingDown size={16} />
                                            <span className="text-sm font-medium">You Owe</span>
                                        </div>
                                        <p className="text-2xl font-bold text-destructive">
                                            ₹{summaryStats.iOwe.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                                        </p>
                                    </div>
                                    <div className="pt-3 border-t border-border">
                                        <div className="flex items-center justify-between">
                                            <span className="text-sm text-muted-foreground">Net Balance</span>
                                            <span className={cn(
                                                "text-lg font-bold",
                                                summaryStats.net >= 0 ? "text-success" : "text-destructive"
                                            )}>
                                                {summaryStats.net >= 0 ? '+' : ''}₹{summaryStats.net.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                                            </span>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Quick Actions Card */}
                            <Card className="border-border shadow-sm animate-fade-in" style={{ animationDelay: '0.3s' }}>
                                <CardHeader>
                                    <CardTitle className="text-lg font-display">Quick Actions</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-2">
                                    <Button
                                        variant="outline"
                                        className="w-full justify-start gap-2 min-h-[44px]"
                                        onClick={() => navigate('/groups')}
                                    >
                                        <Users size={16} />
                                        View Groups
                                    </Button>
                                    <Button
                                        variant="outline"
                                        className="w-full justify-start gap-2 min-h-[44px]"
                                        onClick={() => setMode('history')}
                                    >
                                        <History size={16} />
                                        View History
                                    </Button>
                                    <Button
                                        variant="outline"
                                        className="w-full justify-start gap-2 min-h-[44px]"
                                        onClick={handleRefresh}
                                        disabled={isLoading}
                                    >
                                        <RefreshCw size={16} className={cn(isLoading && 'animate-spin')} />
                                        Refresh Balances
                                    </Button>
                                </CardContent>
                            </Card>
                        </div>
                    </div>
                </div>

                {/* In-Group Settlement Modal */}
                {selectedGroup && (
                    <InGroupSettlementModal
                        isOpen={settlementModalOpen}
                        onClose={() => {
                            setSettlementModalOpen(false);
                            setSelectedGroup(null);
                        }}
                        groupId={selectedGroup.groupId}
                        allDebts={selectedGroup.suggestions || []}
                        userDebts={(selectedGroup.suggestions || []).filter(
                            s => s.from?.toString() === (user?.id || user?._id)?.toString()
                        )}
                        getUserProfile={getUserProfileFromGroup}
                        isAdmin={selectedGroup.createdBy?.toString() === (user?.id || user?._id)?.toString()}
                        currentUserId={(user?.id || user?._id)?.toString()}
                        onSettlementCreated={handleSettlementCreated}
                    />
                )}
            </main>
        </div>
    );
};

/**
 * Settlements Page
 * Main settlements page with dual-mode (People/Groups) settlement view
 */
const Settlements = () => {
    return (
        <SettlementsProvider>
            <SettlementsContent />
        </SettlementsProvider>
    );
};

export default Settlements;
