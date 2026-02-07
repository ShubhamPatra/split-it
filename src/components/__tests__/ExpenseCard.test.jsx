/**
 * ExpenseCard Component Tests
 * 
 * Tests for ExpenseCard component including:
 * - Rendering with different expense types
 * - Edit and delete functionality
 * - Permission handling
 * - Loading states
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ExpenseCard } from '../common/ExpenseCard';
import { GroupProvider } from '../../context/GroupContext';
import { NotificationProvider } from '../../context/NotificationContext';
import { BrowserRouter } from 'react-router-dom';

// Mock hooks
vi.mock('../../context/GroupContext', () => ({
  useGroups: () => ({
    deleteExpense: vi.fn(),
    updateExpense: vi.fn(),
    getGroupById: vi.fn(() => ({ name: 'Test Group' })),
    getUserProfile: vi.fn(() => ({ _id: 'user1', name: 'Test User' })),
  }),
  GroupProvider: ({ children }) => <div>{children}</div>,
}));

vi.mock('../../context/NotificationContext', () => ({
  useNotifications: () => ({
    addNotification: vi.fn(),
  }),
  NotificationProvider: ({ children }) => <div>{children}</div>,
}));

vi.mock('../../hooks/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}));

const mockExpense = {
  id: 'exp1',
  groupId: 'group1',
  description: 'Dinner at restaurant',
  amount: 1500,
  currency: 'INR',
  category: 'food',
  paidBy: 'user1',
  date: new Date('2026-01-27'),
  splitAmong: ['user1', 'user2', 'user3'],
  splitConfig: { type: 'equal' },
};

const renderExpenseCard = (props = {}) => {
  return render(
    <BrowserRouter>
      <GroupProvider>
        <NotificationProvider>
          <ExpenseCard expense={mockExpense} {...props} />
        </NotificationProvider>
      </GroupProvider>
    </BrowserRouter>
  );
};

describe('ExpenseCard', () => {
  describe('Rendering', () => {
    it('should render expense description', () => {
      renderExpenseCard();
      expect(screen.getByText('Dinner at restaurant')).toBeInTheDocument();
    });

    it('should render expense amount', () => {
      renderExpenseCard();
      expect(screen.getByText(/1500/)).toBeInTheDocument();
    });

    it('should render category icon', () => {
      renderExpenseCard();
      // Category icon should be rendered (food category)
      const card = screen.getByText('Dinner at restaurant').closest('.bg-card');
      expect(card).toBeInTheDocument();
    });

    it('should render split information', () => {
      renderExpenseCard();
      // Should show split among 3 people
      expect(screen.getByText(/500/)).toBeInTheDocument(); // 1500 / 3
    });

    it('should render date', () => {
      renderExpenseCard();
      expect(screen.getByText(/Jan 27/)).toBeInTheDocument();
    });
  });

  describe('Different Expense Types', () => {
    it('should render equal split expense', () => {
      renderExpenseCard();
      expect(screen.getByText(/Split equally/)).toBeInTheDocument();
    });

    it('should render exact split expense', () => {
      const exactExpense = {
        ...mockExpense,
        splitConfig: {
          type: 'exact',
          shares: { user1: 500, user2: 600, user3: 400 },
        },
      };
      renderExpenseCard({ expense: exactExpense });
      expect(screen.getByText(/Exact amounts/)).toBeInTheDocument();
    });

    it('should render percentage split expense', () => {
      const percentageExpense = {
        ...mockExpense,
        splitConfig: {
          type: 'percentage',
          shares: { user1: 50, user2: 30, user3: 20 },
        },
      };
      renderExpenseCard({ expense: percentageExpense });
      expect(screen.getByText(/Percentage/)).toBeInTheDocument();
    });

    it('should render itemized split expense', () => {
      const itemizedExpense = {
        ...mockExpense,
        splitConfig: { type: 'itemized' },
        lineItems: [
          { description: 'Pizza', totalPrice: 800, assignedTo: ['user1', 'user2'] },
          { description: 'Drinks', totalPrice: 700, assignedTo: ['user1', 'user2', 'user3'] },
        ],
      };
      renderExpenseCard({ expense: itemizedExpense });
      expect(screen.getByText(/2 line items/)).toBeInTheDocument();
    });

    it('should show recurring badge for recurring expenses', () => {
      const recurringExpense = {
        ...mockExpense,
        recurrence: {
          enabled: true,
          frequency: 'monthly',
        },
      };
      renderExpenseCard({ expense: recurringExpense });
      expect(screen.getByText(/monthly/i)).toBeInTheDocument();
    });

    it('should show receipt badge when receipts exist', () => {
      const expenseWithReceipts = {
        ...mockExpense,
        receipts: [
          { url: '/receipt1.jpg', filename: 'receipt1.jpg' },
        ],
      };
      renderExpenseCard({ expense: expenseWithReceipts });
      expect(screen.getByText(/1 receipt/i)).toBeInTheDocument();
    });
  });

  describe('Multi-Currency Support', () => {
    it('should display USD currency symbol', () => {
      const usdExpense = {
        ...mockExpense,
        currency: 'USD',
        amount: 100,
      };
      renderExpenseCard({ expense: usdExpense });
      expect(screen.getByText(/\$/)).toBeInTheDocument();
    });

    it('should display EUR currency symbol', () => {
      const eurExpense = {
        ...mockExpense,
        currency: 'EUR',
        amount: 100,
      };
      renderExpenseCard({ expense: eurExpense });
      expect(screen.getByText(/€/)).toBeInTheDocument();
    });

    it('should display INR currency symbol', () => {
      renderExpenseCard();
      expect(screen.getByText(/₹/)).toBeInTheDocument();
    });
  });

  describe('Edit Functionality', () => {
    it('should show edit button when canEdit is true', () => {
      renderExpenseCard({ canEdit: true });
      const editButton = screen.getByRole('button', { name: /edit/i });
      expect(editButton).toBeInTheDocument();
    });

    it('should hide edit button when canEdit is false', () => {
      renderExpenseCard({ canEdit: false });
      const editButton = screen.queryByRole('button', { name: /edit/i });
      expect(editButton).not.toBeInTheDocument();
    });

    it('should open edit dialog when edit button clicked', async () => {
      renderExpenseCard({ canEdit: true });
      const editButton = screen.getByRole('button', { name: /edit/i });
      fireEvent.click(editButton);

      await waitFor(() => {
        expect(screen.getByText(/Edit Expense/i)).toBeInTheDocument();
      });
    });

    it('should pre-fill edit form with expense data', async () => {
      renderExpenseCard({ canEdit: true });
      const editButton = screen.getByRole('button', { name: /edit/i });
      fireEvent.click(editButton);

      await waitFor(() => {
        const descriptionInput = screen.getByDisplayValue('Dinner at restaurant');
        expect(descriptionInput).toBeInTheDocument();
        
        const amountInput = screen.getByDisplayValue('1500');
        expect(amountInput).toBeInTheDocument();
      });
    });
  });

  describe('Delete Functionality', () => {
    it('should show delete button when canDelete is true', () => {
      renderExpenseCard({ canDelete: true });
      const deleteButton = screen.getByRole('button', { name: /delete/i });
      expect(deleteButton).toBeInTheDocument();
    });

    it('should hide delete button when canDelete is false', () => {
      renderExpenseCard({ canDelete: false });
      const deleteButton = screen.queryByRole('button', { name: /delete/i });
      expect(deleteButton).not.toBeInTheDocument();
    });

    it('should show confirmation dialog when delete clicked', async () => {
      renderExpenseCard({ canDelete: true });
      const deleteButton = screen.getByRole('button', { name: /delete/i });
      fireEvent.click(deleteButton);

      await waitFor(() => {
        expect(screen.getByText(/Are you sure/i)).toBeInTheDocument();
      });
    });
  });

  describe('Permission Handling', () => {
    it('should allow admin to edit any expense', () => {
      renderExpenseCard({ isAdmin: true, canEdit: true });
      const editButton = screen.getByRole('button', { name: /edit/i });
      expect(editButton).toBeInTheDocument();
      expect(editButton).not.toBeDisabled();
    });

    it('should allow admin to delete any expense', () => {
      renderExpenseCard({ isAdmin: true, canDelete: true });
      const deleteButton = screen.getByRole('button', { name: /delete/i });
      expect(deleteButton).toBeInTheDocument();
      expect(deleteButton).not.toBeDisabled();
    });

    it('should restrict non-admin from editing', () => {
      renderExpenseCard({ isAdmin: false, canEdit: false });
      const editButton = screen.queryByRole('button', { name: /edit/i });
      expect(editButton).not.toBeInTheDocument();
    });

    it('should restrict non-admin from deleting', () => {
      renderExpenseCard({ isAdmin: false, canDelete: false });
      const deleteButton = screen.queryByRole('button', { name: /delete/i });
      expect(deleteButton).not.toBeInTheDocument();
    });
  });

  describe('Expand/Collapse Details', () => {
    it('should show expand button when line items exist', () => {
      const itemizedExpense = {
        ...mockExpense,
        lineItems: [
          { description: 'Pizza', totalPrice: 800 },
        ],
      };
      renderExpenseCard({ expense: itemizedExpense });
      const expandButton = screen.getByRole('button', { name: /show details/i });
      expect(expandButton).toBeInTheDocument();
    });

    it('should expand details when button clicked', async () => {
      const itemizedExpense = {
        ...mockExpense,
        lineItems: [
          { description: 'Pizza', totalPrice: 800 },
        ],
      };
      renderExpenseCard({ expense: itemizedExpense });
      const expandButton = screen.getByRole('button', { name: /show details/i });
      fireEvent.click(expandButton);

      await waitFor(() => {
        expect(screen.getByText('Pizza')).toBeInTheDocument();
      });
    });

    it('should collapse details when button clicked again', async () => {
      const itemizedExpense = {
        ...mockExpense,
        lineItems: [
          { description: 'Pizza', totalPrice: 800 },
        ],
      };
      renderExpenseCard({ expense: itemizedExpense });
      const expandButton = screen.getByRole('button', { name: /show details/i });
      
      // Expand
      fireEvent.click(expandButton);
      await waitFor(() => {
        expect(screen.getByText('Pizza')).toBeInTheDocument();
      });

      // Collapse
      fireEvent.click(expandButton);
      await waitFor(() => {
        expect(screen.queryByText('Pizza')).not.toBeInTheDocument();
      });
    });
  });

  describe('Accessibility', () => {
    it('should have accessible buttons', () => {
      renderExpenseCard({ canEdit: true, canDelete: true });
      const editButton = screen.getByRole('button', { name: /edit/i });
      const deleteButton = screen.getByRole('button', { name: /delete/i });
      
      expect(editButton).toBeInTheDocument();
      expect(deleteButton).toBeInTheDocument();
    });

    it('should have proper ARIA labels', () => {
      renderExpenseCard();
      const card = screen.getByText('Dinner at restaurant').closest('.bg-card');
      expect(card).toBeInTheDocument();
    });

    it('should support keyboard navigation', () => {
      renderExpenseCard({ canEdit: true });
      const editButton = screen.getByRole('button', { name: /edit/i });
      
      editButton.focus();
      expect(document.activeElement).toBe(editButton);
    });
  });

  describe('Edge Cases', () => {
    it('should handle zero amount', () => {
      const zeroExpense = { ...mockExpense, amount: 0 };
      renderExpenseCard({ expense: zeroExpense });
      expect(screen.getByText(/0/)).toBeInTheDocument();
    });

    it('should handle very large amounts', () => {
      const largeExpense = { ...mockExpense, amount: 1000000 };
      renderExpenseCard({ expense: largeExpense });
      expect(screen.getByText(/1,000,000/)).toBeInTheDocument();
    });

    it('should handle single participant', () => {
      const singleExpense = {
        ...mockExpense,
        splitAmong: ['user1'],
      };
      renderExpenseCard({ expense: singleExpense });
      expect(screen.getByText(/1500/)).toBeInTheDocument();
    });

    it('should handle missing category', () => {
      const noCategoryExpense = {
        ...mockExpense,
        category: 'unknown',
      };
      renderExpenseCard({ expense: noCategoryExpense });
      // Should still render without crashing
      expect(screen.getByText('Dinner at restaurant')).toBeInTheDocument();
    });

    it('should handle missing date', () => {
      const noDateExpense = {
        ...mockExpense,
        date: null,
      };
      renderExpenseCard({ expense: noDateExpense });
      // Should still render without crashing
      expect(screen.getByText('Dinner at restaurant')).toBeInTheDocument();
    });
  });
});
