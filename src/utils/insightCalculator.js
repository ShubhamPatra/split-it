/**
 * Insight Calculator Utilities
 * Functions to calculate financial insights for the Insights page
 */

import { getCategoryById } from '../data/categories';
import { calculateOptimalSettlements } from './settlementOptimizer';

/**
 * Calculate financial snapshot for a user
 * @param {Array} groups - User's groups
 * @param {Array} expenses - All expenses
 * @param {Array} settlements - All settlements
 * @param {string} userId - Current user ID
 * @param {Function} getGroupBalances - Function to get group balances
 * @returns {Object} Financial snapshot data
 */
export function calculateFinancialSnapshot(groups, expenses, settlements, userId, getGroupBalances) {
    const userGroups = groups.filter(g => g.members?.includes(userId));

    let totalOwed = 0;
    let totalOwes = 0;

    userGroups.forEach(group => {
        const balances = getGroupBalances(group.id);
        const userBalance = balances[userId] || 0;
        if (userBalance > 0) totalOwed += userBalance;
        else totalOwes += Math.abs(userBalance);
    });

    const netBalance = totalOwed - totalOwes;

    // Calculate this month's spending
    const now = new Date();
    const thisMonthExpenses = expenses.filter(exp => {
        const expDate = new Date(exp.date);
        return expDate.getMonth() === now.getMonth() && expDate.getFullYear() === now.getFullYear();
    });
    const thisMonthTotal = thisMonthExpenses.reduce((sum, exp) => sum + exp.amount, 0);

    // Total confirmed settlements - filter to only user's groups and settlements involving the user
    const userGroupIds = new Set(userGroups.map(g => g.id));
    const totalSettled = settlements
        .filter(s =>
            s.paymentStatus === 'confirmed' &&
            userGroupIds.has(s.groupId) &&
            (s.from === userId || s.to === userId)
        )
        .reduce((sum, s) => sum + s.amount, 0);

    const totalExpenses = expenses.reduce((sum, exp) => sum + exp.amount, 0);

    return {
        netBalance,
        totalOwed,
        totalOwes,
        thisMonthTotal,
        thisMonthExpenseCount: thisMonthExpenses.length,
        totalSettled,
        totalExpenses,
        hasUnsettledDebts: totalOwes > 0,
        groupCount: userGroups.length,
        expenseCount: expenses.length,
    };
}

/**
 * Generate personal insights based on spending patterns
 * @param {Array} expenses - User's expenses
 * @param {Array} groups - User's groups
 * @param {string} userId - Current user ID
 * @returns {Array} Array of insight objects
 */
export function generatePersonalInsights(expenses, groups, userId) {
    const insights = [];

    if (expenses.length === 0) return insights;

    // Calculate category breakdown
    const categoryTotals = {};
    let totalAmount = 0;

    expenses.forEach(exp => {
        const category = exp.category || 'other';
        categoryTotals[category] = (categoryTotals[category] || 0) + exp.amount;
        totalAmount += exp.amount;
    });

    const sortedCategories = Object.entries(categoryTotals)
        .map(([category, amount]) => ({ category, amount, percentage: (amount / totalAmount) * 100 }))
        .sort((a, b) => b.amount - a.amount);

    // Top category insight
    if (sortedCategories.length > 0) {
        const topCategory = sortedCategories[0];
        const categoryInfo = getCategoryById(topCategory.category);
        insights.push({
            type: 'top-category',
            title: `Most of your money goes to ${categoryInfo.name}`,
            description: `${topCategory.percentage.toFixed(0)}% of your expenses are in this category`,
            data: {
                category: topCategory.category,
                categoryName: categoryInfo.name,
                percentage: topCategory.percentage,
                amount: topCategory.amount,
                color: categoryInfo.color,
            },
            priority: 1,
        });
    }

    // Group concentration insight
    const groupTotals = {};
    expenses.forEach(exp => {
        groupTotals[exp.groupId] = (groupTotals[exp.groupId] || 0) + exp.amount;
    });

    const sortedGroups = Object.entries(groupTotals)
        .map(([groupId, amount]) => {
            const group = groups.find(g => g.id === groupId);
            return { groupId, groupName: group?.name || 'Unknown', amount, percentage: (amount / totalAmount) * 100 };
        })
        .sort((a, b) => b.amount - a.amount);

    if (sortedGroups.length > 0 && sortedGroups[0].percentage > 40) {
        insights.push({
            type: 'group-concentration',
            title: `You mostly spend in "${sortedGroups[0].groupName}"`,
            description: `${sortedGroups[0].percentage.toFixed(0)}% of your expenses are in this group`,
            data: sortedGroups[0],
            priority: 2,
        });
    }

    // Monthly trend insight
    const monthlyTotals = {};
    expenses.forEach(exp => {
        const date = new Date(exp.date);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        monthlyTotals[monthKey] = (monthlyTotals[monthKey] || 0) + exp.amount;
    });

    const sortedMonths = Object.entries(monthlyTotals).sort(([a], [b]) => b.localeCompare(a));

    if (sortedMonths.length >= 2) {
        const currentMonthTotal = sortedMonths[0][1];
        const prevMonthTotal = sortedMonths[1][1];

        // Comment 3 fix: Guard against zero/negative previous month to avoid Infinity/NaN
        if (prevMonthTotal <= 0) {
            // First spending month or previous month had no expenses
            if (currentMonthTotal > 0) {
                insights.push({
                    type: 'monthly-trend',
                    title: 'First spending month tracked!',
                    description: 'No previous month data to compare',
                    data: {
                        currentMonth: currentMonthTotal,
                        prevMonth: 0,
                        changePercent: null,
                        trend: 'new',
                    },
                    priority: 3,
                });
            }
        } else {
            const changePercent = ((currentMonthTotal - prevMonthTotal) / prevMonthTotal) * 100;

            if (Math.abs(changePercent) > 10) {
                insights.push({
                    type: 'monthly-trend',
                    title: `Your spending ${changePercent > 0 ? 'increased' : 'decreased'} by ${Math.abs(changePercent).toFixed(0)}%`,
                    description: 'Compared to last month',
                    data: {
                        currentMonth: currentMonthTotal,
                        prevMonth: prevMonthTotal,
                        changePercent,
                        trend: changePercent > 0 ? 'up' : 'down',
                    },
                    priority: 3,
                });
            }
        }
    }

    return insights.sort((a, b) => a.priority - b.priority);
}

/**
 * Calculate spending patterns for charts
 * @param {Array} expenses - User's expenses
 * @returns {Object} Spending pattern data
 */
export function calculateSpendingPatterns(expenses) {
    // Monthly data (last 6 months)
    const monthlyTotals = {};
    expenses.forEach(exp => {
        const date = new Date(exp.date);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        monthlyTotals[monthKey] = (monthlyTotals[monthKey] || 0) + exp.amount;
    });

    const monthlyData = Object.entries(monthlyTotals)
        .sort(([a], [b]) => a.localeCompare(b))
        .slice(-6)
        .map(([month, amount]) => {
            const [year, monthNum] = month.split('-');
            const monthName = new Date(parseInt(year), parseInt(monthNum) - 1).toLocaleString('default', { month: 'short' });
            return { month: monthName, amount, fullMonth: month };
        });

    // Category data
    const categoryTotals = {};
    expenses.forEach(exp => {
        const category = exp.category || 'other';
        categoryTotals[category] = (categoryTotals[category] || 0) + exp.amount;
    });

    const totalAmount = expenses.reduce((sum, exp) => sum + exp.amount, 0);
    const categoryData = Object.entries(categoryTotals)
        .map(([category, amount]) => {
            const categoryInfo = getCategoryById(category);
            return {
                category,
                name: categoryInfo.name,
                amount,
                percentage: totalAmount > 0 ? (amount / totalAmount) * 100 : 0,
                icon: categoryInfo.icon,
                color: categoryInfo.color,
            };
        })
        .sort((a, b) => b.amount - a.amount);

    // Find highest/lowest months
    let highestMonth = null;
    let lowestMonth = null;

    if (monthlyData.length > 0) {
        highestMonth = monthlyData.reduce((max, m) => m.amount > max.amount ? m : max, monthlyData[0]);
        lowestMonth = monthlyData.reduce((min, m) => m.amount < min.amount ? m : min, monthlyData[0]);
    }

    return {
        monthlyData,
        categoryData,
        highestMonth,
        lowestMonth,
        totalAmount,
    };
}

/**
 * Identify who owes the user the most (pairwise debts from current user's perspective)
 * Comment 2 fix: Uses calculateOptimalSettlements to derive actual pairwise debts
 * @param {Array} groups - User's groups
 * @param {string} userId - Current user ID
 * @param {Object} profiles - User profiles
 * @param {Function} getGroupBalances - Function to get group balances
 * @returns {Array} Ranked list of people who owe the user
 */
export function identifyTopOwing(groups, userId, profiles, getGroupBalances) {
    const owingByPerson = {};

    groups.forEach(group => {
        if (!group.members?.includes(userId)) return;

        const balances = getGroupBalances(group.id);

        // Use optimal settlements to derive pairwise debts
        const settlements = calculateOptimalSettlements(balances);

        // Filter settlements where the current user is the creditor (to)
        settlements
            .filter(s => s.to === userId)
            .forEach(settlement => {
                // This person (from) owes the current user
                owingByPerson[settlement.from] = (owingByPerson[settlement.from] || 0) + settlement.amount;
            });
    });

    return Object.entries(owingByPerson)
        .map(([personId, amount]) => ({
            userId: personId,
            name: profiles[personId]?.name || 'Unknown User',
            email: profiles[personId]?.email,
            amount,
        }))
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 5);
}

/**
 * Identify who the user owes the most (pairwise debts from current user's perspective)
 * Comment 2 fix: Uses calculateOptimalSettlements to derive actual pairwise debts
 * @param {Array} groups - User's groups
 * @param {string} userId - Current user ID
 * @param {Object} profiles - User profiles
 * @param {Function} getGroupBalances - Function to get group balances
 * @returns {Array} Ranked list of people the user owes
 */
export function identifyTopOwed(groups, userId, profiles, getGroupBalances) {
    const owedByPerson = {};

    groups.forEach(group => {
        if (!group.members?.includes(userId)) return;

        const balances = getGroupBalances(group.id);

        // Use optimal settlements to derive pairwise debts
        const settlements = calculateOptimalSettlements(balances);

        // Filter settlements where the current user is the debtor (from)
        settlements
            .filter(s => s.from === userId)
            .forEach(settlement => {
                // Current user owes this person (to)
                owedByPerson[settlement.to] = (owedByPerson[settlement.to] || 0) + settlement.amount;
            });
    });

    return Object.entries(owedByPerson)
        .map(([personId, amount]) => ({
            userId: personId,
            name: profiles[personId]?.name || 'Unknown User',
            email: profiles[personId]?.email,
            amount,
        }))
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 5);
}

/**
 * Generate smart, actionable insights
 * @param {Array} expenses - All expenses
 * @param {Array} settlements - All settlements
 * @param {Object} snapshot - Financial snapshot
 * @param {Array} groups - User's groups
 * @returns {Array} Array of smart insight objects
 */
export function generateSmartInsights(expenses, settlements, snapshot, groups) {
    const insights = [];

    // Settlement reminder
    const confirmedSettlements = settlements.filter(s => s.paymentStatus === 'confirmed');
    if (confirmedSettlements.length > 0) {
        const lastSettlement = confirmedSettlements.sort((a, b) =>
            new Date(b.settledAt) - new Date(a.settledAt)
        )[0];

        const daysSinceLastSettlement = Math.floor(
            (Date.now() - new Date(lastSettlement.settledAt).getTime()) / (1000 * 60 * 60 * 24)
        );

        if (daysSinceLastSettlement > 14 && snapshot.hasUnsettledDebts) {
            insights.push({
                type: 'settlement-reminder',
                icon: 'AlertCircle',
                title: `You haven't settled in ${daysSinceLastSettlement} days`,
                description: 'Consider clearing your pending debts',
                color: 'warning',
                priority: 1,
                action: { label: 'Settle Up', path: '/groups' },
            });
        }
    } else if (snapshot.hasUnsettledDebts) {
        insights.push({
            type: 'no-settlements',
            icon: 'AlertCircle',
            title: "You haven't made any settlements yet",
            description: 'Start settling your debts to balance up',
            color: 'warning',
            priority: 1,
            action: { label: 'Settle Up', path: '/groups' },
        });
    }

    // Weekend spending pattern
    const weekendExpenses = expenses.filter(exp => {
        const day = new Date(exp.date).getDay();
        return day === 0 || day === 6;
    });
    const weekdayExpenses = expenses.filter(exp => {
        const day = new Date(exp.date).getDay();
        return day > 0 && day < 6;
    });

    if (weekendExpenses.length > 0 && weekdayExpenses.length > 0) {
        const avgWeekend = weekendExpenses.reduce((s, e) => s + e.amount, 0) / weekendExpenses.length;
        const avgWeekday = weekdayExpenses.reduce((s, e) => s + e.amount, 0) / weekdayExpenses.length;

        if (avgWeekend > avgWeekday * 1.3) {
            // Comment 4 fix: Return numeric values, format at render time
            insights.push({
                type: 'weekend-pattern',
                icon: 'TrendingUp',
                title: 'You usually spend more on weekends',
                description: null, // Will be formatted at render time using formatAmount
                data: {
                    weekendAverage: Math.round(avgWeekend),
                    weekdayAverage: Math.round(avgWeekday),
                },
                color: 'info',
                priority: 3,
            });
        }
    }

    // Group concentration warning
    if (groups.length > 1) {
        const groupTotals = {};
        expenses.forEach(exp => {
            groupTotals[exp.groupId] = (groupTotals[exp.groupId] || 0) + exp.amount;
        });

        const totalExpenses = Object.values(groupTotals).reduce((a, b) => a + b, 0);
        const topGroup = Object.entries(groupTotals).sort((a, b) => b[1] - a[1])[0];

        if (topGroup && (topGroup[1] / totalExpenses) > 0.6) {
            const groupName = groups.find(g => g.id === topGroup[0])?.name || 'one group';
            insights.push({
                type: 'group-concentration',
                icon: 'Users',
                title: `Your expenses are concentrated in "${groupName}"`,
                description: `${Math.round((topGroup[1] / totalExpenses) * 100)}% of spending in one group`,
                color: 'info',
                priority: 4,
            });
        }
    }

    // Monthly settlement achievement
    const now = new Date();
    const thisMonthSettlements = confirmedSettlements.filter(s => {
        const date = new Date(s.settledAt);
        return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
    });

    const thisMonthSettledAmount = thisMonthSettlements.reduce((sum, s) => sum + s.amount, 0);

    if (thisMonthSettledAmount > 0) {
        // Comment 4 fix: Return numeric value, format at render time
        insights.push({
            type: 'achievement',
            icon: 'CheckCircle',
            title: null, // Will be formatted at render time using formatAmount
            data: {
                settledAmount: thisMonthSettledAmount,
                settlementCount: thisMonthSettlements.length,
            },
            description: `${thisMonthSettlements.length} settlement${thisMonthSettlements.length > 1 ? 's' : ''} completed`,
            color: 'success',
            priority: 5,
        });
    }

    // All settled up achievement
    if (!snapshot.hasUnsettledDebts && snapshot.totalOwes === 0 && expenses.length > 0) {
        insights.push({
            type: 'all-settled',
            icon: 'CheckCircle2',
            title: "All settled up! 🎉",
            description: "You have no pending settlements",
            color: 'success',
            priority: 0,
        });
    }

    return insights.sort((a, b) => a.priority - b.priority).slice(0, 4);
}

/**
 * Calculate group summary data
 * @param {Array} groups - User's groups
 * @param {Array} expenses - All expenses
 * @param {Array} settlements - All settlements
 * @param {string} userId - Current user ID
 * @param {Function} getGroupBalances - Function to get group balances
 * @returns {Array} Group summary data
 */
export function calculateGroupSummary(groups, expenses, settlements, userId, getGroupBalances) {
    const userGroups = groups.filter(g => g.members?.includes(userId));

    return userGroups.map(group => {
        const groupExpenses = expenses.filter(exp => exp.groupId === group.id);
        const groupSettlements = settlements.filter(set => set.groupId === group.id);
        const confirmedSettlements = groupSettlements.filter(s => s.paymentStatus === 'confirmed');

        const totalExpenses = groupExpenses.reduce((sum, exp) => sum + exp.amount, 0);
        const totalSettled = confirmedSettlements.reduce((sum, s) => sum + s.amount, 0);

        const balances = getGroupBalances(group.id);
        const userBalance = balances[userId] || 0;

        return {
            group,
            totalExpenses,
            totalSettled,
            userBalance,
            expenseCount: groupExpenses.length,
            settlementCount: groupSettlements.length,
            memberCount: group.members?.length || 0,
        };
    }).sort((a, b) => b.totalExpenses - a.totalExpenses);
}
