import crypto from 'crypto';
import { dbUtils } from '@utils/database';
import { logSuccess, logFailure, AuditAction, AuditResource } from '@utils/audit';
import { dbLogger } from '@utils/logger';
import { analyzeDocument } from './documentAnalysisService';
import { findMatchingGrants, storeGrantMatches } from './grantMatchingService';
import { updateWizardProgress, getWizardProgress } from './wizardService';
import { VeteranProfile } from '../types';

// Document processing pipeline
export interface DocumentProcessingPipeline {
  documentId: string;
  userId: string;
  stages: ProcessingStage[];
  currentStage: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  startedAt: Date;
  completedAt?: Date;
  error?: string;
}

export interface ProcessingStage {
  name: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  startedAt?: Date;
  completedAt?: Date;
  error?: string;
  results?: Record<string, any>;
}

/**
 * Process document through the complete analysis pipeline
 */
export const processDocumentPipeline = async (
  documentId: string,
  userId: string,
  filePath: string,
  mimeType: string,
  documentType: string
): Promise<void> => {
  const pipeline: DocumentProcessingPipeline = {
    documentId,
    userId,
    stages: [
      { name: 'text_extraction', status: 'pending' },
      { name: 'data_extraction', status: 'pending' },
      { name: 'qualification_analysis', status: 'pending' },
      { name: 'grant_matching', status: 'pending' },
      { name: 'profile_update', status: 'pending' },
      { name: 'wizard_integration', status: 'pending' }
    ],
    currentStage: 0,
    status: 'processing',
    startedAt: new Date()
  };
  
  try {
    // Stage 1-3: Document Analysis (handled by documentAnalysisService)
    await updateStageStatus(pipeline, 0, 'processing');
    const analysisResults = await analyzeDocument(documentId, userId, filePath, mimeType);
    await updateStageStatus(pipeline, 0, 'completed', { analysisResults });
    
    // Stage 4: Grant Matching
    await updateStageStatus(pipeline, 3, 'processing');
    const grantMatches = await performGrantMatching(documentId, userId, analysisResults);
    await updateStageStatus(pipeline, 3, 'completed', { grantMatches });
    
    // Stage 5: Profile Update
    await updateStageStatus(pipeline, 4, 'processing');
    const profileUpdates = await updateUserProfileFromDocument(documentId, userId, analysisResults);
    await updateStageStatus(pipeline, 4, 'completed', { profileUpdates });
    
    // Stage 6: Wizard Integration
    await updateStageStatus(pipeline, 5, 'processing');
    await integrateWithWizardProgress(documentId, userId, analysisResults);
    await updateStageStatus(pipeline, 5, 'completed');
    
    // Mark pipeline as completed
    pipeline.status = 'completed';
    pipeline.completedAt = new Date();
    
    await logSuccess(AuditAction.DOCUMENT_UPDATE, AuditResource.DOCUMENT, {
      userId,
      resourceId: documentId,
      metadata: {
        operation: 'pipeline_completed',
        processingTime: pipeline.completedAt.getTime() - pipeline.startedAt.getTime(),
        stagesCompleted: pipeline.stages.filter(s => s.status === 'completed').length
      }
    });
    
    dbLogger.info('Document processing pipeline completed', {
      documentId,
      userId,
      processingTime: pipeline.completedAt.getTime() - pipeline.startedAt.getTime()
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    pipeline.status = 'failed';
    pipeline.error = errorMessage;
    
    await logFailure(AuditAction.DOCUMENT_UPDATE, AuditResource.DOCUMENT, errorMessage, {
      userId,
      resourceId: documentId,
      metadata: { operation: 'pipeline_failed' }
    });
    
    dbLogger.error('Document processing pipeline failed:', {
      error: errorMessage,
      documentId,
      userId,
      currentStage: pipeline.currentStage
    });
    
    throw error;
  }
};

/**
 * Update processing stage status
 */
const updateStageStatus = async (
  pipeline: DocumentProcessingPipeline,
  stageIndex: number,
  status: 'pending' | 'processing' | 'completed' | 'failed',
  results?: Record<string, any>
): Promise<void> => {
  const stage = pipeline.stages[stageIndex];
  if (!stage) return;
  
  stage.status = status;
  
  if (status === 'processing') {
    stage.startedAt = new Date();
    pipeline.currentStage = stageIndex;
  } else if (status === 'completed' || status === 'failed') {
    stage.completedAt = new Date();
    if (results) {
      stage.results = results;
    }
  }
};

/**
 * Perform grant matching based on document analysis
 */
const performGrantMatching = async (
  documentId: string,
  userId: string,
  analysisResults: any[]
): Promise<any[]> => {
  try {
    // Extract all data points from analysis results
    const allDataPoints: any[] = [];
    
    for (const result of analysisResults) {
      if (result.structuredData) {
        // Get data points from database
        const dataPoints = dbUtils.all(`
          SELECT * FROM document_data_points 
          WHERE analysisId = ? AND verificationStatus != 'flagged'
        `, [result.id]);
        
        allDataPoints.push(...dataPoints);
      }
    }
    
    const grantMatches = await findMatchingGrantsFromDataPoints(userId, allDataPoints);
    
    // Store cross-references
    for (const match of grantMatches) {
        for (const dataPointId of match.dataPointIds) {
            await createDocumentCrossReference(
                documentId,
                userId,
                dataPointId,
                'grant_eligibility',
                'grant_opportunity',
                match.grantId,
                match.confidence,
                match.reason
              );
        }
    }
    
    return grantMatches;
  } catch (error) {
    dbLogger.error('Grant matching failed:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      documentId,
      userId
    });
    return [];
  }
};

/**
 * Update user profile with verified information from documents
 */
const updateUserProfileFromDocument = async (
  documentId: string,
  userId: string,
  analysisResults: any[]
): Promise<Record<string, any>> => {
  try {
    const profileUpdates: Record<string, any> = {};
    
    // Extract high-confidence data points that can update user profile
    for (const result of analysisResults) {
      if (result.structuredData) {
        const dataPoints = dbUtils.all(`
          SELECT * FROM document_data_points 
          WHERE analysisId = ? AND confidenceScore > 0.8 AND verificationStatus = 'unverified'
        `, [result.id]);
        
        for (const dataPoint of dataPoints) {
          switch (dataPoint.dataType) {
            case 'disability_rating':
              profileUpdates.disabilityRating = dataPoint.extractedValue;
              break;
            case 'state':
              profileUpdates.state = dataPoint.extractedValue;
              break;
            case 'branch_of_service':
              profileUpdates.branchOfService = dataPoint.extractedValue;
              break;
            // Add more mappings as needed
          }
        }
      }
    }
    
    // Update veteran verification record if applicable
    if (Object.keys(profileUpdates).length > 0) {
      await updateVeteranVerificationFromDocument(userId, profileUpdates);
    }
    
    return profileUpdates;
  } catch (error) {
    dbLogger.error('Profile update from document failed:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      documentId,
      userId
    });
    return {};
  }
};

/**
 * Update veteran verification with document-extracted data
 */
const updateVeteranVerificationFromDocument = async (
  userId: string,
  extractedData: Record<string, any>
): Promise<void> => {
  try {
    const updateFields: string[] = [];
    const updateValues: any[] = [];
    
    if (extractedData.branchOfService) {
      updateFields.push('branchOfService = ?');
      updateValues.push(extractedData.branchOfService);
    }
    
    if (extractedData.disabilityRating) {
      updateFields.push('notes = ?');
      updateValues.push(`Disability rating: ${extractedData.disabilityRating}% (from document)`);
    }
    
    if (updateFields.length > 0) {
      updateFields.push('updatedAt = CURRENT_TIMESTAMP');
      updateValues.push(userId);
      
      dbUtils.run(`
        UPDATE veteran_verification 
        SET ${updateFields.join(', ')}
        WHERE userId = ?
      `, updateValues);
    }
  } catch (error) {
    dbLogger.error('Failed to update veteran verification from document:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId
    });
  }
};

/**
 * Integrate document analysis with wizard progress
 */
const integrateWithWizardProgress = async (
  documentId: string,
  userId: string,
  analysisResults: any[]
): Promise<void> => {
  try {
    // Check if document analysis step should be marked as complete
    const hasAnalysisResults = analysisResults.some(r => r.id);
    
    if (hasAnalysisResults) {
        const progress = await getWizardProgress(userId);
      await updateWizardProgress(userId, {
        stepData: {
          ...(progress?.stepData || {}),
          document_analysis: {
            documentId,
            analysisCompleted: true,
            resultsCount: analysisResults.length
          },
        },
        completedSteps: [...(progress?.completedSteps || []), 'document_analysis'],
      });
    }
    
    // Check if we should advance to data verification step
    const hasDataPoints = analysisResults.some(r => r.structuredData && Object.keys(r.structuredData).length > 0);
    
    if (hasDataPoints) {
      await updateWizardProgress(userId, {
        currentStep: 'data_verification'
      });
    }
  } catch (error) {
    dbLogger.error('Failed to integrate with wizard progress:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      documentId,
      userId
    });
  }
};

/**
 * Find matching grants based on data points
 */
const findMatchingGrantsFromDataPoints = async (userId: string, dataPoints: any[]): Promise<any[]> => {
  try {
    // Get user profile from database
    const user = dbUtils.get(`
      SELECT u.*, vv.*
      FROM users u
      LEFT JOIN veteran_verification vv ON u.id = vv.userId
      WHERE u.id = ?
    `, [userId]);

    if (!user) {
      dbLogger.warn('User not found for grant matching', { userId });
      return [];
    }

    // Extract needs from data points
    const extractedNeeds = extractNeedsFromDataPoints(dataPoints);

    // Build veteran profile for matching
    const veteranProfile: VeteranProfile = {
      userId: user.id,
      disabilityRating: user.disabilityRating || 100,
      isPermanentAndTotal: user.isPermanentAndTotal || true,
      state: user.state || 'TX',
      county: user.county || '',
      maritalStatus: user.maritalStatus || 'single',
      hasMinorChildren: user.hasMinorChildren || false,
      annualHouseholdIncome: user.annualHouseholdIncome,
      isHomelessOrAtRisk: user.isHomelessOrAtRisk || false,
      serviceEra: user.serviceEra || 'post-9/11',
      branchOfService: user.branchOfService || '',
      dischargeType: user.dischargeType || 'honorable',
      needs: extractedNeeds,
      availableDocuments: extractAvailableDocuments(dataPoints)
    };

    // Perform grant matching
    const matches = await findMatchingGrants(veteranProfile);

    // Store matches in database
    await storeGrantMatches(userId, matches);

    dbLogger.info('Grant matching completed from document analysis', {
      userId,
      matchCount: matches.length,
      extractedNeeds: extractedNeeds.length
    });

    return matches.map(match => ({
        ...match,
        dataPointIds: dataPoints.map(dp => dp.id)
    }));

  } catch (error) {
    dbLogger.error('Grant matching from documents failed:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId
    });
    return [];
  }
};

/**
 * Extract needs from document data points
 */
const extractNeedsFromDataPoints = (dataPoints: any[]): string[] => {
  const needs: string[] = [];

  for (const dataPoint of dataPoints) {
    const value = dataPoint.extractedValue?.toLowerCase() || '';
    const fieldName = dataPoint.fieldName?.toLowerCase() || '';

    // Look for financial needs indicators
    if (fieldName.includes('bill') || fieldName.includes('expense')) {
      if (value.includes('rent') || value.includes('housing')) needs.push('rent');
      if (value.includes('utility') || value.includes('electric') || value.includes('gas')) needs.push('utilities');
      if (value.includes('medical') || value.includes('health')) needs.push('medical');
      if (value.includes('food') || value.includes('grocery')) needs.push('food');
    }

    // Look for education indicators
    if (fieldName.includes('education') || fieldName.includes('school') || fieldName.includes('college')) {
      needs.push('education');
    }

    // Look for employment indicators
    if (fieldName.includes('employment') || fieldName.includes('job') || fieldName.includes('work')) {
      needs.push('employment');
    }

    // Look for emergency indicators
    if (value.includes('emergency') || value.includes('urgent') || value.includes('crisis')) {
      needs.push('emergency');
    }
  }

  return [...new Set(needs)]; // Remove duplicates
};

/**
 * Extract available documents from data points
 */
const extractAvailableDocuments = (dataPoints: any[]): string[] => {
  const documents: string[] = [];

  for (const dataPoint of dataPoints) {
    const fieldName = dataPoint.fieldName?.toLowerCase() || '';

    if (fieldName.includes('dd-214') || fieldName.includes('dd214')) {
      documents.push('DD-214');
    }
    if (fieldName.includes('disability') && fieldName.includes('letter')) {
      documents.push('VA Disability Letter');
    }
    if (fieldName.includes('income') || fieldName.includes('tax')) {
      documents.push('Income Documentation');
    }
    if (fieldName.includes('bank') || fieldName.includes('statement')) {
      documents.push('Bank Statements');
    }
  }

  return [...new Set(documents)]; // Remove duplicates
};

/**
 * Create document cross-reference
 */
const createDocumentCrossReference = async (
  documentId: string,
  userId: string,
  dataPointId: string | null,
  referenceType: string,
  referenceEntityType: string,
  referenceEntityId: string,
  matchConfidence?: number,
  matchReason?: string
): Promise<void> => {
  try {
    const crossRefId = crypto.randomUUID();
    
    dbUtils.run(`
      INSERT INTO document_cross_references (
        id, documentId, userId, dataPointId, referenceType, referenceEntityType,
        referenceEntityId, matchConfidence, matchReason, isActive, createdAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP)
    `, [
      crossRefId,
      documentId,
      userId,
      dataPointId,
      referenceType,
      referenceEntityType,
      referenceEntityId,
      matchConfidence || null,
      matchReason || null
    ]);
  } catch (error) {
    dbLogger.error('Failed to create document cross-reference:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      documentId,
      userId,
      referenceType,
      referenceEntityType,
      referenceEntityId
    });
  }
};
