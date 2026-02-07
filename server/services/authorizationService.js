import Expense from '../models/Expense.js';
import Group from '../models/Group.js';
import Settlement from '../models/Settlement.js';

/**
 * AuthorizationService
 * 
 * Provides centralized authorization logic to ensure users can only access
 * resources they own or have permission to access.
 * 
 * This service implements the authorization checks required by:
 * - Requirement 4.1: Verify expense ownership/access
 * - Requirement 4.2: Verify group membership
 * - Requirement 4.3: Verify settlement participation
 */
class AuthorizationService {
  /**
   * Check if a user can access an expense
   * 
   * A user can access an expense if:
   * - They are a member of the group the expense belongs to
   * 
   * @param {string|ObjectId} userId - The user ID to check
   * @param {string|ObjectId} expenseId - The expense ID to check
   * @returns {Promise<boolean>} - True if user can access, false otherwise
   */
  async canAccessExpense(userId, expenseId) {
    try {
      // Find the expense
      const expense = await Expense.findById(expenseId).select('groupId');
      
      if (!expense) {
        return false;
      }
      
      // Check if user is a member of the expense's group
      const group = await Group.findById(expense.groupId).select('members');
      
      if (!group) {
        return false;
      }
      
      // Check if user is in the group's members array
      return group.members.some(memberId => 
        memberId.toString() === userId.toString()
      );
    } catch (error) {
      // Log error but return false for security
      console.error('Error checking expense access:', error);
      return false;
    }
  }

  /**
   * Check if a user can access a group
   * 
   * A user can access a group if:
   * - They are a member of the group
   * 
   * @param {string|ObjectId} userId - The user ID to check
   * @param {string|ObjectId} groupId - The group ID to check
   * @returns {Promise<boolean>} - True if user can access, false otherwise
   */
  async canAccessGroup(userId, groupId) {
    try {
      // Find the group
      const group = await Group.findById(groupId).select('members');
      
      if (!group) {
        return false;
      }
      
      // Check if user is in the group's members array
      return group.members.some(memberId => 
        memberId.toString() === userId.toString()
      );
    } catch (error) {
      // Log error but return false for security
      console.error('Error checking group access:', error);
      return false;
    }
  }

  /**
   * Check if a user can access a settlement
   * 
   * A user can access a settlement if:
   * - They are a participant (fromUserId or toUserId) in the settlement, OR
   * - They are a member of the group the settlement belongs to
   * 
   * @param {string|ObjectId} userId - The user ID to check
   * @param {string|ObjectId} settlementId - The settlement ID to check
   * @returns {Promise<boolean>} - True if user can access, false otherwise
   */
  async canAccessSettlement(userId, settlementId) {
    try {
      // Find the settlement
      const settlement = await Settlement.findById(settlementId)
        .select('fromUserId toUserId groupId affectedGroups isCrossGroup');
      
      if (!settlement) {
        return false;
      }
      
      // Check if user is a direct participant
      const isParticipant = 
        settlement.fromUserId.toString() === userId.toString() ||
        settlement.toUserId.toString() === userId.toString();
      
      if (isParticipant) {
        return true;
      }
      
      // For cross-group settlements, check all affected groups
      if (settlement.isCrossGroup && settlement.affectedGroups?.length > 0) {
        const groups = await Group.find({
          _id: { $in: settlement.affectedGroups }
        }).select('members');
        
        return groups.some(group => 
          group.members.some(memberId => 
            memberId.toString() === userId.toString()
          )
        );
      }
      
      // For regular settlements, check the primary group
      const group = await Group.findById(settlement.groupId).select('members');
      
      if (!group) {
        return false;
      }
      
      return group.members.some(memberId => 
        memberId.toString() === userId.toString()
      );
    } catch (error) {
      // Log error but return false for security
      console.error('Error checking settlement access:', error);
      return false;
    }
  }

  /**
   * Generic ownership check for resources
   * 
   * This method provides a flexible way to check resource ownership
   * based on the resource type and ownership rules.
   * 
   * @param {string|ObjectId} userId - The user ID to check
   * @param {Object} resource - Resource ownership information
   * @param {string} resource.resourceType - Type of resource ('expense', 'group', 'settlement')
   * @param {string|ObjectId} resource.resourceId - ID of the resource
   * @param {string|ObjectId} [resource.ownerId] - Direct owner ID (optional)
   * @param {Array<string|ObjectId>} [resource.sharedWith] - Array of user IDs with access (optional)
   * @returns {Promise<boolean>} - True if user has access, false otherwise
   */
  async checkOwnership(userId, resource) {
    try {
      const { resourceType, resourceId, ownerId, sharedWith } = resource;
      
      // Check direct ownership
      if (ownerId && ownerId.toString() === userId.toString()) {
        return true;
      }
      
      // Check shared access
      if (sharedWith && Array.isArray(sharedWith)) {
        const hasSharedAccess = sharedWith.some(sharedUserId => 
          sharedUserId.toString() === userId.toString()
        );
        if (hasSharedAccess) {
          return true;
        }
      }
      
      // Delegate to specific resource type checks
      switch (resourceType) {
        case 'expense':
          return await this.canAccessExpense(userId, resourceId);
        
        case 'group':
          return await this.canAccessGroup(userId, resourceId);
        
        case 'settlement':
          return await this.canAccessSettlement(userId, resourceId);
        
        default:
          console.warn(`Unknown resource type: ${resourceType}`);
          return false;
      }
    } catch (error) {
      // Log error but return false for security
      console.error('Error checking ownership:', error);
      return false;
    }
  }
}

// Export singleton instance
const authorizationService = new AuthorizationService();
export default authorizationService;
