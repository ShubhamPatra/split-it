/**
 * Unit tests for groupTransformers utility functions
 * Tests data transformation and normalization logic extracted from GroupContext
 */

import {
  transformGroup,
  transformExpense,
  transformSettlement,
  normalizeUpdates,
  extractUserProfile,
  buildProfilesMap,
} from '../groupTransformers';

describe('groupTransformers', () => {
  describe('transformGroup', () => {
    it('should transform group with _id to id', () => {
      const apiGroup = {
        _id: '123',
        name: 'Test Group',
        createdBy: { _id: 'user1' },
        createdAt: '2024-01-01',
        members: [{ _id: 'user1' }, { _id: 'user2' }],
        inviteCode: 'ABC123',
      };

      const result = transformGroup(apiGroup);

      expect(result).toEqual({
        id: '123',
        name: 'Test Group',
        createdBy: 'user1',
        createdAt: '2024-01-01',
        members: ['user1', 'user2'],
        inviteCode: 'ABC123',
        budget: undefined,
      });
    });

    it('should handle string IDs', () => {
      const apiGroup = {
        _id: '123',
        name: 'Test Group',
        createdBy: 'user1',
        members: ['user1', 'user2'],
      };

      const result = transformGroup(apiGroup);

      expect(result.createdBy).toBe('user1');
      expect(result.members).toEqual(['user1', 'user2']);
    });
  });

  describe('transformExpense', () => {
    it('should transform expense with populated fields', () => {
      const apiExpense = {
        _id: 'exp1',
        groupId: { _id: 'group1' },
        description: 'Lunch',
        amount: 100,
        currency: 'INR',
        category: 'food',
        paidBy: { _id: 'user1' },
        date: '2024-01-01',
        splitAmong: [{ _id: 'user1' }, { _id: 'user2' }],
        splitConfig: { type: 'equal' },
        receipts: [],
      };

      const result = transformExpense(apiExpense);

      expect(result).toEqual({
        id: 'exp1',
        groupId: 'group1',
        description: 'Lunch',
        amount: 100,
        currency: 'INR',
        category: 'food',
        paidBy: 'user1',
        date: '2024-01-01',
        splitAmong: ['user1', 'user2'],
        splitConfig: { type: 'equal' },
        receipts: [],
        createdAt: undefined,
        updatedAt: undefined,
        isOffline: undefined,
      });
    });
  });

  describe('transformSettlement', () => {
    it('should transform settlement with defaults', () => {
      const apiSettlement = {
        _id: 'set1',
        groupId: { _id: 'group1' },
        fromUserId: { _id: 'user1' },
        toUserId: { _id: 'user2' },
        amount: 50,
        currency: 'INR',
        settledAt: '2024-01-01',
      };

      const result = transformSettlement(apiSettlement);

      expect(result).toEqual({
        id: 'set1',
        groupId: 'group1',
        fromUserId: 'user1',
        toUserId: 'user2',
        amount: 50,
        currency: 'INR',
        settledAt: '2024-01-01',
        paymentMethod: 'cash',
        paymentStatus: 'pending',
        transactionRef: undefined,
        paymentNotes: undefined,
      });
    });
  });

  describe('normalizeUpdates', () => {
    it('should normalize _id to id', () => {
      const updates = { _id: '123', name: 'Test' };
      const result = normalizeUpdates(updates);

      expect(result).toEqual({
        id: '123',
        name: 'Test',
      });
      expect(result._id).toBeUndefined();
    });

    it('should normalize populated groupId', () => {
      const updates = {
        groupId: { _id: 'group1', name: 'Group' },
      };
      const result = normalizeUpdates(updates);

      expect(result.groupId).toBe('group1');
    });

    it('should normalize members array', () => {
      const updates = {
        members: [
          { _id: 'user1', name: 'User 1' },
          { _id: 'user2', name: 'User 2' },
          'user3',
        ],
      };
      const result = normalizeUpdates(updates);

      expect(result.members).toEqual(['user1', 'user2', 'user3']);
    });

    it('should handle all ID fields', () => {
      const updates = {
        paidBy: { _id: 'user1' },
        fromUserId: { _id: 'user2' },
        toUserId: { _id: 'user3' },
        createdBy: { _id: 'user4' },
      };
      const result = normalizeUpdates(updates);

      expect(result.paidBy).toBe('user1');
      expect(result.fromUserId).toBe('user2');
      expect(result.toUserId).toBe('user3');
      expect(result.createdBy).toBe('user4');
    });
  });

  describe('extractUserProfile', () => {
    it('should extract profile from populated user', () => {
      const user = {
        _id: 'user1',
        name: 'John Doe',
        email: 'john@example.com',
        upiId: 'john@upi',
      };

      const result = extractUserProfile(user);

      expect(result).toEqual({
        id: 'user1',
        name: 'John Doe',
        email: 'john@example.com',
        upiId: 'john@upi',
      });
    });

    it('should return null for non-object', () => {
      expect(extractUserProfile('user1')).toBeNull();
      expect(extractUserProfile(null)).toBeNull();
      expect(extractUserProfile(undefined)).toBeNull();
    });

    it('should handle missing optional fields', () => {
      const user = {
        _id: 'user1',
        name: 'John Doe',
      };

      const result = extractUserProfile(user);

      expect(result).toEqual({
        id: 'user1',
        name: 'John Doe',
        email: '',
        upiId: '',
      });
    });
  });

  describe('buildProfilesMap', () => {
    it('should build profiles from groups with populated members', () => {
      const groups = [
        {
          createdBy: {
            _id: 'user1',
            name: 'Creator',
            email: 'creator@example.com',
          },
          members: [
            { _id: 'user2', name: 'Member 1', email: 'member1@example.com' },
            { _id: 'user3', name: 'Member 2', email: 'member2@example.com' },
          ],
        },
        {
          createdBy: { _id: 'user4', name: 'Creator 2', email: 'creator2@example.com' },
          members: [{ _id: 'user2', name: 'Member 1', email: 'member1@example.com' }],
        },
      ];

      const result = buildProfilesMap(groups);

      expect(result).toEqual({
        user1: { id: 'user1', name: 'Creator', email: 'creator@example.com', upiId: '' },
        user2: { id: 'user2', name: 'Member 1', email: 'member1@example.com', upiId: '' },
        user3: { id: 'user3', name: 'Member 2', email: 'member2@example.com', upiId: '' },
        user4: { id: 'user4', name: 'Creator 2', email: 'creator2@example.com', upiId: '' },
      });
    });

    it('should handle groups with string IDs', () => {
      const groups = [
        {
          createdBy: 'user1',
          members: ['user2', 'user3'],
        },
      ];

      const result = buildProfilesMap(groups);

      expect(result).toEqual({});
    });

    it('should handle empty groups array', () => {
      const result = buildProfilesMap([]);

      expect(result).toEqual({});
    });
  });
});
