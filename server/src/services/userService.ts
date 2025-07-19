import crypto from 'crypto';
import { dbUtils, transaction } from '@utils/database';
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
 */
export const createUser = async (
  userData: UserRegistrationData,
  ipAddress?: string,
  userAgent?: string
): Promise<UserEntity> => {
  try {
    const userId = crypto.randomUUID();
    const hashedPassword = await hashPassword(userData.password);
    
    // Encrypt sensitive fields
    const encryptedData = encryptSensitiveFields(
      { phone: userData.phone },
      ['phone']
    );
    
    const user = await transaction(async (db) => {
      // Create user
      const userResult = dbUtils.run(`
        INSERT INTO users (
          id, email, firstName, lastName, phone, passwordHash,
          isActive, emailVerified, createdAt, updatedAt
        ) VALUES (?, ?, ?, ?, ?, ?, 1, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `, [
        userId,
        userData.email.toLowerCase(),
        userData.firstName,
        userData.lastName,
        JSON.stringify(encryptedData.phone),
        hashedPassword
      ]);
      
      // Assign default user role
      const roleId = crypto.randomUUID();
      dbUtils.run(`
        INSERT INTO user_roles (id, userId, role, assignedAt, isActive)
        VALUES (?, ?, 'user', CURRENT_TIMESTAMP, 1)
      `, [roleId, userId]);
      
      // If veteran, assign veteran role
      if (userData.isVeteran) {
        const veteranRoleId = crypto.randomUUID();
        dbUtils.run(`
          INSERT INTO user_roles (id, userId, role, assignedAt, isActive)
          VALUES (?, ?, 'veteran', CURRENT_TIMESTAMP, 1)
        `, [veteranRoleId, userId]);
        
        // Create veteran verification record
        const verificationId = crypto.randomUUID();
        dbUtils.run(`
          INSERT INTO veteran_verification (
            id, userId, verificationStatus, createdAt, updatedAt
          ) VALUES (?, ?, 'pending', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        `, [verificationId, userId]);
      }
      
      // Create default notification preferences
      const preferencesId = crypto.randomUUID();
      dbUtils.run(`
        INSERT INTO notification_preferences (
          id, userId, emailNotifications, smsNotifications, pushNotifications,
          complianceReminders, marketingEmails, securityAlerts,
          createdAt, updatedAt
        ) VALUES (?, ?, 1, 0, 1, 1, 0, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `, [preferencesId, userId]);
      
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
 */
export const getUserById = async (userId: string): Promise<UserEntity | null> => {
  try {
    const user = dbUtils.get<any>(`
      SELECT id, email, firstName, lastName, phone, passwordHash,
             createdAt, updatedAt, isActive, lastLoginAt, emailVerified,
             emailVerificationToken, passwordResetToken, passwordResetExpires
      FROM users 
      WHERE id = ? AND isActive = 1
    `, [userId]);
    
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
    const user = dbUtils.get<any>(`
      SELECT id, email, firstName, lastName, phone, passwordHash,
             createdAt, updatedAt, isActive, lastLoginAt, emailVerified,
             emailVerificationToken, passwordResetToken, passwordResetExpires
      FROM users 
      WHERE email = ? AND isActive = 1
    `, [email.toLowerCase()]);
    
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
    
    // Build dynamic update query
    const updateFields: string[] = [];
    const updateValues: any[] = [];
    
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
    
    updateFields.push('updatedAt = CURRENT_TIMESTAMP');
    updateValues.push(userId);
    
    // Execute update
    dbUtils.run(`
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
    dbUtils.run(`
      UPDATE users 
      SET lastLoginAt = CURRENT_TIMESTAMP 
      WHERE id = ?
    `, [userId]);
  } catch (error) {
    dbLogger.error('Failed to update last login:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId
    });
  }
};



