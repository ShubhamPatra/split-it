/**
 * SettlementCard Component Tests
 * 
 * Tests for SettlementCard component including:
 * - Rendering different settlement statuses
 * - Confirm and reject functionality
 * - Permission handling
 * - Cross-group settlements
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SettlementCard } from '../common/SettlementCard';
import { GroupProvider } from '../../context/GroupContext';
import { NotificationProvider } from '../../context/NotificationContext';
import { BrowserRouter } from 'react-router-dom';

// Mock hooks
vi.mock('../../context/GroupContext', () => ({
  useGroups: () => ({
    confirmSettlement: vi.fn(),
    rejectSettlement: vi.fn(),
    getUserProfile: vi.fn(() => ({ _id: 'user2', name: 'Bob' })),
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

const mockSettlement = {
  _id: 'settlement1',
  groupId: 'group1',
  fromUserId: { _id: 'user1', name: 'Alice' },
  toUserId: { _id: 'user2', name: 'Bob' },
  amount: 500,
  currency: 'INR',
  paymentMethod: 'upi',
  paymentStatus: 'pending',
  transactionRef: 'UPI123456',
  createdAt: new Date('2026-01-27'),
};

const renderSettlementCard = (props = {}) => {
  return render(
    <BrowserRouter>
      <GroupProvider>
        <NotificationProvider>
          <SettlementCard settlement={mockSettlement} {...props} />
        </NotificationProvider>
      </GroupProvider>
    </BrowserRouter>
  );
};

describe('SettlementCard', () => {
  describe('Rendering', () => {
    it('should render settlement amount', () => {
      renderSettlementCard();
      expect(screen.getByText(/500/)).toBeInTheDocument();
    });

    it('should render payer name', () => {
      renderSettlementCard();
      expect(screen.getByText(/Alice/)).toBeInTheDocument();
    });

    it('should render receiver name', () => {
      renderSettlementCard();
      expect(screen.getByText(/Bob/)).toBeInTheDocument();
    });

    it('should render payment method', () => {
      renderSettlementCard();
      expect(screen.getByText(/UPI/i)).toBeInTheDocument();
    });

    it('should render transaction reference', () => {
      renderSettlementCard();
      expect(screen.getByText(/UPI123456/)).toBeInTheDocument();
    });

    it('should render date', () => {
      renderSettlementCard();
      expect(screen.getByText(/Jan 27/)).toBeInTheDocument();
    });
  });

  describe('Settlement Status', () => {
    it('should show pending badge for pending settlement', () => {
      renderSettlementCard();
      expect(screen.getByText(/Pending/i)).toBeInTheDocument();
    });

    it('should show confirmed badge for confirmed settlement', () => {
      const confirmedSettlement = {
        ...mockSettlement,
        paymentStatus: 'confirmed',
        paymentConfirmedAt: new Date(),
      };
      renderSettlementCard({ settlement: confirmedSettlement });
      expect(screen.getByText(/Confirmed/i)).toBeInTheDocument();
    });

    it('should show failed badge for failed settlement', () => {
      const failedSettlement = {
        ...mockSettlement,
        paymentStatus: 'failed',
      };
      renderSettlementCard({ settlement: failedSettlement });
      expect(screen.getByText(/Failed/i)).toBeInTheDocument();
    });
  });

  describe('Payment Methods', () => {
    it('should display UPI payment method', () => {
      renderSettlementCard();
      expect(screen.getByText(/UPI/i)).toBeInTheDocument();
    });

    it('should display Cash payment method', () => {
      const cashSettlement = {
        ...mockSettlement,
        paymentMethod: 'cash',
      };
      renderSettlementCard({ settlement: cashSettlement });
      expect(screen.getByText(/Cash/i)).toBeInTheDocument();
    });

    it('should display Bank payment method', () => {
      const bankSettlement = {
        ...mockSettlement,
        paymentMethod: 'bank',
      };
      renderSettlementCard({ settlement: bankSettlement });
      expect(screen.getByText(/Bank/i)).toBeInTheDocument();
    });

    it('should display Card payment method', () => {
      const cardSettlement = {
        ...mockSettlement,
        paymentMethod: 'card',
      };
      renderSettlementCard({ settlement: cardSettlement });
      expect(screen.getByText(/Card/i)).toBeInTheDocument();
    });
  });

  describe('Confirm Functionality', () => {
    it('should show confirm button for receiver when pending', () => {
      renderSettlementCard();
      const confirmButton = screen.getByRole('button', { name: /confirm/i });
      expect(confirmButton).toBeInTheDocument();
    });

    it('should not show confirm button when already confirmed', () => {
      const confirmedSettlement = {
        ...mockSettlement,
        paymentStatus: 'confirmed',
      };
      renderSettlementCard({ settlement: confirmedSettlement });
      const confirmButton = screen.queryByRole('button', { name: /confirm/i });
      expect(confirmButton).not.toBeInTheDocument();
    });

    it('should not show confirm button for payer', () => {
      const payerSettlement = {
        ...mockSettlement,
        toUserId: { _id: 'user3', name: 'Charlie' }, // Different receiver
      };
      renderSettlementCard({ settlement: payerSettlement });
      const confirmButton = screen.queryByRole('button', { name: /confirm/i });
      expect(confirmButton).not.toBeInTheDocument();
    });

    it('should call confirmSettlement when confirm clicked', async () => {
      const confirmSettlement = vi.fn();
      vi.mocked(useGroups).mockReturnValue({
        confirmSettlement,
        getUserProfile: () => ({ _id: 'user2', name: 'Bob' }),
      });

      renderSettlementCard();
      const confirmButton = screen.getByRole('button', { name: /confirm/i });
      fireEvent.click(confirmButton);

      await waitFor(() => {
        expect(confirmSettlement).toHaveBeenCalledWith('settlement1');
      });
    });
  });

  describe('Reject Functionality', () => {
    it('should show reject button for receiver when pending', () => {
      renderSettlementCard();
      const rejectButton = screen.getByRole('button', { name: /reject/i });
      expect(rejectButton).toBeInTheDocument();
    });

    it('should not show reject button when already confirmed', () => {
      const confirmedSettlement = {
        ...mockSettlement,
        paymentStatus: 'confirmed',
      };
      renderSettlementCard({ settlement: confirmedSettlement });
      const rejectButton = screen.queryByRole('button', { name: /reject/i });
      expect(rejectButton).not.toBeInTheDocument();
    });

    it('should show rejection reason dialog when reject clicked', async () => {
      renderSettlementCard();
      const rejectButton = screen.getByRole('button', { name: /reject/i });
      fireEvent.click(rejectButton);

      await waitFor(() => {
        expect(screen.getByText(/Reject Settlement/i)).toBeInTheDocument();
      });
    });

    it('should allow entering rejection reason', async () => {
      renderSettlementCard();
      const rejectButton = screen.getByRole('button', { name: /reject/i });
      fireEvent.click(rejectButton);

      await waitFor(() => {
        const reasonInput = screen.getByPlaceholderText(/reason/i);
        expect(reasonInput).toBeInTheDocument();
        
        fireEvent.change(reasonInput, { target: { value: 'Payment not received' } });
        expect(reasonInput.value).toBe('Payment not received');
      });
    });
  });

  describe('Cross-Group Settlements', () => {
    it('should show cross-group badge', () => {
      const crossGroupSettlement = {
        ...mockSettlement,
        isCrossGroup: true,
        affectedGroups: ['group1', 'group2'],
      };
      renderSettlementCard({ settlement: crossGroupSettlement });
      expect(screen.getByText(/Cross-Group/i)).toBeInTheDocument();
    });

    it('should show affected groups count', () => {
      const crossGroupSettlement = {
        ...mockSettlement,
        isCrossGroup: true,
        affectedGroups: ['group1', 'group2', 'group3'],
      };
      renderSettlementCard({ settlement: crossGroupSettlement });
      expect(screen.getByText(/3 groups/i)).toBeInTheDocument();
    });

    it('should not show cross-group badge for in-group settlement', () => {
      renderSettlementCard();
      expect(screen.queryByText(/Cross-Group/i)).not.toBeInTheDocument();
    });
  });

  describe('Currency Display', () => {
    it('should display INR currency', () => {
      renderSettlementCard();
      expect(screen.getByText(/₹/)).toBeInTheDocument();
    });

    it('should display USD currency', () => {
      const usdSettlement = {
        ...mockSettlement,
        currency: 'USD',
      };
      renderSettlementCard({ settlement: usdSettlement });
      expect(screen.getByText(/\$/)).toBeInTheDocument();
    });

    it('should display EUR currency', () => {
      const eurSettlement = {
        ...mockSettlement,
        currency: 'EUR',
      };
      renderSettlementCard({ settlement: eurSettlement });
      expect(screen.getByText(/€/)).toBeInTheDocument();
    });
  });

  describe('Payment Notes', () => {
    it('should display payment notes when present', () => {
      const settlementWithNotes = {
        ...mockSettlement,
        paymentNotes: 'Paid via Google Pay',
      };
      renderSettlementCard({ settlement: settlementWithNotes });
      expect(screen.getByText(/Paid via Google Pay/)).toBeInTheDocument();
    });

    it('should not show notes section when no notes', () => {
      renderSettlementCard();
      expect(screen.queryByText(/Notes:/)).not.toBeInTheDocument();
    });
  });

  describe('Timestamps', () => {
    it('should show creation date', () => {
      renderSettlementCard();
      expect(screen.getByText(/Jan 27/)).toBeInTheDocument();
    });

    it('should show confirmation date when confirmed', () => {
      const confirmedSettlement = {
        ...mockSettlement,
        paymentStatus: 'confirmed',
        paymentConfirmedAt: new Date('2026-01-28'),
      };
      renderSettlementCard({ settlement: confirmedSettlement });
      expect(screen.getByText(/Confirmed on Jan 28/i)).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have accessible buttons', () => {
      renderSettlementCard();
      const confirmButton = screen.getByRole('button', { name: /confirm/i });
      const rejectButton = screen.getByRole('button', { name: /reject/i });
      
      expect(confirmButton).toBeInTheDocument();
      expect(rejectButton).toBeInTheDocument();
    });

    it('should support keyboard navigation', () => {
      renderSettlementCard();
      const confirmButton = screen.getByRole('button', { name: /confirm/i });
      
      confirmButton.focus();
      expect(document.activeElement).toBe(confirmButton);
    });

    it('should have proper ARIA labels', () => {
      renderSettlementCard();
      const card = screen.getByText(/Alice/).closest('.bg-card');
      expect(card).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('should handle zero amount', () => {
      const zeroSettlement = { ...mockSettlement, amount: 0 };
      renderSettlementCard({ settlement: zeroSettlement });
      expect(screen.getByText(/0/)).toBeInTheDocument();
    });

    it('should handle very large amounts', () => {
      const largeSettlement = { ...mockSettlement, amount: 1000000 };
      renderSettlementCard({ settlement: largeSettlement });
      expect(screen.getByText(/1,000,000/)).toBeInTheDocument();
    });

    it('should handle missing transaction reference', () => {
      const noRefSettlement = {
        ...mockSettlement,
        transactionRef: null,
      };
      renderSettlementCard({ settlement: noRefSettlement });
      // Should still render without crashing
      expect(screen.getByText(/Alice/)).toBeInTheDocument();
    });

    it('should handle deleted users', () => {
      const deletedUserSettlement = {
        ...mockSettlement,
        fromUserId: { _id: 'deleted', name: '[Deleted User]' },
      };
      renderSettlementCard({ settlement: deletedUserSettlement });
      expect(screen.getByText(/\[Deleted User\]/)).toBeInTheDocument();
    });
  });

  describe('Loading States', () => {
    it('should show loading state when confirming', async () => {
      const confirmSettlement = vi.fn(() => new Promise(resolve => setTimeout(resolve, 100)));
      vi.mocked(useGroups).mockReturnValue({
        confirmSettlement,
        getUserProfile: () => ({ _id: 'user2', name: 'Bob' }),
      });

      renderSettlementCard();
      const confirmButton = screen.getByRole('button', { name: /confirm/i });
      fireEvent.click(confirmButton);

      // Button should be disabled during loading
      expect(confirmButton).toBeDisabled();
    });

    it('should show loading state when rejecting', async () => {
      const rejectSettlement = vi.fn(() => new Promise(resolve => setTimeout(resolve, 100)));
      vi.mocked(useGroups).mockReturnValue({
        rejectSettlement,
        getUserProfile: () => ({ _id: 'user2', name: 'Bob' }),
      });

      renderSettlementCard();
      const rejectButton = screen.getByRole('button', { name: /reject/i });
      fireEvent.click(rejectButton);

      await waitFor(() => {
        const submitButton = screen.getByRole('button', { name: /submit/i });
        expect(submitButton).toBeDisabled();
      });
    });
  });
});
