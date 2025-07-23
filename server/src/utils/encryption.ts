import crypto from 'crypto';
import bcrypt from 'bcrypt';
import { securityConfig } from '@config/index';
import { dbUtils } from '@utils/databaseAdapter';
import { dbLogger } from '@utils/logger';

// Encryption configuration
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16; // For GCM, this is always 16
const SALT_LENGTH = 32;
const TAG_LENGTH = 16;
const KEY_LENGTH = 32;

// Interface for encrypted data
export interface EncryptedData {
  encrypted: string;
  iv: string;
  tag: string;
  salt: string;
}

// Interface for encryption key
interface EncryptionKey {
  id: string;
  keyName: string;
  keyVersion: number;
  encryptedKey: string;
  algorithm: string;
  isActive: boolean;
}

/**
 * Derive encryption key from master key and salt
 */
const deriveKey = (masterKey: string, salt: Buffer): Buffer => {
  return crypto.pbkdf2Sync(masterKey, salt, 100000, KEY_LENGTH, 'sha512');
};

/**
 * Encrypt sensitive data using AES-256-GCM
 */
export const encryptData = (plaintext: string, keyName: string = 'default'): EncryptedData => {
  try {
    // Generate random salt and IV
    const salt = crypto.randomBytes(SALT_LENGTH);
    const iv = crypto.randomBytes(IV_LENGTH);
    
    // Derive key from master key and salt
    const key = deriveKey(securityConfig.encryptionKey, salt);
    
    // Create cipher
    const cipher = crypto.createCipher(ALGORITHM, key);
    cipher.setAAD(Buffer.from(keyName)); // Additional authenticated data
    
    // Encrypt the data
    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    // Get the authentication tag
    const tag = cipher.getAuthTag();
    
    return {
      encrypted,
      iv: iv.toString('hex'),
      tag: tag.toString('hex'),
      salt: salt.toString('hex')
    };
  } catch (error) {
    dbLogger.error('Encryption failed:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      keyName
    });
    throw new Error('Data encryption failed');
  }
};

/**
 * Decrypt sensitive data using AES-256-GCM
 */
export const decryptData = (encryptedData: EncryptedData, keyName: string = 'default'): string => {
  try {
    // Convert hex strings back to buffers
    const iv = Buffer.from(encryptedData.iv, 'hex');
    const tag = Buffer.from(encryptedData.tag, 'hex');
    const salt = Buffer.from(encryptedData.salt, 'hex');
    
    // Derive the same key
    const key = deriveKey(securityConfig.encryptionKey, salt);
    
    // Create decipher
    const decipher = crypto.createDecipher(ALGORITHM, key);
    decipher.setAAD(Buffer.from(keyName)); // Same additional authenticated data
    decipher.setAuthTag(tag);
    
    // Decrypt the data
    let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    dbLogger.error('Decryption failed:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      keyName
    });
    throw new Error('Data decryption failed');
  }
};

/**
 * Encrypt sensitive fields in an object
 */
export const encryptSensitiveFields = (
  data: Record<string, any>, 
  sensitiveFields: string[]
): Record<string, any> => {
  const result = { ...data };
  
  for (const field of sensitiveFields) {
    if (result[field] && typeof result[field] === 'string') {
      result[field] = encryptData(result[field], field);
    }
  }
  
  return result;
};

/**
 * Decrypt sensitive fields in an object
 */
export const decryptSensitiveFields = (
  data: Record<string, any>, 
  sensitiveFields: string[]
): Record<string, any> => {
  const result = { ...data };
  
  for (const field of sensitiveFields) {
    if (result[field] && typeof result[field] === 'object') {
      try {
        result[field] = decryptData(result[field] as EncryptedData, field);
      } catch (error) {
        dbLogger.warn(`Failed to decrypt field ${field}:`, {
          error: error instanceof Error ? error.message : 'Unknown error'
        });
        // Keep encrypted data if decryption fails
      }
    }
  }
  
  return result;
};

/**
 * Hash sensitive data for searching (one-way)
 */
export const hashForSearch = (data: string): string => {
  return crypto.createHash('sha256').update(data).digest('hex');
};

/**
 * Generate secure random token
 */
export const generateSecureToken = (length: number = 32): string => {
  return crypto.randomBytes(length).toString('hex');
};

/**
 * Hash password using bcrypt (for user passwords)
 */
export const hashPassword = async (password: string): Promise<string> => {
  return bcrypt.hash(password, securityConfig.bcryptRounds);
};

/**
 * Verify password using bcrypt
 */
export const verifyPassword = async (password: string, hash: string): Promise<boolean> => {
  return bcrypt.compare(password, hash);
};

/**
 * Create or rotate encryption key
 */
export const createEncryptionKey = (keyName: string): void => {
  try {
    // Check if key already exists
    const existingKey = dbUtils.get<EncryptionKey>(
      'SELECT * FROM encryption_keys WHERE keyName = ? AND isActive = 1',
      [keyName]
    );
    
    if (existingKey) {
      // Deactivate existing key
      dbUtils.run(
        'UPDATE encryption_keys SET isActive = 0, rotatedAt = CURRENT_TIMESTAMP WHERE keyName = ?',
        [keyName]
      );
    }
    
    // Generate new key
    const newKey = crypto.randomBytes(KEY_LENGTH);

    // Use modern crypto.createCipheriv instead of deprecated createCipher
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(securityConfig.encryptionKey.padEnd(32, '0').slice(0, 32)), iv);
    let encryptedKey = cipher.update(newKey.toString('hex'), 'utf8', 'hex');
    encryptedKey += cipher.final('hex');

    // Prepend IV to encrypted key for storage
    const encryptedKeyWithIv = iv.toString('hex') + ':' + encryptedKey;
    
    // Store new key
    dbUtils.run(`
      INSERT INTO encryption_keys (id, keyName, keyVersion, encryptedKey, algorithm, isActive)
      VALUES (?, ?, ?, ?, ?, 1)
    `, [
      crypto.randomUUID(),
      keyName,
      (existingKey?.keyVersion || 0) + 1,
      encryptedKeyWithIv,
      ALGORITHM
    ]);
    
    dbLogger.info(`Encryption key created/rotated for: ${keyName}`);
  } catch (error) {
    dbLogger.error('Failed to create encryption key:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      keyName
    });
    throw error;
  }
};

/**
 * Initialize default encryption keys
 */
export const initializeEncryptionKeys = (): void => {
  const defaultKeys = ['default', 'ssn', 'ein', 'personal_info'];
  
  for (const keyName of defaultKeys) {
    try {
      const existingKey = dbUtils.get(
        'SELECT * FROM encryption_keys WHERE keyName = ? AND isActive = 1',
        [keyName]
      );
      
      if (!existingKey) {
        createEncryptionKey(keyName);
      }
    } catch (error) {
      dbLogger.error(`Failed to initialize encryption key ${keyName}:`, {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
};


