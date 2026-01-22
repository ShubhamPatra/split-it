import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    BarChart3, PieChart as PieChartIcon, TrendingUp, Calendar,
    Download, Loader2, Scale, Sparkles, ChevronDown, ChevronUp,
    CheckCircle, ArrowUpRight, ArrowDownRight, Users, Receipt, Target
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useGroups } from '../context/GroupContext';
import { useCurrency } from '../context/CurrencyContext';
import { getCategoryById } from '../data/categories';
import Navbar from '../components/layout/Navbar';
import CurrencySelector from '../components/common/CurrencySelector';
import PersonalInsightCard from '../components/insights/PersonalInsightCard';
import SmartInsights from '../components/insights/SmartInsights';
import GroupPeopleOverview from '../components/insights/GroupPeopleOverview';
import HorizontalScrollContainer from '../components/common/HorizontalScrollContainer';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Progress } from '../components/ui/progress';
import { useToast } from '../hooks/use-toast';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../components/ui/collapsible';
import apiClient from '../lib/apiClient';
import {
    PieChart, Pie, Cell, ResponsiveContainer, LineChart, Line, CartesianGrid, XAxis, YAxis
} from 'recharts';
import {
    calculateFinancialSnapshot,
    generatePersonalInsights,
    calculateSpendingPatterns,
    identifyTopOwing,
    identifyTopOwed,
    generateSmartInsights,
    calculateGroupSummary,
} from '../utils/insightCalculator';

const CHART_COLORS = [
    'hsl(158, 64%, 52%)', 'hsl(38, 92%, 58%)', 'hsl(0, 72%, 51%)', 'hsl(210, 100%, 56%)',
    'hsl(280, 60%, 50%)', 'hsl(142, 71%, 45%)', 'hsl(30, 80%, 55%)', 'hsl(320, 70%, 50%)',
];

const Insights = () => {
    const navigate = useNavigate();
    const { user, isAuthenticated } = useAuth();
    const { groups, expenses, settlements, getGroupBalances, profiles, loadGroupExpenses } = useGroups();
    const { formatAmount, displayCurrency } = useCurrency();
    const { toast } = useToast();
    const [exporting, setExporting] = useState(false);
    const [showAllCategories, setShowAllCategories] = useState(false);

    // Redirect if not authenticated
    useEffect(() => {
        if (!isAuthenticated) navigate('/login');
    }, [isAuthenticated, navigate]);

    // Filter user's groups and expenses
    const userGroups = useMemo(() =>
        groups.filter(g => g.members?.includes(user?.id || '')),
        [groups, user?.id]
    );

    // Comment 1 fix: Eagerly load expenses for all user groups
    // This ensures Insights computes from complete group expense data
    useEffect(() => {
        if (userGroups.length === 0) return;

        // Load expenses for each group (the lazy-loading guards in loadGroupExpenses
        // prevent duplicate loads for already-loaded groups)
        userGroups.forEach(group => {
            loadGroupExpenses(group.id);
        });
    }, [userGroups, loadGroupExpenses]);

    const userExpenses = useMemo(() =>
        expenses.filter(exp => userGroups.some(g => g.id === exp.groupId)),
        [expenses, userGroups]
    );

    // Calculate all insights using memoization
    const financialSnapshot = useMemo(() =>
        calculateFinancialSnapshot(groups, userExpenses, settlements, user?.id || '', getGroupBalances),
        [groups, userExpenses, settlements, user?.id, getGroupBalances]
    );

    const personalInsights = useMemo(() =>
        generatePersonalInsights(userExpenses, groups, user?.id || ''),
        [userExpenses, groups, user?.id]
    );

    const spendingPatterns = useMemo(() =>
        calculateSpendingPatterns(userExpenses),
        [userExpenses]
    );

    const topOwing = useMemo(() =>
        identifyTopOwing(groups, user?.id || '', profiles, getGroupBalances),
        [groups, user?.id, profiles, getGroupBalances]
    );

    const topOwed = useMemo(() =>
        identifyTopOwed(groups, user?.id || '', profiles, getGroupBalances),
        [groups, user?.id, profiles, getGroupBalances]
    );

    const smartInsights = useMemo(() =>
        generateSmartInsights(userExpenses, settlements, financialSnapshot, groups),
        [userExpenses, settlements, financialSnapshot, groups]
    );

    const groupSummary = useMemo(() =>
        calculateGroupSummary(groups, expenses, settlements, user?.id || '', getGroupBalances),
        [groups, expenses, settlements, user?.id, getGroupBalances]
    );

    // Export handler
    const handleExport = async () => {
        setExporting(true);
        try {
            await apiClient.post('/expenses/export');
            toast({
                title: 'Export Started',
                description: 'Your expense report will be emailed to you shortly.',
            });
        } catch (error) {
            toast({
                title: 'Export Failed',
                description: error.message || 'Failed to export expenses',
                variant: 'destructive',
            });
        } finally {
            setExporting(false);
        }
    };

    if (!isAuthenticated) return null;

    const currentMonth = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    const netBalance = financialSnapshot.netBalance;

    // Top category for sidebar
    const topCategory = spendingPatterns.categoryData.length > 0 ? spendingPatterns.categoryData[0] : null;

    return (
        <div className="min-h-screen bg-background">
            <Navbar />
            <main className="container-responsive py-6 sm:py-8 pb-safe md:pb-8">
                {/* Desktop Layout */}
                <div className="lg:grid lg:grid-cols-12 lg:gap-8">
                    {/* Main Content */}
                    <div className="lg:col-span-8 xl:col-span-9 space-y-6 lg:space-y-8">
                        {/* Header */}
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 animate-fade-in">
                            <div>
                                <h1 className="font-display text-2xl sm:text-3xl lg:text-4xl font-bold text-foreground mb-2">
                                    Insights
                                </h1>
                                <p className="text-muted-foreground flex items-center gap-2">
                                    <Calendar size={14} />
                                    <span>{currentMonth}</span>
                                    <span className="text-border">•</span>
                                    <span>Your financial overview at a glance</span>
                                </p>
                            </div>
                            <div className="flex items-center gap-3">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={handleExport}
                                    disabled={exporting}
                                    className="gap-2"
                                >
                                    {exporting ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                        <Download className="h-4 w-4" />
                                    )}
                                    <span className="hidden sm:inline">Export</span>
                                </Button>
                                <CurrencySelector />
                            </div>
                        </div>

                        {/* Section 1: Financial Snapshot (Hero) */}
                        <section aria-labelledby="financial-snapshot">
                            <h2 id="financial-snapshot" className="sr-only">Financial Snapshot</h2>

                            {/* Net Balance Hero Card - Mobile Only */}
                            <div className="lg:hidden mb-4">
                                <Card className={`border-2 shadow-lg animate-fade-in overflow-hidden ${netBalance >= 0 ? 'border-success/30 bg-gradient-to-br from-success/5 to-transparent' :
                                    'border-destructive/30 bg-gradient-to-br from-destructive/5 to-transparent'
                                    }`}>
                                    <CardContent className="p-5">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-4">
                                                <div className={`p-3 rounded-2xl ${netBalance >= 0 ? 'bg-success/20 border border-success/30' : 'bg-destructive/20 border border-destructive/30'}`}>
                                                    <Scale size={24} className={netBalance >= 0 ? 'text-success' : 'text-destructive'} />
                                                </div>
                                                <div>
                                                    <p className="text-sm text-muted-foreground mb-0.5">Net Balance</p>
                                                    <p className={`font-display text-2xl sm:text-3xl font-bold tracking-tight ${netBalance >= 0 ? 'text-success' : 'text-destructive'}`}>
                                                        {netBalance >= 0 ? '+' : ''}{formatAmount(netBalance)}
                                                    </p>
                                                </div>
                                            </div>
                                            <span className={`text-xs px-3 py-1 rounded-full ${netBalance >= 0 ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'}`}>
                                                {netBalance >= 0 ? "You're ahead!" : 'Settle up'}
                                            </span>
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>

                            {/* Stats Cards - Horizontal scroll on mobile */}
                            <div className="-mx-4 px-4 sm:mx-0 sm:px-0">
                                <HorizontalScrollContainer 
                                    ariaLabel="Financial snapshot cards"
                                    className="sm:grid sm:grid-cols-2 xl:grid-cols-4"
                                >
                                    <Card className="group animate-fade-in border-border/50 shadow-sm hover:shadow-lg hover:border-success/30 transition-all duration-300 min-w-[200px] sm:min-w-0 snap-start" style={{ animationDelay: '0.1s' }}>
                                        <CardContent className="p-4 sm:p-5">
                                            <div className="flex items-center gap-3">
                                                <div className="p-2.5 sm:p-3 rounded bg-success/10 border border-success/20 group-hover:scale-110 transition-transform duration-300">
                                                    <ArrowUpRight className="text-success" size={20} />
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="text-xs sm:text-sm text-muted-foreground mb-0.5">You're Owed</p>
                                                    <p className="font-display text-xl sm:text-2xl font-bold text-success truncate tracking-tight">
                                                        {formatAmount(financialSnapshot.totalOwed)}
                                                    </p>
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>

                                    <Card className="group animate-fade-in border-border/50 shadow-sm hover:shadow-lg hover:border-destructive/30 transition-all duration-300 min-w-[200px] sm:min-w-0 snap-start" style={{ animationDelay: '0.15s' }}>
                                        <CardContent className="p-4 sm:p-5">
                                            <div className="flex items-center gap-3">
                                                <div className="p-2.5 sm:p-3 rounded bg-destructive/10 border border-destructive/20 group-hover:scale-110 transition-transform duration-300">
                                                    <ArrowDownRight className="text-destructive" size={20} />
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="text-xs sm:text-sm text-muted-foreground mb-0.5">You Owe</p>
                                                    <p className="font-display text-xl sm:text-2xl font-bold text-destructive truncate tracking-tight">
                                                        {formatAmount(financialSnapshot.totalOwes)}
                                                    </p>
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>

                                    <Card className="group animate-fade-in border-border/50 shadow-sm hover:shadow-lg hover:border-primary/30 transition-all duration-300 min-w-[200px] sm:min-w-0 snap-start" style={{ animationDelay: '0.2s' }}>
                                        <CardContent className="p-4 sm:p-5">
                                            <div className="flex items-center gap-3">
                                                <div className="p-2.5 sm:p-3 rounded bg-primary/10 border border-primary/20 group-hover:scale-110 transition-transform duration-300">
                                                    <TrendingUp className="text-primary" size={20} />
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="text-xs sm:text-sm text-muted-foreground mb-0.5">This Month</p>
                                                    <p className="font-display text-xl sm:text-2xl font-bold text-foreground truncate tracking-tight">
                                                        {formatAmount(financialSnapshot.thisMonthTotal)}
                                                    </p>
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>

                                    <Card className="group animate-fade-in border-border/50 shadow-sm hover:shadow-lg hover:border-info/30 transition-all duration-300 min-w-[200px] sm:min-w-0 snap-start" style={{ animationDelay: '0.25s' }}>
                                        <CardContent className="p-4 sm:p-5">
                                            <div className="flex items-center gap-3">
                                                <div className="p-2.5 sm:p-3 rounded bg-info/10 border border-info/20 group-hover:scale-110 transition-transform duration-300">
                                                    <CheckCircle className="text-info" size={20} />
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="text-xs sm:text-sm text-muted-foreground mb-0.5">Total Settled</p>
                                                    <p className="font-display text-xl sm:text-2xl font-bold text-foreground truncate tracking-tight">
                                                        {formatAmount(financialSnapshot.totalSettled)}
                                                    </p>
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                </HorizontalScrollContainer>
                            </div>

                            {/* Settle Up CTA - Show only if there are pending debts */}
                            {financialSnapshot.hasUnsettledDebts && (
                                <div className="mt-4 animate-fade-in" style={{ animationDelay: '0.3s' }}>
                                    <Button
                                        onClick={() => navigate('/groups')}
                                        className="w-full sm:w-auto shadow-lg shadow-primary/25 gap-2"
                                        size="lg"
                                    >
                                        <Scale size={18} />
                                        Settle Up Now
                                    </Button>
                                </div>
                            )}
                        </section>

                        {/* Section 2: Personal Insights */}
                        {personalInsights.length > 0 && (
                            <section aria-labelledby="personal-insights">
                                <h2 id="personal-insights" className="font-display text-lg md:text-xl font-semibold text-foreground mb-4 flex items-center gap-2">
                                    <Sparkles size={20} className="text-primary" />
                                    Personal Insights
                                </h2>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {personalInsights.map((insight, index) => (
                                        <PersonalInsightCard
                                            key={insight.type}
                                            insight={insight}
                                            formatAmount={formatAmount}
                                            animationDelay={0.1 * index}
                                        />
                                    ))}
                                </div>
                            </section>
                        )}

                        {/* Section 3: Spending Patterns */}
                        <section aria-labelledby="spending-patterns">
                            <h2 id="spending-patterns" className="font-display text-lg md:text-xl font-semibold text-foreground mb-4 flex items-center gap-2">
                                <BarChart3 size={20} className="text-primary" />
                                Spending Patterns
                            </h2>

                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                                {/* Monthly Spending Trend */}
                                <Card className="animate-fade-in border-border/50 shadow-sm" style={{ animationDelay: '0.4s' }}>
                                    <CardHeader className="pb-2">
                                        <CardTitle className="flex items-center gap-2 text-lg">
                                            <div className="p-1.5 rounded-lg bg-info/10">
                                                <Calendar size={16} className="text-info" />
                                            </div>
                                            How Your Spending Changed
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        {spendingPatterns.monthlyData.length > 0 ? (
                                            <>
                                                <div className="h-[220px]">
                                                    <ResponsiveContainer width="100%" height="100%">
                                                        <LineChart data={spendingPatterns.monthlyData}>
                                                            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                                                            <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                                                            <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickFormatter={(value) => `${displayCurrency.symbol}${(value / 1000).toFixed(0)}k`} />
                                                            <Line type="monotone" dataKey="amount" stroke="hsl(var(--primary))" strokeWidth={3} dot={{ fill: 'hsl(var(--primary))', strokeWidth: 2, r: 4 }} activeDot={{ r: 6 }} />
                                                        </LineChart>
                                                    </ResponsiveContainer>
                                                </div>
                                                {spendingPatterns.highestMonth && spendingPatterns.lowestMonth && (
                                                    <div className="flex gap-4 mt-3 text-xs">
                                                        <span className="text-muted-foreground">
                                                            Highest: <span className="font-medium text-foreground">{spendingPatterns.highestMonth.month}</span>
                                                        </span>
                                                        <span className="text-muted-foreground">
                                                            Lowest: <span className="font-medium text-foreground">{spendingPatterns.lowestMonth.month}</span>
                                                        </span>
                                                    </div>
                                                )}
                                            </>
                                        ) : (
                                            <div className="h-[220px] flex flex-col items-center justify-center text-muted-foreground">
                                                <Calendar size={40} className="mb-3 opacity-30" />
                                                <p>No monthly data available</p>
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>

                                {/* Category Split */}
                                <Card className="animate-fade-in border-border/50 shadow-sm" style={{ animationDelay: '0.45s' }}>
                                    <CardHeader className="pb-2">
                                        <CardTitle className="flex items-center gap-2 text-lg">
                                            <div className="p-1.5 rounded-lg bg-primary/10">
                                                <PieChartIcon size={16} className="text-primary" />
                                            </div>
                                            Where Your Money Goes
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        {spendingPatterns.categoryData.length > 0 ? (() => {
                                            // Limit pie chart to top 3 categories + "Other" slice
                                            const top3 = spendingPatterns.categoryData.slice(0, 3);
                                            const otherCategories = spendingPatterns.categoryData.slice(3);
                                            const otherTotal = otherCategories.reduce((sum, cat) => sum + cat.amount, 0);
                                            const pieChartData = otherTotal > 0
                                                ? [...top3, { name: 'Other', amount: otherTotal, category: 'other' }]
                                                : top3;

                                            return (
                                                <div className="h-[220px]">
                                                    <ResponsiveContainer width="100%" height="100%">
                                                        <PieChart>
                                                            <Pie
                                                                data={pieChartData}
                                                                cx="50%"
                                                                cy="50%"
                                                                outerRadius={80}
                                                                innerRadius={45}
                                                                paddingAngle={3}
                                                                dataKey="amount"
                                                                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                                                                labelLine={false}
                                                            >
                                                                {pieChartData.map((_, index) => (
                                                                    <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                                                                ))}
                                                            </Pie>
                                                        </PieChart>
                                                    </ResponsiveContainer>
                                                </div>
                                            );
                                        })() : (
                                            <div className="h-[220px] flex flex-col items-center justify-center text-muted-foreground">
                                                <PieChartIcon size={40} className="mb-3 opacity-30" />
                                                <p>No category data available</p>
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>
                            </div>

                            {/* Category Breakdown with Collapsible */}
                            {spendingPatterns.categoryData.length > 0 && (
                                <Collapsible open={showAllCategories} onOpenChange={setShowAllCategories}>
                                    <Card className="animate-fade-in border-border/50 shadow-sm" style={{ animationDelay: '0.5s' }}>
                                        <CardHeader className="pb-3">
                                            <CardTitle className="text-base flex items-center gap-2">
                                                <Sparkles size={16} className="text-primary" />
                                                Category Breakdown
                                            </CardTitle>
                                        </CardHeader>
                                        <CardContent>
                                            <div className="space-y-2">
                                                {spendingPatterns.categoryData.slice(0, 3).map((cat, index) => {
                                                    const categoryInfo = getCategoryById(cat.category);
                                                    const IconComponent = categoryInfo.icon;
                                                    return (
                                                        <div key={cat.category} className="flex items-center gap-3 p-3 rounded-xl bg-card-elevated/50 border border-border/30 hover:border-border/50 transition-colors group">
                                                            <div className="p-2 rounded-lg group-hover:scale-110 transition-transform" style={{ backgroundColor: `${CHART_COLORS[index % CHART_COLORS.length]}15`, border: `1px solid ${CHART_COLORS[index % CHART_COLORS.length]}30` }}>
                                                                <IconComponent size={16} style={{ color: CHART_COLORS[index % CHART_COLORS.length] }} />
                                                            </div>
                                                            <div className="flex-1 min-w-0">
                                                                <div className="flex justify-between mb-1.5">
                                                                    <span className="font-medium text-sm text-foreground">{cat.name}</span>
                                                                    <span className="text-sm text-muted-foreground font-medium">{formatAmount(cat.amount)}</span>
                                                                </div>
                                                                <div className="h-1.5 bg-muted/50 rounded-full overflow-hidden">
                                                                    <div className="h-full rounded-full transition-all duration-500" style={{ width: `${cat.percentage}%`, backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }} />
                                                                </div>
                                                            </div>
                                                            <span className="text-xs font-semibold text-muted-foreground w-10 text-right">{cat.percentage.toFixed(0)}%</span>
                                                        </div>
                                                    );
                                                })}
                                            </div>

                                            <CollapsibleContent>
                                                <div className="space-y-2 mt-2">
                                                    {spendingPatterns.categoryData.slice(3).map((cat, index) => {
                                                        const categoryInfo = getCategoryById(cat.category);
                                                        const IconComponent = categoryInfo.icon;
                                                        const actualIndex = index + 3;
                                                        return (
                                                            <div key={cat.category} className="flex items-center gap-3 p-3 rounded-xl bg-card-elevated/50 border border-border/30 hover:border-border/50 transition-colors group">
                                                                <div className="p-2 rounded-lg group-hover:scale-110 transition-transform" style={{ backgroundColor: `${CHART_COLORS[actualIndex % CHART_COLORS.length]}15`, border: `1px solid ${CHART_COLORS[actualIndex % CHART_COLORS.length]}30` }}>
                                                                    <IconComponent size={16} style={{ color: CHART_COLORS[actualIndex % CHART_COLORS.length] }} />
                                                                </div>
                                                                <div className="flex-1 min-w-0">
                                                                    <div className="flex justify-between mb-1.5">
                                                                        <span className="font-medium text-sm text-foreground">{cat.name}</span>
                                                                        <span className="text-sm text-muted-foreground font-medium">{formatAmount(cat.amount)}</span>
                                                                    </div>
                                                                    <div className="h-1.5 bg-muted/50 rounded-full overflow-hidden">
                                                                        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${cat.percentage}%`, backgroundColor: CHART_COLORS[actualIndex % CHART_COLORS.length] }} />
                                                                    </div>
                                                                </div>
                                                                <span className="text-xs font-semibold text-muted-foreground w-10 text-right">{cat.percentage.toFixed(0)}%</span>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </CollapsibleContent>

                                            {spendingPatterns.categoryData.length > 3 && (
                                                <CollapsibleTrigger asChild>
                                                    <Button variant="ghost" size="sm" className="w-full mt-3 text-primary hover:bg-primary/10 gap-2">
                                                        {showAllCategories ? (
                                                            <>
                                                                <ChevronUp size={16} />
                                                                Show less
                                                            </>
                                                        ) : (
                                                            <>
                                                                <ChevronDown size={16} />
                                                                View all {spendingPatterns.categoryData.length} categories
                                                            </>
                                                        )}
                                                    </Button>
                                                </CollapsibleTrigger>
                                            )}
                                        </CardContent>
                                    </Card>
                                </Collapsible>
                            )}
                        </section>

                        {/* Section 4: Group & People Overview */}
                        <section aria-labelledby="group-people-overview">
                            <h2 id="group-people-overview" className="font-display text-lg md:text-xl font-semibold text-foreground mb-4 flex items-center gap-2">
                                <Users size={20} className="text-primary" />
                                Group & People Overview
                            </h2>
                            <GroupPeopleOverview
                                groupSummary={groupSummary}
                                topOwing={topOwing}
                                topOwed={topOwed}
                                formatAmount={formatAmount}
                                animationDelay={0.5}
                            />
                        </section>

                        {/* Section 5: Smart Insights */}
                        {smartInsights.length > 0 && (
                            <section aria-labelledby="smart-insights">
                                <SmartInsights insights={smartInsights} animationDelay={0.6} formatAmount={formatAmount} />
                            </section>
                        )}

                        {/* Empty State */}
                        {userExpenses.length === 0 && userGroups.length === 0 && (
                            <Card className="border-border/50 shadow-sm animate-fade-in">
                                <CardContent className="p-8 sm:p-12 text-center">
                                    <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center mx-auto mb-4">
                                        <Receipt className="text-muted-foreground" size={32} />
                                    </div>
                                    <h3 className="font-display font-semibold text-lg text-foreground mb-2">
                                        Start tracking your expenses
                                    </h3>
                                    <p className="text-muted-foreground mb-6">
                                        Join a group or create one to get started with expense tracking
                                    </p>
                                    <div className="flex flex-col sm:flex-row gap-3 justify-center">
                                        <Button onClick={() => navigate('/groups')} className="shadow-lg shadow-primary/25">
                                            <Users size={18} className="mr-2" />
                                            Go to Groups
                                        </Button>
                                        <Button onClick={() => navigate('/add-expense')} variant="outline">
                                            <Receipt size={18} className="mr-2" />
                                            Add Expense
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        )}
                    </div>

                    {/* Sidebar - Desktop Only */}
                    <aside className="hidden lg:block lg:col-span-4 xl:col-span-3">
                        <div className="sticky top-24 space-y-6">
                            {/* Net Balance Card */}
                            <Card className={`border-2 shadow-md animate-fade-in overflow-hidden ${netBalance >= 0 ? 'border-success/30 bg-muted/30' : 'border-destructive/30 bg-muted/30'}`} style={{ animationDelay: '0.3s' }}>
                                <CardContent className="p-5">
                                    <div className="text-center">
                                        <div className={`inline-flex p-4 rounded-2xl ${netBalance >= 0 ? 'bg-success/20 border border-success/30' : 'bg-destructive/20 border border-destructive/30'} mb-4`}>
                                            <Scale size={28} className={netBalance >= 0 ? 'text-success' : 'text-destructive'} />
                                        </div>
                                        <p className="text-sm text-muted-foreground mb-1">Net Balance</p>
                                        <p className={`font-display text-3xl font-bold tracking-tight ${netBalance >= 0 ? 'text-success' : 'text-destructive'}`}>
                                            {netBalance >= 0 ? '+' : ''}{formatAmount(netBalance)}
                                        </p>
                                        <p className={`text-xs mt-2 px-3 py-1 rounded-full inline-block ${netBalance >= 0 ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'}`}>
                                            {netBalance >= 0 ? "You're in the green!" : 'Time to settle up'}
                                        </p>
                                    </div>
                                </CardContent>
                            </Card>

                            {/* This Month */}
                            <Card className="border-border/50 shadow-sm animate-fade-in" style={{ animationDelay: '0.35s' }}>
                                <CardHeader className="pb-3">
                                    <CardTitle className="text-base font-semibold flex items-center gap-2">
                                        <Calendar size={16} className="text-primary" />
                                        This Month
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div>
                                        <div className="flex justify-between text-sm mb-2">
                                            <span className="text-muted-foreground">Spending</span>
                                            <span className="font-semibold text-foreground">{formatAmount(financialSnapshot.thisMonthTotal)}</span>
                                        </div>
                                        <Progress value={financialSnapshot.totalExpenses > 0 ? Math.min((financialSnapshot.thisMonthTotal / (financialSnapshot.totalExpenses / 6)) * 100, 100) : 0} className="h-2" />
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-muted-foreground">Transactions</span>
                                        <span className="font-semibold text-foreground">{financialSnapshot.thisMonthExpenseCount}</span>
                                    </div>
                                    {topCategory && (
                                        <div className="pt-2 border-t border-border/50">
                                            <p className="text-xs text-muted-foreground mb-2">Top Category</p>
                                            <div className="flex items-center justify-between">
                                                <span className="font-medium text-foreground">{topCategory.name}</span>
                                                <span className="text-sm text-primary font-semibold">{topCategory.percentage.toFixed(0)}%</span>
                                            </div>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>

                            {/* Quick Stats */}
                            <Card className="border-border/50 shadow-sm animate-fade-in" style={{ animationDelay: '0.4s' }}>
                                <CardHeader className="pb-3">
                                    <CardTitle className="text-base font-semibold flex items-center gap-2">
                                        <Target size={16} className="text-primary" />
                                        Quick Stats
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-3">
                                    <div className="flex justify-between text-sm">
                                        <span className="text-muted-foreground">Total Expenses</span>
                                        <span className="font-semibold text-foreground">{financialSnapshot.expenseCount}</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-muted-foreground">Active Groups</span>
                                        <span className="font-semibold text-foreground">{financialSnapshot.groupCount}</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-muted-foreground">Categories Used</span>
                                        <span className="font-semibold text-foreground">{spendingPatterns.categoryData.length}</span>
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Quick Actions */}
                            <Card className="border-border/50 shadow-sm animate-fade-in" style={{ animationDelay: '0.45s' }}>
                                <CardContent className="p-5 space-y-2">
                                    <Button onClick={() => navigate('/add-expense')} className="w-full justify-start gap-3 h-11 shadow-md">
                                        <Receipt size={16} />
                                        Add Expense
                                    </Button>
                                    <Button onClick={() => navigate('/groups')} variant="outline" className="w-full justify-start gap-3 h-11">
                                        <Users size={16} className="text-primary" />
                                        View Groups
                                    </Button>
                                </CardContent>
                            </Card>
                        </div>
                    </aside>
                </div>

                {/* Mobile Quick Actions */}
                <div className="lg:hidden mt-6 animate-fade-in" style={{ animationDelay: '0.6s' }}>
                    <div className="flex gap-3">
                        <Button onClick={() => navigate('/groups')} variant="outline" className="flex-1 h-12">
                            <Users size={18} className="mr-2" />
                            Groups
                        </Button>
                        <Button onClick={() => navigate('/add-expense')} className="flex-1 h-12 shadow-lg shadow-primary/25">
                            <Receipt size={18} className="mr-2" />
                            Add Expense
                        </Button>
                    </div>
                </div>
            </main>
        </div>
    );
};

export default Insights;
