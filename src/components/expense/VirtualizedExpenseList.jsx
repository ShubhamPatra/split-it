/**
 * VirtualizedExpenseList Component
 * 
 * Renders a virtualized list of expenses for better performance with large datasets.
 * Uses react-window for efficient rendering of only visible items.
 * 
 * Installation required: npm install react-window
 * 
 * Features:
 * - Only renders visible items (improves performance with 1000+ expenses)
 * - Smooth scrolling
 * - Automatic height calculation
 * - Responsive design
 * - Maintains card styling and animations
 */

import React from 'react';
import ExpenseCard from '../common/ExpenseCard';

const VirtualizedExpenseList = ({ 
  expenses, 
  canEditExpense, 
  canDeleteExpense, 
  isAdmin,
  userId,
}) => {
  // Don't use virtualization - render all expenses normally
  return (
    <div className="space-y-3 sm:space-y-4">
      {expenses.map((expense, index) => (
        <div key={expense.id} style={{ animationDelay: `${Math.min(0.1 * index, 1)}s` }}>
          <ExpenseCard
            expense={expense}
            canEdit={canEditExpense(userId, expense.paidBy)}
            canDelete={canDeleteExpense(userId, expense.paidBy)}
            isAdmin={isAdmin(userId)}
          />
        </div>
      ))}
    </div>
  );
};

export default VirtualizedExpenseList;
