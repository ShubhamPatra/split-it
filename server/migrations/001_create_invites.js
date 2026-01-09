/**
 * Migration: Create Invites from Legacy Invite Codes
 * 
 * This script migrates existing group invite codes to the new Invite model.
 * Run this migration manually: node server/migrations/001_create_invites.js
 * 
 * Purpose:
 * 1. Find all groups with existing inviteCode field
 * 2. Create corresponding Invite documents for each
 * 3. Keep the group.inviteCode field for backward compatibility
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env') });

// Import models
import Group from '../models/Group.js';
import Invite from '../models/Invite.js';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/split-it';

async function migrate() {
  console.log('Starting migration: Create Invites from Legacy Invite Codes');
  console.log('='.repeat(60));
  
  try {
    // Connect to MongoDB
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');
    
    // Find all groups with invite codes
    const groupsWithInviteCodes = await Group.find({ 
      inviteCode: { $exists: true, $ne: null, $ne: '' } 
    }).populate('createdBy', 'name email');
    
    console.log(`Found ${groupsWithInviteCodes.length} groups with invite codes`);
    
    let created = 0;
    let skipped = 0;
    let errors = 0;
    
    for (const group of groupsWithInviteCodes) {
      try {
        // Check if an invite already exists for this code
        const existingInvite = await Invite.findOne({ 
          code: group.inviteCode.toUpperCase(),
          status: 'pending'
        });
        
        if (existingInvite) {
          console.log(`  [SKIP] Group "${group.name}" - Invite already exists for code ${group.inviteCode}`);
          skipped++;
          continue;
        }
        
        // Create new invite
        const invite = await Invite.create({
          groupId: group._id,
          inviterId: group.createdBy._id || group.createdBy,
          code: group.inviteCode.toUpperCase(),
          type: 'code',
          status: 'pending',
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
          metadata: {
            migratedFrom: 'legacy',
            migratedAt: new Date().toISOString(),
          },
        });
        
        console.log(`  [OK] Group "${group.name}" - Created invite ${invite.formattedCode}`);
        created++;
      } catch (error) {
        console.error(`  [ERROR] Group "${group.name}" - ${error.message}`);
        errors++;
      }
    }
    
    console.log('='.repeat(60));
    console.log('Migration complete!');
    console.log(`  Created: ${created}`);
    console.log(`  Skipped: ${skipped}`);
    console.log(`  Errors: ${errors}`);
    
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

// Run the migration
migrate();
