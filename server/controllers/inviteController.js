import Invite from '../models/Invite.js';
import Group from '../models/Group.js';
import User from '../models/User.js';
import Notification from '../models/Notification.js';
import { emitToGroup, emitToUser } from '../utils/socketEmitter.js';
import { sendEmailWithRetry } from '../jobs/emailService.js';
import { invalidateGroupMembershipCache } from '../config/socket.js';

const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:3000';
const DEFAULT_EXPIRY_HOURS = parseInt(process.env.INVITE_EXPIRY_HOURS) || 168; // 7 days
const MAX_EXPIRY_HOURS = 720; // 30 days
const MAX_INVITE_EMAILS = parseInt(process.env.MAX_INVITE_EMAILS) || 50;

/**
 * Create new invite(s) for a group
 * POST /api/invites/groups/:groupId/invites
 */
export const createInvite = async (req, res) => {
  try {
    const { groupId } = req.params;
    const { type, emails, expiryHours = DEFAULT_EXPIRY_HOURS, maxUses = 0 } = req.body;

    // Validate type
    if (!['link', 'email', 'code'].includes(type)) {
      return res.status(400).json({ message: 'Invalid invite type. Must be link, email, or code.' });
    }

    // Validate expiry hours
    const validExpiryHours = Math.min(Math.max(1, expiryHours), MAX_EXPIRY_HOURS);

    // Find group and check membership
    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    // Check if user is a member of the group
    const isMember = group.members.some(m => m.toString() === req.user._id.toString());
    if (!isMember) {
      return res.status(403).json({ message: 'You must be a member of this group to create invites' });
    }

    const expiresAt = new Date(Date.now() + validExpiryHours * 60 * 60 * 1000);
    const invites = [];

    if (type === 'email') {
      // Validate emails
      if (!emails || !Array.isArray(emails) || emails.length === 0) {
        return res.status(400).json({ message: 'Email addresses are required for email invites' });
      }

      if (emails.length > MAX_INVITE_EMAILS) {
        return res.status(400).json({ message: `Cannot send more than ${MAX_INVITE_EMAILS} invites at once` });
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      const invalidEmails = emails.filter(email => !emailRegex.test(email));
      if (invalidEmails.length > 0) {
        return res.status(400).json({ message: `Invalid email addresses: ${invalidEmails.join(', ')}` });
      }

      // Check for existing members
      const existingUsers = await User.find({ email: { $in: emails.map(e => e.toLowerCase()) } });
      const existingMemberEmails = existingUsers
        .filter(user => group.members.some(m => m.toString() === user._id.toString()))
        .map(user => user.email);

      if (existingMemberEmails.length > 0) {
        return res.status(400).json({
          message: `These users are already members: ${existingMemberEmails.join(', ')}`
        });
      }

      // Create invite for each email
      for (const email of emails) {
        const token = await Invite.generateUniqueToken();
        const invite = await Invite.create({
          groupId,
          inviterId: req.user._id,
          token,
          type: 'email',
          invitedEmail: email.toLowerCase(),
          expiresAt,
          metadata: {
            ipAddress: req.ip,
            userAgent: req.headers['user-agent'],
          },
        });

        const inviteUrl = `${CLIENT_URL}/join/${token}`;

        // Send email (non-blocking)
        sendEmailWithRetry({
          to: email,
          template: 'groupInvite',
          data: {
            inviterName: req.user.name,
            groupName: group.name,
            inviteUrl,
            expiresAt: expiresAt.toISOString(),
          },
        }).catch(err => console.error('Invite email error:', err));

        // If the invited user already has an account, send them an in-app notification
        const invitedUser = existingUsers.find(u => u.email.toLowerCase() === email.toLowerCase());
        if (invitedUser) {
          try {
            await Notification.create({
              userId: invitedUser._id,
              type: 'info',
              title: 'Group Invitation',
              message: `${req.user.name} invited you to join "${group.name}"`,
              actionType: 'navigate',
              actionUrl: `/join/${token}`,
            });

            // Send real-time notification via socket
            const io = req.app.get('io');
            if (io) {
              emitToUser(io, invitedUser._id.toString(), 'notification:new', {
                type: 'info',
                title: 'Group Invitation',
                message: `${req.user.name} invited you to join "${group.name}"`,
                actionUrl: `/join/${token}`,
              });
            }
          } catch (notifError) {
            console.error('Failed to create invite notification:', notifError);
            // Don't fail the invite for notification errors
          }
        }

        invites.push({
          id: invite._id,
          type: 'email',
          invitedEmail: email,
          inviteUrl,
          expiresAt,
          status: 'pending',
        });
      }
    } else {
      // Link or code invite (multi-use by default)
      const code = await Invite.generateUniqueCode();
      const invite = await Invite.create({
        groupId,
        inviterId: req.user._id,
        code,
        type,
        expiresAt,
        maxUses: Math.max(0, parseInt(maxUses) || 0), // 0 = unlimited
        metadata: {
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'],
        },
      });

      const inviteUrl = `${CLIENT_URL}/join/${code}`;

      invites.push({
        id: invite._id,
        type,
        code,
        formattedCode: invite.formattedCode,
        inviteUrl,
        expiresAt,
        status: 'pending',
        maxUses: invite.maxUses,
        usedCount: invite.usedCount,
        unlimited: invite.maxUses === 0,
      });
    }

    // Emit socket event
    const io = req.app.get('io');
    if (io) {
      emitToGroup(io, groupId, 'invite:created', { groupId, invites });
    }

    res.status(201).json({ invites });
  } catch (error) {
    console.error('Create invite error:', error);
    res.status(500).json({ message: 'Failed to create invite' });
  }
};

/**
 * Get all active invites for a group
 * GET /api/invites/groups/:groupId/invites
 */
export const getGroupInvites = async (req, res) => {
  try {
    const { groupId } = req.params;

    // Find group and check membership
    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    // Check if user is a member of the group
    const isMember = group.members.some(m => m.toString() === req.user._id.toString());
    if (!isMember) {
      return res.status(403).json({ message: 'You must be a member of this group to view invites' });
    }

    const invites = await Invite.find({
      groupId,
      status: 'pending',
      expiresAt: { $gt: new Date() },
    })
      .populate('inviterId', 'name email')
      .sort({ createdAt: -1 });

    const formattedInvites = invites.map(invite => ({
      id: invite._id,
      type: invite.type,
      code: invite.code,
      formattedCode: invite.formattedCode,
      invitedEmail: invite.invitedEmail,
      inviteUrl: invite.code
        ? `${CLIENT_URL}/join/${invite.code}`
        : `${CLIENT_URL}/join/${invite.token}`,
      expiresAt: invite.expiresAt,
      createdAt: invite.createdAt,
      inviter: invite.inviterId,
      status: invite.status,
      maxUses: invite.maxUses,
      usedCount: invite.usedCount,
      unlimited: invite.maxUses === 0,
    }));

    res.json({ invites: formattedInvites });
  } catch (error) {
    console.error('Get invites error:', error);
    res.status(500).json({ message: 'Failed to fetch invites' });
  }
};

// Regex patterns for input validation
const CODE_PATTERN = /^[A-Z0-9]{8,10}$/; // 8-10 uppercase alphanumeric
const TOKEN_PATTERN = /^[a-f0-9]{64}$/i; // 64-character hex string

/**
 * Validate an invite code/token before joining
 * POST /api/invites/validate
 */
export const validateInvite = async (req, res) => {
  try {
    const { code, token } = req.body;

    if (!code && !token) {
      return res.status(400).json({ message: 'Invite code or token is required' });
    }

    // Validate input format before querying MongoDB to reject garbage early
    if (code) {
      const normalizedCode = code.toUpperCase().replace(/-/g, '');
      if (!CODE_PATTERN.test(normalizedCode)) {
        return res.status(400).json({ message: 'Invalid invite code format', valid: false });
      }
    }
    if (token) {
      if (!TOKEN_PATTERN.test(token)) {
        return res.status(400).json({ message: 'Invalid invite token format', valid: false });
      }
    }

    // Find invite
    let invite;
    if (code) {
      invite = await Invite.findOne({ code: code.toUpperCase().replace(/-/g, ''), status: 'pending' });
    } else {
      invite = await Invite.findOne({ token, status: 'pending' });
    }

    // Fallback to legacy invite code
    if (!invite && code) {
      const group = await Group.findOne({ inviteCode: code.toUpperCase().replace(/-/g, '') })
        .select('name members');
      if (group) {
        return res.json({
          valid: true,
          legacy: true,
          group: {
            id: group._id,
            name: group.name,
            memberCount: group.members.length,
          },
        });
      }
    }

    if (!invite) {
      return res.status(404).json({ message: 'Invalid invite code or token', valid: false });
    }

    if (!invite.isValid()) {
      return res.status(400).json({ message: 'This invite has expired', valid: false });
    }

    // Get group info
    const group = await Group.findById(invite.groupId).select('name members');
    if (!group) {
      return res.status(404).json({ message: 'Group not found', valid: false });
    }

    res.json({
      valid: true,
      invite: {
        id: invite._id,
        type: invite.type,
        expiresAt: invite.expiresAt,
        invitedEmail: invite.invitedEmail,
      },
      group: {
        id: group._id,
        name: group.name,
        memberCount: group.members.length,
      },
    });
  } catch (error) {
    console.error('Validate invite error:', error);
    res.status(500).json({ message: 'Failed to validate invite', valid: false });
  }
};

/**
 * Join a group using invite code/token
 * POST /api/invites/join
 */
export const joinViaInvite = async (req, res) => {
  try {
    const { code, token } = req.body;

    if (!code && !token) {
      return res.status(400).json({ message: 'Invite code or token is required' });
    }

    // Find invite
    let invite;
    let isLegacy = false;

    if (code) {
      const normalizedCode = code.toUpperCase().replace(/-/g, '');
      invite = await Invite.findOne({ code: normalizedCode, status: 'pending' });

      // Fallback to legacy invite code
      if (!invite) {
        const group = await Group.findOne({ inviteCode: normalizedCode });
        if (group) {
          isLegacy = true;
          console.warn('DEPRECATED: Using legacy invite code system. Please regenerate invite.');

          // Check if already a member
          if (group.members.some(m => m.toString() === req.user._id.toString())) {
            return res.status(400).json({ message: 'You are already a member of this group' });
          }

          // Add user to group
          group.members.push(req.user._id);
          await group.save();

          // Populate for response
          const populatedGroup = await Group.findById(group._id)
            .populate('members', 'name email')
            .populate('createdBy', 'name email');

          // Create notification for group creator (non-blocking)
          try {
            const creatorId = group.createdBy._id || group.createdBy;
            await Notification.create({
              userId: creatorId,
              type: 'info',
              title: 'New Member Joined',
              message: `${req.user.name} has joined ${group.name}`,
              data: { groupId: group._id.toString(), memberId: req.user._id.toString() },
            });
          } catch (notifError) {
            console.error('Failed to create notification:', notifError);
          }

          // Emit socket event
          const io = req.app.get('io');
          if (io) {
            emitToGroup(io, group._id.toString(), 'group:memberJoined', {
              groupId: group._id.toString(),
              member: {
                id: req.user._id.toString(),
                name: req.user.name,
                email: req.user.email
              },
            });
          }

          res.setHeader('X-Deprecated', 'true');
          res.setHeader('X-Deprecation-Info', 'Use /api/invites endpoints');

          // Invalidate socket group membership cache
          invalidateGroupMembershipCache(group._id.toString());

          return res.json({
            success: true,
            group: populatedGroup,
            legacy: true,
          });
        }
      }
    } else {
      invite = await Invite.findOne({ token, status: 'pending' });
    }

    if (!invite) {
      return res.status(404).json({ message: 'Invalid invite code or token' });
    }

    if (!invite.isValid()) {
      return res.status(400).json({ message: 'This invite has expired or reached its usage limit' });
    }

    // For email invites, verify email matches
    if (invite.type === 'email' && invite.invitedEmail) {
      if (req.user.email.toLowerCase() !== invite.invitedEmail.toLowerCase()) {
        return res.status(403).json({
          message: 'This invite was sent to a different email address. Please use the correct account.'
        });
      }
    }

    // For link/code invites, check if this user already used this invite
    if (invite.type !== 'email' && invite.usedBy?.some(u => u.userId?.toString() === req.user._id.toString())) {
      return res.status(400).json({ message: 'You have already used this invite' });
    }

    // Get group
    const group = await Group.findById(invite.groupId);
    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    // Check if already a member
    if (group.members.some(m => m.toString() === req.user._id.toString())) {
      return res.status(400).json({ message: 'You are already a member of this group' });
    }

    // Add user to group
    group.members.push(req.user._id);
    await group.save();

    // Mark invite as accepted
    await invite.markAccepted(req.user._id);

    // Populate for response
    const populatedGroup = await Group.findById(group._id)
      .populate('members', 'name email')
      .populate('createdBy', 'name email');

    // Create notification for inviter (non-blocking)
    try {
      if (invite.inviterId) {
        await Notification.create({
          userId: invite.inviterId,
          type: 'info',
          title: 'Invite Accepted',
          message: `${req.user.name} has joined ${group.name}`,
          data: { groupId: group._id.toString(), memberId: req.user._id.toString() },
        });
      }
    } catch (notifError) {
      console.error('Failed to create notification:', notifError);
      // Don't fail the join operation for notification errors
    }

    // Emit socket event
    const io = req.app.get('io');
    if (io) {
      emitToGroup(io, group._id.toString(), 'group:memberJoined', {
        groupId: group._id.toString(),
        member: {
          id: req.user._id.toString(),
          name: req.user.name,
          email: req.user.email
        },
      });
    }

    // Invalidate socket group membership cache
    invalidateGroupMembershipCache(group._id.toString());

    res.json({
      success: true,
      group: populatedGroup,
    });
  } catch (error) {
    console.error('Join via invite error:', error);
    res.status(500).json({ message: 'Failed to join group' });
  }
};

/**
 * Revoke/delete an invite
 * DELETE /api/invites/:inviteId
 */
export const revokeInvite = async (req, res) => {
  try {
    const { inviteId } = req.params;

    const invite = await Invite.findById(inviteId);
    if (!invite) {
      return res.status(404).json({ message: 'Invite not found' });
    }

    // Check membership - allow invite creator or group admin to revoke
    const group = await Group.findById(invite.groupId);
    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    const isInviteCreator = invite.inviterId.toString() === req.user._id.toString();
    const memberRole = group.memberRoles?.get(req.user._id.toString());
    const isCreator = group.createdBy.toString() === req.user._id.toString();
    const isAdmin = isCreator || memberRole === 'admin';

    if (!isInviteCreator && !isAdmin) {
      return res.status(403).json({ message: 'Only the invite creator or group admins can revoke invites' });
    }

    invite.status = 'revoked';
    await invite.save();

    // Emit socket event
    const io = req.app.get('io');
    if (io) {
      emitToGroup(io, invite.groupId.toString(), 'invite:revoked', { inviteId });
    }

    res.json({ success: true, message: 'Invite revoked successfully' });
  } catch (error) {
    console.error('Revoke invite error:', error);
    res.status(500).json({ message: 'Failed to revoke invite' });
  }
};

/**
 * Regenerate code/token for existing invite
 * POST /api/invites/:inviteId/regenerate
 */
export const regenerateInvite = async (req, res) => {
  try {
    const { inviteId } = req.params;
    const { expiryHours = DEFAULT_EXPIRY_HOURS } = req.body;

    const invite = await Invite.findById(inviteId);
    if (!invite) {
      return res.status(404).json({ message: 'Invite not found' });
    }

    // Check membership - allow invite creator or group admin to regenerate
    const group = await Group.findById(invite.groupId);
    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    const isInviteCreator = invite.inviterId.toString() === req.user._id.toString();
    const memberRole = group.memberRoles?.get(req.user._id.toString());
    const isGroupCreator = group.createdBy.toString() === req.user._id.toString();
    const isAdmin = isGroupCreator || memberRole === 'admin';

    if (!isInviteCreator && !isAdmin) {
      return res.status(403).json({ message: 'Only the invite creator or group admins can regenerate invites' });
    }

    // Generate new code/token
    if (invite.type === 'email') {
      invite.token = await Invite.generateUniqueToken();
    } else {
      invite.code = await Invite.generateUniqueCode();
    }

    // Extend expiry
    const validExpiryHours = Math.min(Math.max(1, expiryHours), MAX_EXPIRY_HOURS);
    invite.expiresAt = new Date(Date.now() + validExpiryHours * 60 * 60 * 1000);
    invite.status = 'pending';

    await invite.save();

    const inviteUrl = invite.code
      ? `${CLIENT_URL}/join/${invite.code}`
      : `${CLIENT_URL}/join/${invite.token}`;

    res.json({
      success: true,
      invite: {
        id: invite._id,
        type: invite.type,
        code: invite.code,
        formattedCode: invite.formattedCode,
        invitedEmail: invite.invitedEmail,
        inviteUrl,
        expiresAt: invite.expiresAt,
        status: invite.status,
      },
    });
  } catch (error) {
    console.error('Regenerate invite error:', error);
    res.status(500).json({ message: 'Failed to regenerate invite' });
  }
};
