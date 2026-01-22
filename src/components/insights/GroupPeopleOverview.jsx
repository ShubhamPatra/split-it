import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, ChevronRight, TrendingUp, TrendingDown, ArrowRight, HandCoins, Eye } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';

/**
 * Group & People Overview Component
 * Shows top groups, people who owe, and people owed
 * Comment 5 fix: Added action buttons (Settle/View) to people cards
 */
const GroupPeopleOverview = ({
    groupSummary,
    topOwing,
    topOwed,
    formatAmount,
    animationDelay = 0
}) => {
    const navigate = useNavigate();

    return (
        <div className="space-y-6">
            {/* Groups Section */}
            {groupSummary && groupSummary.length > 0 && (
                <Card
                    className="animate-fade-in border-border/50 shadow-sm"
                    style={{ animationDelay: `${animationDelay}s` }}
                >
                    <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                            <CardTitle className="text-lg flex items-center gap-2">
                                <div className="p-1.5 rounded-lg bg-primary/10">
                                    <Users size={16} className="text-primary" />
                                </div>
                                Groups You Spend Most In
                            </CardTitle>
                            <Button
                                variant="ghost"
                                size="sm"
                                className="text-primary hover:bg-primary/10 gap-1"
                                onClick={() => navigate('/groups')}
                            >
                                View all
                                <ArrowRight size={14} />
                            </Button>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-2">
                        {groupSummary.slice(0, 5).map((summary, index) => (
                            <div
                                key={summary.group.id}
                                onClick={() => navigate(`/group/${summary.group.id}`)}
                                className="flex items-center justify-between p-3 rounded-xl bg-card-elevated/50 border border-border/30 hover:border-primary/30 hover:shadow-sm transition-all cursor-pointer group"
                            >
                                <div className="flex-1 min-w-0">
                                    <h4 className="font-medium text-foreground text-sm truncate mb-0.5">
                                        {summary.group.name}
                                    </h4>
                                    <p className="text-xs text-muted-foreground">
                                        {summary.expenseCount} expense{summary.expenseCount !== 1 ? 's' : ''} • {summary.memberCount} members
                                    </p>
                                </div>
                                <div className="flex items-center gap-4">
                                    <div className="text-right">
                                        <p className="text-xs text-muted-foreground">Total</p>
                                        <p className="font-semibold text-foreground text-sm">
                                            {formatAmount(summary.totalExpenses)}
                                        </p>
                                    </div>
                                    <div className="text-right min-w-[80px]">
                                        <p className="text-xs text-muted-foreground">Your Balance</p>
                                        <p className={`font-semibold text-sm ${summary.userBalance > 0 ? 'text-success' :
                                            summary.userBalance < 0 ? 'text-destructive' :
                                                'text-muted-foreground'
                                            }`}>
                                            {summary.userBalance > 0 && '+'}
                                            {formatAmount(summary.userBalance)}
                                        </p>
                                    </div>
                                    <ChevronRight
                                        size={18}
                                        className="text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all hidden sm:block"
                                    />
                                </div>
                            </div>
                        ))}
                    </CardContent>
                </Card>
            )}

            {/* People Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Who Owes You */}
                {topOwing && topOwing.length > 0 && (
                    <Card
                        className="animate-fade-in border-border/50 shadow-sm"
                        style={{ animationDelay: `${animationDelay + 0.1}s` }}
                    >
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base flex items-center gap-2">
                                <div className="p-1.5 rounded-lg bg-success/10">
                                    <TrendingUp size={14} className="text-success" />
                                </div>
                                Who Owes You
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2">
                            {topOwing.slice(0, 3).map((person) => (
                                <div
                                    key={person.userId}
                                    className="flex items-center justify-between p-2.5 rounded-lg bg-success/5 border border-success/10"
                                >
                                    <div className="min-w-0 flex-1">
                                        <p className="font-medium text-foreground text-sm truncate">
                                            {person.name}
                                        </p>
                                        {person.email && (
                                            <p className="text-xs text-muted-foreground truncate">
                                                {person.email}
                                            </p>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <p className="font-semibold text-success text-sm whitespace-nowrap">
                                            +{formatAmount(person.amount)}
                                        </p>
                                        {/* Comment 5 fix: Action buttons for settling */}
                                        <div className="flex gap-1 ml-2">
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                className="h-7 w-7 p-0 text-muted-foreground hover:text-success hover:bg-success/10"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    navigate('/groups');
                                                }}
                                                title="View in groups"
                                            >
                                                <Eye size={14} />
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </CardContent>
                    </Card>
                )}

                {/* Who You Owe */}
                {topOwed && topOwed.length > 0 && (
                    <Card
                        className="animate-fade-in border-border/50 shadow-sm"
                        style={{ animationDelay: `${animationDelay + 0.15}s` }}
                    >
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base flex items-center gap-2">
                                <div className="p-1.5 rounded-lg bg-destructive/10">
                                    <TrendingDown size={14} className="text-destructive" />
                                </div>
                                Who You Owe
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2">
                            {topOwed.slice(0, 3).map((person) => (
                                <div
                                    key={person.userId}
                                    className="flex items-center justify-between p-2.5 rounded-lg bg-destructive/5 border border-destructive/10"
                                >
                                    <div className="min-w-0 flex-1">
                                        <p className="font-medium text-foreground text-sm truncate">
                                            {person.name}
                                        </p>
                                        {person.email && (
                                            <p className="text-xs text-muted-foreground truncate">
                                                {person.email}
                                            </p>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <p className="font-semibold text-destructive text-sm whitespace-nowrap">
                                            -{formatAmount(person.amount)}
                                        </p>
                                        {/* Comment 5 fix: Action buttons for settling */}
                                        <div className="flex gap-1 ml-2">
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                className="h-7 px-2 text-xs text-muted-foreground hover:text-primary hover:bg-primary/10 gap-1"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    navigate('/groups');
                                                }}
                                                title="Settle this debt"
                                            >
                                                <HandCoins size={14} />
                                                <span className="hidden sm:inline">Settle</span>
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </CardContent>
                    </Card>
                )}
            </div>

            {/* Empty state */}
            {(!groupSummary || groupSummary.length === 0) &&
                (!topOwing || topOwing.length === 0) &&
                (!topOwed || topOwed.length === 0) && (
                    <Card className="border-border/50 shadow-sm">
                        <CardContent className="p-8 text-center">
                            <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center mx-auto mb-4">
                                <Users className="text-muted-foreground" size={32} />
                            </div>
                            <h3 className="font-display font-semibold text-lg text-foreground mb-2">
                                No group data yet
                            </h3>
                            <p className="text-muted-foreground mb-6">
                                Join or create a group to see your spending breakdown
                            </p>
                            <Button onClick={() => navigate('/groups')} className="shadow-lg shadow-primary/25">
                                <Users size={18} className="mr-2" />
                                Go to Groups
                            </Button>
                        </CardContent>
                    </Card>
                )}
        </div>
    );
};

export default GroupPeopleOverview;
