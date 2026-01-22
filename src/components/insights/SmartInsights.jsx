import React from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, TrendingUp, CheckCircle, CheckCircle2, Users, Lightbulb } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';

/**
 * Icon mapping for smart insights
 */
const iconMap = {
    AlertCircle,
    TrendingUp,
    CheckCircle,
    CheckCircle2,
    Users,
    Lightbulb,
};

/**
 * Color classes for different insight types
 * Includes explicit hover classes for Tailwind JIT detection
 */
const colorClasses = {
    warning: {
        bg: 'bg-warning/10',
        border: 'border-warning/20',
        text: 'text-warning',
        badge: 'bg-warning/20 text-warning',
        hoverBg: 'hover:bg-warning/20',
    },
    info: {
        bg: 'bg-info/10',
        border: 'border-info/20',
        text: 'text-info',
        badge: 'bg-info/20 text-info',
        hoverBg: 'hover:bg-info/20',
    },
    success: {
        bg: 'bg-success/10',
        border: 'border-success/20',
        text: 'text-success',
        badge: 'bg-success/20 text-success',
        hoverBg: 'hover:bg-success/20',
    },
    destructive: {
        bg: 'bg-destructive/10',
        border: 'border-destructive/20',
        text: 'text-destructive',
        badge: 'bg-destructive/20 text-destructive',
        hoverBg: 'hover:bg-destructive/20',
    },
};

/**
 * Smart Insights Component
 * Displays auto-generated, actionable insights
 * Comment 4 fix: Added formatAmount prop to properly format currency values
 */
const SmartInsights = ({ insights, animationDelay = 0, formatAmount }) => {
    const navigate = useNavigate();

    if (!insights || insights.length === 0) {
        return null;
    }

    /**
     * Comment 4 fix: Get formatted title for insights that need dynamic formatting
     */
    const getFormattedTitle = (insight) => {
        // If title is already set, use it
        if (insight.title) return insight.title;

        // Handle achievement insight - needs formatAmount
        if (insight.type === 'achievement' && insight.data?.settledAmount !== undefined) {
            const amount = formatAmount ? formatAmount(insight.data.settledAmount) : `₹${insight.data.settledAmount.toLocaleString()}`;
            return `You cleared ${amount} this month`;
        }

        return insight.title || 'Insight';
    };

    /**
     * Comment 4 fix: Get formatted description for insights that need dynamic formatting
     */
    const getFormattedDescription = (insight) => {
        // If description is already set, use it
        if (insight.description) return insight.description;

        // Handle weekend-pattern insight - needs formatAmount
        if (insight.type === 'weekend-pattern' && insight.data?.weekendAverage !== undefined) {
            const weekendAvg = formatAmount ? formatAmount(insight.data.weekendAverage) : `₹${insight.data.weekendAverage}`;
            const weekdayAvg = formatAmount ? formatAmount(insight.data.weekdayAverage) : `₹${insight.data.weekdayAverage}`;
            return `Weekend average: ${weekendAvg} vs Weekday: ${weekdayAvg}`;
        }

        return insight.description || '';
    };

    return (
        <Card
            className="animate-fade-in border-border shadow-sm"
            style={{ animationDelay: `${animationDelay}s` }}
        >
            <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                    <Lightbulb size={16} className="text-primary" />
                    Smart Insights
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
                {insights.map((insight, index) => {
                    const IconComponent = iconMap[insight.icon] || Lightbulb;
                    const colors = colorClasses[insight.color] || colorClasses.info;
                    const title = getFormattedTitle(insight);
                    const description = getFormattedDescription(insight);

                    return (
                        <div
                            key={`${insight.type}-${index}`}
                            className={`flex items-start gap-3 p-3 rounded border-l-4 ${colors.border} bg-card transition-colors duration-150 hover:bg-muted`}
                        >
                            <IconComponent size={18} className={colors.text} />
                            <div className="flex-1 min-w-0">
                                <div className="flex items-start justify-between gap-2 mb-1">
                                    <h4 className="font-medium text-foreground text-sm leading-tight">
                                        {title}
                                    </h4>
                                    {insight.type === 'achievement' && (
                                        <Badge variant="default" className="text-xs px-2 py-0.5 flex-shrink-0">
                                            New
                                        </Badge>
                                    )}
                                </div>
                                {description && (
                                    <p className="text-xs text-muted-foreground mb-2">
                                        {description}
                                    </p>
                                )}
                                {insight.action && (
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        className={`h-8 px-3 text-xs ${colors.text} hover:bg-muted`}
                                        onClick={() => navigate(insight.action.path)}
                                    >
                                        {insight.action.label}
                                    </Button>
                                )}
                            </div>
                        </div>
                    );
                })}
            </CardContent>
        </Card>
    );
};

export default SmartInsights;
