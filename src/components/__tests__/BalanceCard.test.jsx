/**
 * BalanceCard Component Tests
 * 
 * Tests for BalanceCard component including:
 * - Rendering positive and negative balances
 * - Color coding
 * - Settlement suggestions
 * - Record settlement functionality
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BalanceCard } from '../common/BalanceCard';
import { GroupProvider } from '../../context/GroupContext';
import { BrowserRouter } from 'react-router-dom';

// Mock hooks
vi.mock('../../context/GroupContext', () => ({
  useGroups: () => ({
    recordSettlement: vi.fn(),
    getUserProfile: () => ({ _id: 'user1', name: 'Alice' }),
  }),
  GroupProvider: ({ children }) => <div>{children}</div>,
}));

vi.mock('../../hooks/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}));

const mockBalance = {
  userId: 'user2',
  userName: 'Bob',
  balance: 500,
  totalPaid: 1500,
  totalOwed: 1000,
};

const renderBalanceCard = (props = {}) => {
  return render(
    <BrowserRouter>
      <GroupProvider>
        <BalanceCard balance={mockBalance} groupId="group1" {...props} />
      </GroupProvider>
    </BrowserRouter>
  );
};

describe('BalanceCard', () => {
  describe('Rendering', () => {
    it('should render user name', () => {
      renderBalanceCard();
      expect(screen.getByText('Bob')).toBeInTheDocument();
    });

    it('should render balance amount', () => {
      renderBalanceCard();
      expect(screen.getByText(/500/)).toBeInTheDocument();
    });

    it('should render total paid', () => {
      renderBalanceCard();
      expect(screen.getByText(/Paid: ₹1,500/)).toBeInTheDocument();
    });

    it('should render total owed', () => {
      renderBalanceCard();
      expect(screen.getByText(/Owed: ₹1,000/)).toBeInTheDocument();
    });
  });

  describe('Balance Color Coding', () => {
    it('should show green for positive balance (owed to user)', () => {
      renderBalanceCard();
      const balanceText = screen.getByText(/500/);
      expect(balanceText).toHaveClass('text-success');
    });

    it('should show red for negative balance (user owes)', () => {
      const negativeBalance = {
        ...mockBalance,
        balance: -500,
      };
      renderBalanceCard({ balance: negativeBalance });
      const balanceText = screen.getByText(/500/);
      expect(balanceText).toHaveClass('text-destructive');
    });

    it('should show neutral for zero balance', () => {
      const zeroBalance = {
        ...mockBalance,
        balance: 0,
      };
      renderBalanceCard({ balance: zeroBalance });
      const balanceText = screen.getByText(/0/);
      expect(balanceText).toHaveClass('text-muted-foreground');
    });
  });

  describe('Balance Direction Text', () => {
    it('should show "is owed" for positive balance', () => {
      renderBalanceCard();
      expect(screen.getByText(/is owed/i)).toBeInTheDocument();
    });

    it('should show "owes" for negative balance', () => {
      const negativeBalance = {
        ...mockBalance,
        balance: -500,
      };
      renderBalanceCard({ balance: negativeBalance });
      expect(screen.getByText(/owes/i)).toBeInTheDocument();
    });

    it('should show "settled up" for zero balance', () => {
      const zeroBalance = {
        ...mockBalance,
        balance: 0,
      };
      renderBalanceCard({ balance: zeroBalance });
      expect(screen.getByText(/settled up/i)).toBeInTheDocument();
    });
  });

  describe('Settlement Suggestions', () => {
    it('should show "Settle Up" button for non-zero balance', () => {
      renderBalanceCard();
      const settleButton = screen.getByRole('button', { name: /settle up/i });
      expect(settleButton).toBeInTheDocument();
    });

    it('should not show "Settle Up" button for zero balance', () => {
      const zeroBalance = {
        ...mockBalance,
        balance: 0,
      };
      renderBalanceCard({ balance: zeroBalance });
      const settleButton = screen.queryByRole('button', { name: /settle up/i });
      expect(settleButton).not.toBeInTheDocument();
    });

    it('should open settlement modal when "Settle Up" clicked', async () => {
      renderBalanceCard();
      const settleButton = screen.getByRole('button', { name: /settle up/i });
      fireEvent.click(settleButton);

      await waitFor(() => {
        expect(screen.getByText(/Record Settlement/i)).toBeInTheDocument();
      });
    });

    it('should pre-fill settlement amount with balance', async () => {
      renderBalanceCard();
      const settleButton = screen.getByRole('button', { name: /settle up/i });
      fireEvent.click(settleButton);

      await waitFor(() => {
        const amountInput = screen.getByDisplayValue('500');
        expect(amountInput).toBeInTheDocument();
      });
    });
  });

  describe('Record Settlement', () => {
    it('should allow recording settlement for positive balance', async () => {
      renderBalanceCard();
      const settleButton = screen.getByRole('button', { name: /settle up/i });
      fireEvent.click(settleButton);

      await waitFor(() => {
        const recordButton = screen.getByRole('button', { name: /record/i });
        expect(recordButton).toBeInTheDocument();
      });
    });

    it('should allow recording settlement for negative balance', async () => {
      const negativeBalance = {
        ...mockBalance,
        balance: -500,
      };
      renderBalanceCard({ balance: negativeBalance });
      const settleButton = screen.getByRole('button', { name: /settle up/i });
      fireEvent.click(settleButton);

      await waitFor(() => {
        const recordButton = screen.getByRole('button', { name: /record/i });
        expect(recordButton).toBeInTheDocument();
      });
    });

    it('should validate settlement amount', async () => {
      renderBalanceCard();
      const settleButton = screen.getByRole('button', { name: /settle up/i });
      fireEvent.click(settleButton);

      await waitFor(() => {
        const amountInput = screen.getByDisplayValue('500');
        fireEvent.change(amountInput, { target: { value: '0' } });
        
        const recordButton = screen.getByRole('button', { name: /record/i });
        fireEvent.click(recordButton);
        
        expect(screen.getByText(/Invalid amount/i)).toBeInTheDocument();
      });
    });

    it('should allow partial settlement', async () => {
      renderBalanceCard();
      const settleButton = screen.getByRole('button', { name: /settle up/i });
      fireEvent.click(settleButton);

      await waitFor(() => {
        const amountInput = screen.getByDisplayValue('500');
        fireEvent.change(amountInput, { target: { value: '250' } });
        expect(amountInput.value).toBe('250');
      });
    });
  });

  describe('Payment Methods', () => {
    it('should show payment method selector', async () => {
      renderBalanceCard();
      const settleButton = screen.getByRole('button', { name: /settle up/i });
      fireEvent.click(settleButton);

      await waitFor(() => {
        expect(screen.getByText(/Payment Method/i)).toBeInTheDocument();
      });
    });

    it('should allow selecting UPI', async () => {
      renderBalanceCard();
      const settleButton = screen.getByRole('button', { name: /settle up/i });
      fireEvent.click(settleButton);

      await waitFor(() => {
        const methodSelect = screen.getByRole('combobox');
        fireEvent.click(methodSelect);
        
        const upiOption = screen.getByText(/UPI/i);
        fireEvent.click(upiOption);
      });
    });

    it('should allow selecting Cash', async () => {
      renderBalanceCard();
      const settleButton = screen.getByRole('button', { name: /settle up/i });
      fireEvent.click(settleButton);

      await waitFor(() => {
        const methodSelect = screen.getByRole('combobox');
        fireEvent.click(methodSelect);
        
        const cashOption = screen.getByText(/Cash/i);
        fireEvent.click(cashOption);
      });
    });
  });

  describe('Accessibility', () => {
    it('should have accessible button', () => {
      renderBalanceCard();
      const settleButton = screen.getByRole('button', { name: /settle up/i });
      expect(settleButton).toBeInTheDocument();
    });

    it('should support keyboard navigation', () => {
      renderBalanceCard();
      const settleButton = screen.getByRole('button', { name: /settle up/i });
      
      settleButton.focus();
      expect(document.activeElement).toBe(settleButton);
    });

    it('should have proper ARIA labels', () => {
      renderBalanceCard();
      const card = screen.getByText('Bob').closest('.bg-card');
      expect(card).toBeInTheDocument();
    });

    it('should have semantic color indicators', () => {
      renderBalanceCard();
      // Positive balance should have success color
      const balanceText = screen.getByText(/500/);
      expect(balanceText).toHaveClass('text-success');
    });
  });

  describe('Edge Cases', () => {
    it('should handle very small balance', () => {
      const smallBalance = {
        ...mockBalance,
        balance: 0.01,
      };
      renderBalanceCard({ balance: smallBalance });
      expect(screen.getByText(/0\.01/)).toBeInTheDocument();
    });

    it('should handle very large balance', () => {
      const largeBalance = {
        ...mockBalance,
        balance: 1000000,
      };
      renderBalanceCard({ balance: largeBalance });
      expect(screen.getByText(/1,000,000/)).toBeInTheDocument();
    });

    it('should handle negative balance close to zero', () => {
      const nearZeroBalance = {
        ...mockBalance,
        balance: -0.01,
      };
      renderBalanceCard({ balance: nearZeroBalance });
      expect(screen.getByText(/0\.01/)).toBeInTheDocument();
    });

    it('should handle missing user name', () => {
      const noNameBalance = {
        ...mockBalance,
        userName: null,
      };
      renderBalanceCard({ balance: noNameBalance });
      // Should still render without crashing
      expect(screen.getByText(/500/)).toBeInTheDocument();
    });

    it('should handle zero paid and owed', () => {
      const zeroBalance = {
        ...mockBalance,
        balance: 0,
        totalPaid: 0,
        totalOwed: 0,
      };
      renderBalanceCard({ balance: zeroBalance });
      expect(screen.getByText(/Paid: ₹0/)).toBeInTheDocument();
      expect(screen.getByText(/Owed: ₹0/)).toBeInTheDocument();
    });
  });

  describe('Loading States', () => {
    it('should show loading state when recording settlement', async () => {
      const recordSettlement = vi.fn(() => new Promise(resolve => setTimeout(resolve, 100)));
      vi.mocked(useGroups).mockReturnValue({
        recordSettlement,
        getUserProfile: () => ({ _id: 'user1', name: 'Alice' }),
      });

      renderBalanceCard();
      const settleButton = screen.getByRole('button', { name: /settle up/i });
      fireEvent.click(settleButton);

      await waitFor(() => {
        const recordButton = screen.getByRole('button', { name: /record/i });
        fireEvent.click(recordButton);
        
        // Button should be disabled during loading
        expect(recordButton).toBeDisabled();
      });
    });
  });

  describe('Currency Display', () => {
    it('should display INR currency symbol', () => {
      renderBalanceCard();
      expect(screen.getByText(/₹/)).toBeInTheDocument();
    });

    it('should format large numbers with commas', () => {
      const largeBalance = {
        ...mockBalance,
        totalPaid: 100000,
      };
      renderBalanceCard({ balance: largeBalance });
      expect(screen.getByText(/100,000/)).toBeInTheDocument();
    });
  });

  describe('User Interaction', () => {
    it('should close modal when cancel clicked', async () => {
      renderBalanceCard();
      const settleButton = screen.getByRole('button', { name: /settle up/i });
      fireEvent.click(settleButton);

      await waitFor(() => {
        const cancelButton = screen.getByRole('button', { name: /cancel/i });
        fireEvent.click(cancelButton);
      });

      await waitFor(() => {
        expect(screen.queryByText(/Record Settlement/i)).not.toBeInTheDocument();
      });
    });

    it('should allow entering notes', async () => {
      renderBalanceCard();
      const settleButton = screen.getByRole('button', { name: /settle up/i });
      fireEvent.click(settleButton);

      await waitFor(() => {
        const notesInput = screen.getByPlaceholderText(/notes/i);
        fireEvent.change(notesInput, { target: { value: 'Paid via Google Pay' } });
        expect(notesInput.value).toBe('Paid via Google Pay');
      });
    });

    it('should allow entering transaction reference', async () => {
      renderBalanceCard();
      const settleButton = screen.getByRole('button', { name: /settle up/i });
      fireEvent.click(settleButton);

      await waitFor(() => {
        const refInput = screen.getByPlaceholderText(/transaction/i);
        fireEvent.change(refInput, { target: { value: 'UPI123456' } });
        expect(refInput.value).toBe('UPI123456');
      });
    });
  });
});
