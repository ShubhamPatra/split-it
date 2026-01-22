import React, { useState, useEffect } from 'react';
import { Clock, CheckCircle2, AlertCircle, Calendar, TrendingUp } from 'lucide-react';
import { Card, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';
import { Skeleton } from '../ui/skeleton';
import BalanceBadge from './BalanceBadge';
import { useSettlements } from '../../context/SettlementsContext';
import { cn } from '../../lib/utils';

/**
 * Settlement History View
 * Shows chronological list of all settlements with confirmation status
 */
const SettlementHistoryView = () => {
    const [history, setHistory] = useState([]);
    const [stats, setStats] = useState({
        totalSettled: 0,
        recentConfirmations: 0,
        pendingCount: 0,
    });
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        loadHistory();
    }, []);

    const loadHistory = async () => {
        setIsLoading(true);
        setError(null);

        try {
            const apiClient = (await import('../../lib/apiClient')).default;
            const data = await apiClient.get('/settlements/history');

            setHistory(data.settlements || []);

            // Calculate stats
            const now = new Date();
            const last30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

            const recentConfirmations = (data.settlements || []).filter(s =>
                s.paymentStatus === 'confirmed' &&
                new Date(s.paymentConfirmedAt) > last30Days
            ).length;

            const totalSettled = (data.settlements || []).reduce((sum, s) =>
                s.paymentStatus === 'confirmed' ? sum + s.amount : sum, 0
            );

            const pendingCount = (data.settlements || []).filter(s =>
                s.paymentStatus === 'pending'
            ).length;

            setStats({
                totalSettled,
                recentConfirmations,
                pendingCount,
            });
        } catch (err) {
            console.error('Failed to load history:', err);
            setError(err.message || 'Failed to load settlement history');
        } finally {
            setIsLoading(false);
        }
    };

    const getStatusBadge = (status) => {
        const statusConfig = {
            confirmed: {
                variant: 'success',
                icon: CheckCircle2,
                label: 'Confirmed',
                className: 'bg-success/10 text-success border-success/20'
            },
            pending: {
                variant: 'warning',
                icon: Clock,
                label: 'Pending',
                className: 'bg-warning/10 text-warning border-warning/20'
            },
            failed: {
                variant: 'destructive',
                icon: AlertCircle,
                label: 'Failed',
                className: 'bg-destructive/10 text-destructive border-destructive/20'
            },
        };

        const config = statusConfig[status] || statusConfig.pending;
        const Icon = config.icon;

        return (
            <Badge className={cn('gap-1', config.className)}>
                <Icon size={12} />
                {config.label}
            </Badge>
        );
    };

    const formatDate = (date) => {
        return new Date(date).toLocaleDateString('en-IN', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
        });
    };

    if (error) {
        return (
            <Card className="border-destructive/20 shadow-sm">
                <CardContent className="p-6 text-center">
                    <AlertCircle className="mx-auto mb-2 text-destructive" size={32} />
                    <p className="text-sm text-destructive">{error}</p>
                </CardContent>
            </Card>
        );
    }

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Summary Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 lg:gap-4">
                <Card className="border-border shadow-sm hover:border-primary/20 transition-colors duration-150">
                    <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-success/10 border border-success/20">
                                <TrendingUp className="text-success" size={20} />
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground">Total Settled</p>
                                <p className="text-xl font-bold">₹{stats.totalSettled.toLocaleString('en-IN')}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-border shadow-sm hover:border-primary/20 transition-colors duration-150">
                    <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-info/10 border border-info/20">
                                <CheckCircle2 className="text-info" size={20} />
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground">Recent Confirmations</p>
                                <p className="text-xl font-bold">{stats.recentConfirmations}</p>
                                <p className="text-xs text-muted-foreground">Last 30 days</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-border shadow-sm hover:border-primary/20 transition-colors duration-150">
                    <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-warning/10 border border-warning/20">
                                <Clock className="text-warning" size={20} />
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground">Pending</p>
                                <p className="text-xl font-bold">{stats.pendingCount}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Settlement History List */}
            <div className="space-y-3">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider font-display">
                    Recent Settlements
                </h3>

                {isLoading ? (
                    <div className="space-y-2">
                        {[1, 2, 3].map(i => <Skeleton key={i} className="h-24 w-full" />)}
                    </div>
                ) : history.length === 0 ? (
                    <Card className="border-border shadow-sm">
                        <CardContent className="p-8 text-center">
                            <Clock className="mx-auto mb-2 text-muted-foreground" size={32} />
                            <p className="text-sm text-muted-foreground">No settlement history yet</p>
                        </CardContent>
                    </Card>
                ) : (
                    <div className="space-y-2">
                        {history.map((settlement, index) => (
                            <Card 
                                key={settlement._id} 
                                className="border-border shadow-sm hover:bg-accent/30 hover:shadow-md transition-all duration-150 animate-fade-in"
                                style={{ animationDelay: `${0.03 * index}s` }}
                            >
                                <CardContent className="p-4">
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-2">
                                                {getStatusBadge(settlement.paymentStatus)}
                                                {settlement.isCrossGroup && (
                                                    <Badge variant="outline" className="text-xs">
                                                        Cross-Group
                                                    </Badge>
                                                )}
                                                <Badge variant="outline" className="text-xs capitalize">
                                                    {settlement.paymentMethod}
                                                </Badge>
                                            </div>

                                            <div className="flex items-center gap-2 text-sm mb-1">
                                                <span className="font-medium">
                                                    {settlement.fromUserId?.name || 'Unknown'}
                                                </span>
                                                <span className="text-muted-foreground">→</span>
                                                <span className="font-medium">
                                                    {settlement.toUserId?.name || 'Unknown'}
                                                </span>
                                            </div>

                                            <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                                <span className="flex items-center gap-1">
                                                    <Calendar size={12} />
                                                    {formatDate(settlement.settledAt)}
                                                </span>
                                                {settlement.groupId?.name && (
                                                    <span>in {settlement.groupId.name}</span>
                                                )}
                                            </div>

                                            {settlement.isCrossGroup && settlement.distributionDetails && (
                                                <div className="mt-2 space-y-1">
                                                    <p className="text-xs font-medium text-muted-foreground">
                                                        Distributed across {settlement.groupCount || settlement.distributionDetails.length} group
                                                        {(settlement.groupCount || settlement.distributionDetails.length) > 1 ? 's' : ''}:
                                                    </p>
                                                    <div className="space-y-0.5 pl-2">
                                                        {settlement.distributionDetails?.map((dist, idx) => (
                                                            <div key={idx} className="text-xs text-muted-foreground flex justify-between">
                                                                <span>• {dist.groupName}</span>
                                                                <span className="font-medium">₹{dist.amount.toLocaleString('en-IN')}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                            {settlement.paymentNotes && (
                                                <p className="mt-2 text-xs text-muted-foreground italic">
                                                    "{settlement.paymentNotes}"
                                                </p>
                                            )}
                                        </div>

                                        <div className="text-right">
                                            <BalanceBadge
                                                amount={settlement.amount}
                                                size="lg"
                                                showSign={false}
                                            />
                                            {settlement.paymentConfirmedAt && (
                                                <p className="text-xs text-muted-foreground mt-1">
                                                    Confirmed {formatDate(settlement.paymentConfirmedAt)}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default SettlementHistoryView;
