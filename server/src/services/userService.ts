/**
 * AI Catalyst UserService - Database-Agnostic Implementation
 *
 * This service demonstrates best practices for database-agnostic development:
 *
 * KEY PATTERNS IMPLEMENTED:
 * ✅ Universal Parameter Placeholders: Uses ? instead of $1, $2 (PostgreSQL-specific)
 * ✅ JavaScript Date Objects: Uses new Date() instead of database-specific functions
 * ✅ Unified Database Adapter: Leverages DatabaseAdapterFactory for cross-database compatibility
 * ✅ Transaction Management: Uses dbUtils.transaction() for atomic operations
 * ✅ Type Conversion: Explicit conversion of database types to JavaScript types
 * ✅ UUID Generation: Uses crypto.randomUUID() instead of database-specific functions
 *
 * COMPATIBILITY: Works seamlessly with SQLite (development) and PostgreSQL (production)
 *
 * This service serves as a template for other database-agnostic services in the codebase.
 */

import crypto from 'crypto';
// Import unified database utilities for database-agnostic operations (SQLite/PostgreSQL compatible)
import { unifiedDbUtils as dbUtils } from '@utils/databaseAdapter';
import { hashPassword, verifyPassword, encryptSensitiveFields, decryptSensitiveFields } from '@utils/encryption';
import { logSuccess, logFailure, logDataChange, AuditAction, AuditResource } from '@utils/audit';
import { dbLogger } from '@utils/logger';
import { UserEntity, UserRoleEntity, VeteranVerificationEntity, NotificationPreferencesEntity } from '../types/index';

// User registration data
export interface UserRegistrationData {
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  password: string;
  isVeteran?: boolean;
}

// User update data
export interface UserUpdateData {
  firstName?: string;
  lastName?: string;
  phone?: string;
  email?: string;
}

// User profile data (includes decrypted sensitive fields)
export interface UserProfile extends Omit<UserEntity, 'passwordHash'> {
  roles: UserRoleEntity[];
  veteranVerification?: VeteranVerificationEntity;
  notificationPreferences: NotificationPreferencesEntity;
}

/**
 * Create a new user account
 *
 * DATABASE-AGNOSTIC PATTERNS DEMONSTRATED:
 * - Uses ? parameter placeholders (works with SQLite/PostgreSQL)
 * - Uses JavaScript Date objects instead of database-specific date functions
 * - Uses crypto.randomUUID() instead of database-specific UUID generation
 * - Leverages unified transaction management through dbUtils.transaction()
 */
export const createUser = async (
  userData: UserRegistrationData,
  ipAddress?: string,
  userAgent?: string
): Promise<UserEntity> => {
  try {
    // Generate UUID using Node.js crypto (database-agnostic)
    const userId = crypto.randomUUID();
    const hashedPassword = await hashPassword(userData.password);

    // Encrypt sensitive fields before database storage
    const encryptedData = encryptSensitiveFields(
      { phone: userData.phone },
      ['phone']
    );

    // Use database-agnostic transaction management
    // This works with both SQLite and PostgreSQL through the unified adapter
    const user = await dbUtils.transaction(async (db) => {
      // Create user with database-agnostic SQL
      // Note: Uses ? placeholders, not PostgreSQL-specific $1, $2, etc.
      const userResult = await dbUtils.run(`
        INSERT INTO users (
          id, email, firstName, lastName, phone, passwordHash,
          isActive, emailVerified, createdAt, updatedAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        userId,
        userData.email.toLowerCase(),
        userData.firstName,
        userData.lastName,
        JSON.stringify(encryptedData.phone),
        hashedPassword,
        true,
        false,
        new Date(), // JavaScript Date object (database-agnostic)
        new Date()  // JavaScript Date object (database-agnostic)
      ]);
      
      // Assign default user role using database-agnostic patterns
      const roleId = crypto.randomUUID();
      await dbUtils.run(`
        INSERT INTO user_roles (id, userId, role, assignedAt, isActive)
        VALUES (?, ?, ?, ?, ?)
      `, [roleId, userId, 'user', new Date(), true]);

      // Conditionally assign veteran role if applicable
      if (userData.isVeteran) {
        const veteranRoleId = crypto.randomUUID();
        await dbUtils.run(`
          INSERT INTO user_roles (id, userId, role, assignedAt, isActive)
          VALUES (?, ?, ?, ?, ?)
        `, [veteranRoleId, userId, 'veteran', new Date(), true]);

        // Create veteran verification record with pending status
        // All queries use consistent ? placeholder pattern
        const verificationId = crypto.randomUUID();
        await dbUtils.run(`
          INSERT INTO veteran_verification (
            id, userId, verificationStatus, createdAt, updatedAt
          ) VALUES (?, ?, ?, ?, ?)
        `, [verificationId, userId, 'pending', new Date(), new Date()]);
      }
      
      // Create default notification preferences
      const preferencesId = crypto.randomUUID();
      await dbUtils.run(`
        INSERT INTO notification_preferences (
          id, userId, emailNotifications, smsNotifications, complianceReminders,
          documentUpdates, grantOpportunities, createdAt, updatedAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [preferencesId, userId, true, false, true, true, true, new Date(), new Date()]);
      
      return userResult;
    });
    
    // Get the created user
    const createdUser = await getUserById(userId);
    if (!createdUser) {
      throw new Error('Failed to retrieve created user');
    }
    
    // Log successful user creation
    await logSuccess(AuditAction.USER_REGISTER, AuditResource.USER, {
      userId,
      ipAddress,
      userAgent,
      metadata: {
        email: userData.email,
        isVeteran: userData.isVeteran
      }
    });
    
    dbLogger.info('User created successfully', {
      userId,
      email: userData.email,
      isVeteran: userData.isVeteran
    });
    
    return createdUser;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    await logFailure(AuditAction.USER_REGISTER, AuditResource.USER, errorMessage, {
      ipAddress,
      userAgent,
      metadata: { email: userData.email }
    });
    
    dbLogger.error('Failed to create user:', {
      error: errorMessage,
      email: userData.email
    });
    
    throw new Error('User registration failed');
  }
};

/**
 * Get user by ID
 *
 * DATABASE-AGNOSTIC PATTERNS:
 * - Uses ? parameter placeholders for safe parameterized queries
 * - Handles database result conversion to JavaScript types
 * - Works consistently across SQLite and PostgreSQL
 */
export const getUserById = async (userId: string): Promise<UserEntity | null> => {
  try {
    // Database-agnostic query using ? placeholders
    // The unified adapter handles differences between SQLite and PostgreSQL result formats
    const user = await dbUtils.get<any>(`
      SELECT id, email, firstName, lastName, phone, passwordHash,
             createdAt, updatedAt, isActive, lastLoginAt, emailVerified,
             emailVerificationToken, passwordResetToken, passwordResetExpires
      FROM users
      WHERE id = ? AND isActive = ?
    `, [userId, true]);
    
    if (!user) {
      return null;
    }
    
    // Decrypt sensitive fields that were encrypted before storage
    const decryptedUser = decryptSensitiveFields(user, ['phone']);

    // Convert database types to JavaScript types (database-agnostic approach)
    // This handles differences in how SQLite vs PostgreSQL store/return data types
    return {
      ...decryptedUser,
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      phone: decryptedUser.phone,
      passwordHash: user.passwordHash,
      isActive: Boolean(user.isActive),           // Ensure boolean type consistency
      createdAt: new Date(user.createdAt),        // Convert to JavaScript Date
      updatedAt: new Date(user.updatedAt),        // Convert to JavaScript Date
      lastLoginAt: user.lastLoginAt ? new Date(user.lastLoginAt) : undefined,
      passwordResetExpires: user.passwordResetExpires ? new Date(user.passwordResetExpires) : undefined,
      emailVerified: Boolean(user.emailVerified), // Ensure boolean type consistency
      emailVerificationToken: user.emailVerificationToken,
      passwordResetToken: user.passwordResetToken
    } as UserEntity;
  } catch (error) {
    dbLogger.error('Failed to get user by ID:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId
    });
    return null;
  }
};

/**
 * Get user by email
 */
export const getUserByEmail = async (email: string): Promise<UserEntity | null> => {
  try {
    const user = await dbUtils.get<any>(`
      SELECT id, email, firstName, lastName, phone, passwordHash,
             createdAt, updatedAt, isActive, lastLoginAt, emailVerified,
             emailVerificationToken, passwordResetToken, passwordResetExpires
      FROM users
      WHERE email = ? AND isActive = ?
    `, [email.toLowerCase(), true]);
    
    if (!user) {
      return null;
    }
    
    // Decrypt sensitive fields
    const decryptedUser = decryptSensitiveFields(user, ['phone']);
    
    return {
      ...decryptedUser,
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      phone: decryptedUser.phone,
      passwordHash: user.passwordHash,
      isActive: Boolean(user.isActive),
      createdAt: new Date(user.createdAt),
      updatedAt: new Date(user.updatedAt),
      lastLoginAt: user.lastLoginAt ? new Date(user.lastLoginAt) : undefined,
      passwordResetExpires: user.passwordResetExpires ? new Date(user.passwordResetExpires) : undefined,
      emailVerified: Boolean(user.emailVerified),
      emailVerificationToken: user.emailVerificationToken,
      passwordResetToken: user.passwordResetToken
    } as UserEntity;
  } catch (error) {
    dbLogger.error('Failed to get user by email:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      email
    });
    return null;
  }
};

/**
 * Update user profile
 *
 * DATABASE-AGNOSTIC PATTERNS DEMONSTRATED:
 * - Dynamic query building using ? placeholders
 * - Consistent parameter array construction
 * - Database-agnostic date handling
 * - Safe SQL construction without string interpolation
 */
export const updateUser = async (
  userId: string,
  updateData: UserUpdateData,
  updatedBy?: string,
  ipAddress?: string,
  userAgent?: string
): Promise<UserEntity | null> => {
  try {
    // Get current user data for audit log
    const currentUser = await getUserById(userId);
    if (!currentUser) {
      throw new Error('User not found');
    }

    // Prepare update data with encryption for sensitive fields
    const encryptedData = encryptSensitiveFields(updateData, ['phone']);

    // Build dynamic update query using database-agnostic patterns
    // This approach works with both SQLite and PostgreSQL
    const updateFields: string[] = [];
    const updateValues: any[] = [];

    // Use ? placeholders for all dynamic values (database-agnostic)
    if (updateData.firstName) {
      updateFields.push('firstName = ?');
      updateValues.push(updateData.firstName);
    }
    if (updateData.lastName) {
      updateFields.push('lastName = ?');
      updateValues.push(updateData.lastName);
    }
    if (updateData.phone) {
      updateFields.push('phone = ?');
      updateValues.push(JSON.stringify(encryptedData.phone));
    }
    if (updateData.email) {
      updateFields.push('email = ?');
      updateValues.push(updateData.email.toLowerCase());
    }

    if (updateFields.length === 0) {
      return currentUser; // No changes to make
    }

    // Always update the timestamp using JavaScript Date (database-agnostic)
    updateFields.push('updatedAt = ?');
    updateValues.push(new Date());
    updateValues.push(userId); // Add userId for WHERE clause

    // Execute dynamic update query using database-agnostic SQL construction
    // Template literal with join() ensures safe SQL without injection risks
    await dbUtils.run(`
      UPDATE users
      SET ${updateFields.join(', ')}
      WHERE id = ?
    `, updateValues);
    
    // Get updated user
    const updatedUser = await getUserById(userId);
    
    // Log the change
    await logDataChange(
      AuditAction.USER_UPDATE,
      AuditResource.USER,
      userId,
      { ...currentUser, passwordHash: '[REDACTED]' },
      { ...updatedUser, passwordHash: '[REDACTED]' },
      {
        userId: updatedBy || userId,
        ipAddress,
        userAgent
      }
    );
    
    dbLogger.info('User updated successfully', {
      userId,
      updatedFields: Object.keys(updateData),
      updatedBy
    });
    
    return updatedUser;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    await logFailure(AuditAction.USER_UPDATE, AuditResource.USER, errorMessage, {
      userId: updatedBy || userId,
      ipAddress,
      userAgent,
      resourceId: userId
    });
    
    dbLogger.error('Failed to update user:', {
      error: errorMessage,
      userId,
      updateData: Object.keys(updateData)
    });
    
    throw new Error('User update failed');
  }
};

/**
 * Verify user password
 */
export const verifyUserPassword = async (userId: string, password: string): Promise<boolean> => {
  try {
    const user = await getUserById(userId);
    if (!user) {
      return false;
    }
    
    return await verifyPassword(password, user.passwordHash);
  } catch (error) {
    dbLogger.error('Failed to verify user password:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId
    });
    return false;
  }
};

/**
 * Update user's last login time
 */
export const updateLastLogin = async (userId: string): Promise<void> => {
  try {
    await dbUtils.run(`
      UPDATE users
      SET lastLoginAt = ?, updatedAt = ?
      WHERE id = ?
    `, [new Date(), new Date(), userId]);
  } catch (error) {
    dbLogger.error('Failed to update last login:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId
    });
  }
};



