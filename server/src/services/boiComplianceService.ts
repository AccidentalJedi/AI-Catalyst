import crypto from 'crypto';
import { dbUtils, transaction } from '@utils/databaseAdapter';
import { encryptSensitiveFields, decryptSensitiveFields } from '@utils/encryption';
import { logSuccess, logFailure, logDataChange, AuditAction, AuditResource } from '@utils/audit';
import { boiLogger } from '@utils/logger';
import { BOIComplianceEntity, BeneficialOwnerEntity, IdentificationDocument } from '../types/index';

// BOI filing status
export type BOIFilingStatus = 'not_started' | 'in_progress' | 'submitted' | 'approved' | 'rejected';

// BOI exemption types
export type BOIExemption = 
  | 'large_operating_company' 
  | 'subsidiary' 
  | 'inactive_entity' 
  | 'public_company'
  | 'governmental_authority' 
  | 'bank' 
  | 'credit_union' 
  | 'depository_institution_holding_company'
  | 'money_services_business' 
  | 'broker_dealer' 
  | 'securities_exchange_act_company'
  | 'investment_company' 
  | 'investment_adviser' 
  | 'venture_capital_fund_adviser'
  | 'insurance_company' 
  | 'state_licensed_insurance_producer' 
  | 'commodity_exchange_act_entity'
  | 'accounting_firm' 
  | 'public_utility' 
  | 'financial_market_utility'
  | 'pooled_investment_vehicle' 
  | 'tax_exempt_entity';

// Beneficial owner data
export interface BeneficialOwnerData {
  firstName: string;
  lastName: string;
  dateOfBirth: Date;
  address: {
    street: string;
    city: string;
    state: string;
    zipCode: string;
    county: string;
    country: string;
  };
  identificationDocument: IdentificationDocument;
  ownershipPercentage?: number;
  controlType: 'ownership' | 'control' | 'both';
  isExempt?: boolean;
}

// BOI compliance data
export interface BOIComplianceData {
  companyId: string;
  filingStatus?: BOIFilingStatus;
  exemptionClaimed?: BOIExemption;
  exemptionReason?: string;
  beneficialOwners: BeneficialOwnerData[];
}

/**
 * Create BOI compliance record
 */
export const createBOICompliance = async (
  userId: string,
  data: BOIComplianceData,
  ipAddress?: string,
  userAgent?: string
): Promise<BOIComplianceEntity> => {
  try {
    const complianceId = crypto.randomUUID();
    const deadline = new Date('2025-03-21'); // March 21, 2025 deadline
    
    const compliance = await transaction(async (trx) => {
      // Create BOI compliance record
      await trx.raw(`
        INSERT INTO boi_compliance (
          id, userId, companyId, filingStatus, deadline, exemptionClaimed,
          exemptionReason, remindersSent, createdAt, updatedAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `, [
        complianceId,
        userId,
        data.companyId,
        data.filingStatus || 'not_started',
        deadline.toISOString(),
        data.exemptionClaimed || null,
        data.exemptionReason || null
      ]);

      // Add beneficial owners
      for (const ownerData of data.beneficialOwners) {
        await addBeneficialOwner(userId, data.companyId, ownerData);
      }

      return complianceId;
    });
    
    const createdCompliance = await getBOICompliance(userId, data.companyId);
    if (!createdCompliance) {
      throw new Error('Failed to retrieve created BOI compliance record');
    }
    
    await logSuccess(AuditAction.BOI_CREATE, AuditResource.BOI_COMPLIANCE, {
      userId,
      resourceId: complianceId,
      ipAddress,
      userAgent,
      metadata: {
        companyId: data.companyId,
        beneficialOwnersCount: data.beneficialOwners.length,
        exemptionClaimed: data.exemptionClaimed
      }
    });
    
    boiLogger.info('BOI compliance record created', {
      userId,
      complianceId,
      companyId: data.companyId,
      deadline: deadline.toISOString()
    });
    
    return createdCompliance;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    await logFailure(AuditAction.BOI_CREATE, AuditResource.BOI_COMPLIANCE, errorMessage, {
      userId,
      ipAddress,
      userAgent,
      metadata: { companyId: data.companyId }
    });
    
    boiLogger.error('Failed to create BOI compliance record:', {
      error: errorMessage,
      userId,
      companyId: data.companyId
    });
    
    throw new Error('BOI compliance creation failed');
  }
};

/**
 * Get BOI compliance record
 */
export const getBOICompliance = async (
  userId: string,
  companyId: string
): Promise<BOIComplianceEntity | null> => {
  try {
    const compliance = await dbUtils.get<any>(`
      SELECT * FROM boi_compliance
      WHERE userId = ? AND companyId = ?
      ORDER BY createdAt DESC
      LIMIT 1
    `, [userId, companyId]);
    
    if (!compliance) {
      return null;
    }
    
    return {
      id: compliance.id,
      userId: compliance.userId,
      companyId: compliance.companyId,
      filingStatus: compliance.filingStatus as BOIFilingStatus,
      submissionDate: compliance.submissionDate ? new Date(compliance.submissionDate) : undefined,
      confirmationNumber: compliance.confirmationNumber,
      deadline: new Date(compliance.deadline),
      remindersSent: compliance.remindersSent,
      lastReminderDate: compliance.lastReminderDate ? new Date(compliance.lastReminderDate) : undefined,
      exemptionClaimed: compliance.exemptionClaimed as BOIExemption,
      exemptionReason: compliance.exemptionReason,
      createdAt: new Date(compliance.createdAt),
      updatedAt: new Date(compliance.updatedAt)
    };
  } catch (error) {
    boiLogger.error('Failed to get BOI compliance record:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId,
      companyId
    });
    return null;
  }
};

/**
 * Update BOI compliance status
 */
export const updateBOIComplianceStatus = async (
  userId: string,
  companyId: string,
  status: BOIFilingStatus,
  confirmationNumber?: string,
  ipAddress?: string,
  userAgent?: string
): Promise<BOIComplianceEntity | null> => {
  try {
    const currentCompliance = await getBOICompliance(userId, companyId);
    if (!currentCompliance) {
      throw new Error('BOI compliance record not found');
    }
    
    const updateData: any = {
      filingStatus: status,
      updatedAt: new Date().toISOString()
    };
    
    if (status === 'submitted' && confirmationNumber) {
      updateData.submissionDate = new Date().toISOString();
      updateData.confirmationNumber = confirmationNumber;
    }
    
    dbUtils.run(`
      UPDATE boi_compliance 
      SET filingStatus = ?, submissionDate = ?, confirmationNumber = ?, updatedAt = CURRENT_TIMESTAMP
      WHERE userId = ? AND companyId = ?
    `, [
      status,
      updateData.submissionDate || null,
      confirmationNumber || null,
      userId,
      companyId
    ]);
    
    const updatedCompliance = await getBOICompliance(userId, companyId);
    
    await logDataChange(
      AuditAction.BOI_UPDATE,
      AuditResource.BOI_COMPLIANCE,
      currentCompliance.id,
      { filingStatus: currentCompliance.filingStatus },
      { filingStatus: status, confirmationNumber },
      {
        userId,
        ipAddress,
        userAgent
      }
    );
    
    boiLogger.info('BOI compliance status updated', {
      userId,
      companyId,
      oldStatus: currentCompliance.filingStatus,
      newStatus: status,
      confirmationNumber
    });
    
    return updatedCompliance;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    await logFailure(AuditAction.BOI_UPDATE, AuditResource.BOI_COMPLIANCE, errorMessage, {
      userId,
      ipAddress,
      userAgent,
      metadata: { companyId, status }
    });
    
    boiLogger.error('Failed to update BOI compliance status:', {
      error: errorMessage,
      userId,
      companyId,
      status
    });
    
    throw new Error('BOI compliance status update failed');
  }
};

/**
 * Add beneficial owner
 */
export const addBeneficialOwner = async (
  userId: string,
  companyId: string,
  ownerData: BeneficialOwnerData
): Promise<string> => {
  try {
    const ownerId = crypto.randomUUID();
    const addressId = crypto.randomUUID();
    const docId = crypto.randomUUID();
    
    // Encrypt sensitive data
    const encryptedData = encryptSensitiveFields({
      firstName: ownerData.firstName,
      lastName: ownerData.lastName,
      dateOfBirth: ownerData.dateOfBirth.toISOString(),
      documentNumber: ownerData.identificationDocument.number
    }, ['firstName', 'lastName', 'dateOfBirth', 'documentNumber']);
    
    await transaction(async (trx) => {
      // Create address
      await trx.raw(`
        INSERT INTO addresses (
          id, street, city, state, zipCode, county, country, type, createdAt, updatedAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'residential', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `, [
        addressId,
        ownerData.address.street,
        ownerData.address.city,
        ownerData.address.state,
        ownerData.address.zipCode,
        ownerData.address.county,
        ownerData.address.country
      ]);

      // Create beneficial owner
      await trx.raw(`
        INSERT INTO beneficial_owners (
          id, userId, companyId, firstName, lastName, dateOfBirth, addressId,
          ownershipPercentage, controlType, isExempt, createdAt, updatedAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `, [
        ownerId,
        userId,
        companyId,
        JSON.stringify(encryptedData.firstName),
        JSON.stringify(encryptedData.lastName),
        JSON.stringify(encryptedData.dateOfBirth),
        addressId,
        ownerData.ownershipPercentage || null,
        ownerData.controlType,
        ownerData.isExempt ? 1 : 0
      ]);
      
      // Create identification document
      dbUtils.run(`
        INSERT INTO identification_documents (
          id, beneficialOwnerId, type, number, issuingState, issuingCountry,
          expirationDate, createdAt, updatedAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `, [
        docId,
        ownerId,
        ownerData.identificationDocument.type,
        JSON.stringify(encryptedData.documentNumber),
        ownerData.identificationDocument.issuingState || null,
        ownerData.identificationDocument.issuingCountry,
        ownerData.identificationDocument.expirationDate?.toISOString() || null
      ]);
    });
    
    boiLogger.info('Beneficial owner added', {
      userId,
      companyId,
      ownerId,
      controlType: ownerData.controlType
    });
    
    return ownerId;
  } catch (error) {
    boiLogger.error('Failed to add beneficial owner:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId,
      companyId
    });
    throw new Error('Beneficial owner creation failed');
  }
};

/**
 * Get companies approaching BOI deadline
 */
export const getCompaniesApproachingDeadline = async (daysBeforeDeadline: number = 30): Promise<any[]> => {
  try {
    return await dbUtils.all(`
      SELECT bc.*, u.email, u.firstName, u.lastName, c.legalName
      FROM boi_compliance bc
      JOIN users u ON bc.userId = u.id
      JOIN companies c ON bc.companyId = c.id
      WHERE bc.filingStatus IN ('not_started', 'in_progress')
      AND bc.deadline <= datetime('now', '+${daysBeforeDeadline} days')
      AND bc.deadline > datetime('now')
      ORDER BY bc.deadline ASC
    `);
  } catch (error) {
    boiLogger.error('Failed to get companies approaching deadline:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      daysBeforeDeadline
    });
    return [];
  }
};

/**
 * Send BOI compliance reminders
 */
export const sendBOIReminders = async (): Promise<number> => {
  try {
    const companies = await getCompaniesApproachingDeadline(30);
    let remindersSent = 0;
    
    for (const company of companies) {
      // Check if reminder was sent recently (within 7 days)
      const lastReminder = company.lastReminderDate ? new Date(company.lastReminderDate) : null;
      const daysSinceLastReminder = lastReminder 
        ? Math.floor((Date.now() - lastReminder.getTime()) / (1000 * 60 * 60 * 24))
        : Infinity;
      
      if (daysSinceLastReminder >= 7) {
        // Update reminder count and date
        dbUtils.run(`
          UPDATE boi_compliance 
          SET remindersSent = remindersSent + 1, lastReminderDate = CURRENT_TIMESTAMP
          WHERE id = ?
        `, [company.id]);
        
        // TODO: Send actual reminder email/notification
        // This would integrate with email service in Phase 3
        
        remindersSent++;
        
        boiLogger.info('BOI reminder sent', {
          companyId: company.companyId,
          userId: company.userId,
          deadline: company.deadline,
          reminderCount: company.remindersSent + 1
        });
      }
    }
    
    return remindersSent;
  } catch (error) {
    boiLogger.error('Failed to send BOI reminders:', {
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    return 0;
  }
};



