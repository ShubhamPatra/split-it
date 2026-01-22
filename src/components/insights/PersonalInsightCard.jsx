import React from 'react';
import { TrendingUp, TrendingDown, Target, Users, HelpCircle } from 'lucide-react';
import { Card, CardContent } from '../ui/card';
import { Progress } from '../ui/progress';
import { getCategoryById } from '../../data/categories';

/**
 * Personal Insight Card Component
 * Displays human-readable insights with supporting visuals
 */
const PersonalInsightCard = ({ insight, formatAmount, animationDelay = 0 }) => {
    if (!insight) return null;

    const renderInsightContent = () => {
        switch (insight.type) {
            case 'top-category': {
                // Guard against undefined category from getCategoryById
                const category = getCategoryById(insight.data.category);
                const CategoryIcon = category?.icon || HelpCircle;
                return (
                    <div className="flex items-center gap-4">
                        <div
                            className="p-3 rounded-xl"
                            style={{
                                backgroundColor: `hsl(var(--primary) / 0.1)`,
                                border: `1px solid hsl(var(--primary) / 0.2)`,
                            }}
                        >
                            <CategoryIcon size={24} className="text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <h3 className="font-medium text-foreground text-sm sm:text-base mb-1">{insight.title}</h3>
                            <p className="text-xs text-muted-foreground mb-2">{insight.description}</p>
                            <div className="flex items-center gap-2">
                                <Progress
                                    value={insight.data.percentage}
                                    className="h-2 flex-1"
                                />
                                <span className="text-xs font-semibold text-primary min-w-[40px] text-right">
                                    {insight.data.percentage.toFixed(0)}%
                                </span>
                            </div>
                        </div>
                    </div>
                );
            }

            case 'group-concentration': {
                return (
                    <div className="flex items-center gap-4">
                        <div className="p-3 rounded-xl bg-info/10 border border-info/20">
                            <Users size={24} className="text-info" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <h3 className="font-medium text-foreground text-sm sm:text-base mb-1">{insight.title}</h3>
                            <p className="text-xs text-muted-foreground mb-2">{insight.description}</p>
                            <div className="flex items-center gap-2">
                                <Progress
                                    value={insight.data.percentage}
                                    className="h-2 flex-1"
                                />
                                <span className="text-xs font-semibold text-info min-w-[40px] text-right">
                                    {insight.data.percentage.toFixed(0)}%
                                </span>
                            </div>
                        </div>
                    </div>
                );
            }

            case 'monthly-trend': {
                const isUp = insight.data.trend === 'up';
                const isNew = insight.data.trend === 'new';
                const TrendIcon = isUp || isNew ? TrendingUp : TrendingDown;

                // Static class map to prevent Tailwind purging dynamic class names
                const trendStyles = {
                    up: {
                        container: 'bg-destructive/10 border-destructive/20',
                        icon: 'text-destructive',
                        text: 'text-destructive',
                    },
                    down: {
                        container: 'bg-success/10 border-success/20',
                        icon: 'text-success',
                        text: 'text-success',
                    },
                    new: {
                        container: 'bg-info/10 border-info/20',
                        icon: 'text-info',
                        text: 'text-info',
                    },
                };
                const styles = isNew ? trendStyles.new : (isUp ? trendStyles.up : trendStyles.down);

                return (
                    <div className="flex items-center gap-4">
                        <div className={`p-3 rounded-xl border ${styles.container}`}>
                            <TrendIcon size={24} className={styles.icon} />
                        </div>
                        <div className="flex-1 min-w-0">
                            <h3 className="font-medium text-foreground text-sm sm:text-base mb-1">{insight.title}</h3>
                            <p className="text-xs text-muted-foreground mb-2">{insight.description}</p>
                            {!isNew && (
                                <div className="flex items-center gap-3 text-xs">
                                    <span className="text-muted-foreground">
                                        Last: {formatAmount(insight.data.prevMonth)}
                                    </span>
                                    <span className={`font-semibold ${styles.text}`}>
                                        Now: {formatAmount(insight.data.currentMonth)}
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>
                );
            }

            default: {
                return (
                    <div className="flex items-center gap-4">
                        <div className="p-3 rounded-xl bg-primary/10 border border-primary/20">
                            <Target size={24} className="text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <h3 className="font-medium text-foreground text-sm sm:text-base mb-1">{insight.title}</h3>
                            <p className="text-xs text-muted-foreground">{insight.description}</p>
                        </div>
                    </div>
                );
            }
        }
    };

    return (
        <Card
            className="animate-fade-in border-border/50 shadow-sm hover:shadow-md hover:border-primary/20 transition-all duration-300"
            style={{ animationDelay: `${animationDelay}s` }}
        >
            <CardContent className="p-4">
                {renderInsightContent()}
            </CardContent>
        </Card>
    );
};

export default PersonalInsightCard;
