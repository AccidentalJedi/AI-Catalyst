import crypto from 'crypto';
import { dbUtils } from '@utils/databaseAdapter';
import { logSuccess, logFailure, logDataChange, AuditAction, AuditResource } from '@utils/audit';
import { dbLogger } from '@utils/logger';
import { WizardProgressEntity, ComplianceCheckpoint } from '../types/index';

// Wizard phases and steps configuration
export const WIZARD_PHASES = {
  DOCUMENT_DISCOVERY: {
    id: 'document_discovery',
    name: 'Document Discovery & Analysis',
    order: 0,
    steps: [
      { id: 'document_upload', name: 'Upload Supporting Documents', required: false },
      { id: 'document_analysis', name: 'AI-Powered Document Analysis', required: false },
      { id: 'data_verification', name: 'Verify Extracted Information', required: false },
      { id: 'qualification_discovery', name: 'Discover Hidden Qualifications', required: false }
    ]
  },
  PRE_FORMATION: {
    id: 'pre_formation',
    name: 'Pre-Formation & Veteran Qualification',
    order: 1,
    steps: [
      { id: 'veteran_verification', name: 'Veteran Status Verification', required: true },
      { id: 'business_assessment', name: 'Business Readiness Assessment', required: true },
      { id: 'legal_structure_selection', name: 'Legal Structure Selection', required: true },
      { id: 'name_availability', name: 'Business Name Availability Check', required: true }
    ]
  },
  BUSINESS_FORMATION: {
    id: 'business_formation',
    name: 'Formal Business Formation',
    order: 2,
    steps: [
      { id: 'registered_agent', name: 'Registered Agent Setup', required: true },
      { id: 'articles_of_organization', name: 'Articles of Organization', required: true },
      { id: 'operating_agreement', name: 'Operating Agreement', required: true },
      { id: 'state_filing', name: 'State Filing Submission', required: true }
    ]
  },
  FEDERAL_SETUP: {
    id: 'federal_setup',
    name: 'Federal & Financial Setup',
    order: 3,
    steps: [
      { id: 'ein_application', name: 'EIN Application', required: true },
      { id: 'boi_compliance', name: 'FinCEN BOI Compliance', required: true },
      { id: 'business_banking', name: 'Business Banking Setup', required: false },
      { id: 'accounting_setup', name: 'Accounting System Setup', required: false }
    ]
  },
  PLATFORM_RISK: {
    id: 'platform_risk',
    name: 'Platform & Risk Management',
    order: 4,
    steps: [
      { id: 'business_insurance', name: 'Business Insurance', required: true },
      { id: 'platform_development', name: 'AI Education Platform Development', required: false },
      { id: 'compliance_framework', name: 'Compliance Framework Setup', required: true },
      { id: 'risk_assessment', name: 'Risk Assessment & Mitigation', required: true }
    ]
  },
  VETERAN_BENEFITS: {
    id: 'veteran_benefits',
    name: 'Leveraging Veteran Benefits',
    order: 5,
    steps: [
      { id: 'sba_certification', name: 'SBA Veteran Certification', required: false },
      { id: 'grant_discovery', name: 'Grant & Funding Discovery', required: false },
      { id: 'veteran_networking', name: 'Veteran Business Networking', required: false },
      { id: 'launch_preparation', name: 'Launch Preparation', required: true }
    ]
  }
} as const;

// Wizard step data
export interface WizardStepData {
  stepId: string;
  data: Record<string, any>;
  isComplete: boolean;
  completedAt?: Date;
  notes?: string;
}

// Wizard progress update
export interface WizardProgressUpdate {
  currentPhase?: string;
  currentStep?: string;
  stepData?: WizardStepData;
  overallProgress?: number;
}

/**
 * Initialize wizard progress for a user
 */
export const initializeWizardProgress = async (
  userId: string,
  ipAddress?: string,
  userAgent?: string
): Promise<WizardProgressEntity> => {
  try {
    const progressId = crypto.randomUUID();
    const initialPhase = WIZARD_PHASES.DOCUMENT_DISCOVERY.id;
    const initialStep = WIZARD_PHASES.DOCUMENT_DISCOVERY.steps[0].id;
    
    // Create wizard progress record
    await dbUtils.run(`
      INSERT INTO wizard_progress (
        id, "userId", "currentPhase", "currentStep", "completedSteps",
        "overallProgress", "estimatedTimeRemaining", "lastUpdated", "createdAt"
      ) VALUES ($1, $2, $3, $4, '[]', 0, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `, [progressId, userId, initialPhase, initialStep]);
    
    // Create compliance checkpoints
    await createComplianceCheckpoints(userId);
    
    const progress = await getWizardProgress(userId);
    if (!progress) {
      throw new Error('Failed to retrieve created wizard progress');
    }
    
    await logSuccess(AuditAction.WIZARD_START, AuditResource.WIZARD_PROGRESS, {
      userId,
      resourceId: progressId,
      ipAddress,
      userAgent,
      metadata: { initialPhase, initialStep }
    });
    
    dbLogger.info('Wizard progress initialized', {
      userId,
      progressId,
      initialPhase,
      initialStep
    });
    
    return progress;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    await logFailure(AuditAction.WIZARD_START, AuditResource.WIZARD_PROGRESS, errorMessage, {
      userId,
      ipAddress,
      userAgent
    });
    
    dbLogger.error('Failed to initialize wizard progress:', {
      error: errorMessage,
      userId
    });
    
    throw new Error('Wizard initialization failed');
  }
};

/**
 * Get wizard progress for a user
 */
export const getWizardProgress = async (userId: string): Promise<WizardProgressEntity | null> => {
  try {
    const progress = await dbUtils.get<any>(`
      SELECT * FROM wizard_progress
      WHERE "userId" = $1
      ORDER BY "createdAt" DESC
      LIMIT 1
    `, [userId]);

    if (!progress) {
      return null;
    }

    // Get compliance checkpoints
    const checkpoints = await dbUtils.all<any>(`
      SELECT * FROM compliance_checkpoints
      WHERE "userId" = $1
      ORDER BY deadline ASC
    `, [userId]);
    
    return {
      id: progress.id,
      userId: progress.userId,
      currentPhase: progress.currentPhase,
      currentStep: progress.currentStep,
      completedSteps: JSON.parse(progress.completedSteps || '[]'),
      overallProgress: progress.overallProgress,
      estimatedTimeRemaining: progress.estimatedTimeRemaining,
      complianceCheckpoints: checkpoints.map(cp => ({
        id: cp.id,
        name: cp.name,
        description: cp.description,
        isRequired: Boolean(cp.isRequired),
        isCompleted: Boolean(cp.isCompleted),
        deadline: cp.deadline ? new Date(cp.deadline) : undefined,
        completedAt: cp.completedAt ? new Date(cp.completedAt) : undefined,
        notes: cp.notes
      })),
      lastUpdated: new Date(progress.lastUpdated),
      createdAt: new Date(progress.createdAt)
    };
  } catch (error) {
    dbLogger.error('Failed to get wizard progress:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId
    });
    return null;
  }
};

/**
 * Update wizard progress
 */
export const updateWizardProgress = async (
  userId: string,
  update: WizardProgressUpdate,
  ipAddress?: string,
  userAgent?: string
): Promise<WizardProgressEntity | null> => {
  try {
    const currentProgress = await getWizardProgress(userId);
    if (!currentProgress) {
      throw new Error('Wizard progress not found');
    }
    
    let completedSteps = [...currentProgress.completedSteps];
    let overallProgress = currentProgress.overallProgress;
    
    // Handle step completion
    if (update.stepData && update.stepData.isComplete) {
      if (!completedSteps.includes(update.stepData.stepId)) {
        completedSteps.push(update.stepData.stepId);
        
        // Calculate overall progress
        const totalSteps = Object.values(WIZARD_PHASES).reduce(
          (total, phase) => total + phase.steps.length, 0
        );
        overallProgress = Math.round((completedSteps.length / totalSteps) * 100);
        
        await logSuccess(AuditAction.WIZARD_STEP_COMPLETE, AuditResource.WIZARD_PROGRESS, {
          userId,
          resourceId: currentProgress.id,
          ipAddress,
          userAgent,
          metadata: {
            stepId: update.stepData.stepId,
            completedSteps: completedSteps.length,
            overallProgress
          }
        });
      }
    }
    
    // Build update query
    const updateFields: string[] = [];
    const updateValues: any[] = [];
    let paramIndex = 1;

    if (update.currentPhase) {
      updateFields.push(`"currentPhase" = $${paramIndex++}`);
      updateValues.push(update.currentPhase);
    }

    if (update.currentStep) {
      updateFields.push(`"currentStep" = $${paramIndex++}`);
      updateValues.push(update.currentStep);
    }

    if (completedSteps !== currentProgress.completedSteps) {
      updateFields.push(`"completedSteps" = $${paramIndex++}`);
      updateValues.push(JSON.stringify(completedSteps));
    }

    if (update.overallProgress !== undefined || overallProgress !== currentProgress.overallProgress) {
      updateFields.push(`"overallProgress" = $${paramIndex++}`);
      updateValues.push(update.overallProgress || overallProgress);
    }

    updateFields.push('"lastUpdated" = CURRENT_TIMESTAMP');
    updateValues.push(userId);

    // Execute update
    if (updateFields.length > 1) { // More than just lastUpdated
      await dbUtils.run(`
        UPDATE wizard_progress
        SET ${updateFields.join(', ')}
        WHERE "userId" = $${paramIndex}
      `, updateValues);
    }
    
    // Get updated progress
    const updatedProgress = await getWizardProgress(userId);
    
    dbLogger.info('Wizard progress updated', {
      userId,
      progressId: currentProgress.id,
      updates: Object.keys(update),
      overallProgress: updatedProgress?.overallProgress
    });
    
    return updatedProgress;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    await logFailure(AuditAction.WIZARD_STEP_COMPLETE, AuditResource.WIZARD_PROGRESS, errorMessage, {
      userId,
      ipAddress,
      userAgent,
      metadata: update
    });
    
    dbLogger.error('Failed to update wizard progress:', {
      error: errorMessage,
      userId,
      update
    });
    
    throw new Error('Wizard progress update failed');
  }
};

/**
 * Create compliance checkpoints for a user
 */
const createComplianceCheckpoints = async (userId: string): Promise<void> => {
  const checkpoints = [
    {
      name: 'FinCEN BOI Filing',
      description: 'Submit Beneficial Ownership Information to FinCEN',
      isRequired: true,
      deadline: new Date('2025-03-21') // March 21, 2025 deadline
    },
    {
      name: 'State Business Registration',
      description: 'Complete state business entity registration',
      isRequired: true,
      deadline: null
    },
    {
      name: 'EIN Application',
      description: 'Obtain Employer Identification Number from IRS',
      isRequired: true,
      deadline: null
    },
    {
      name: 'Business Insurance',
      description: 'Secure appropriate business insurance coverage',
      isRequired: true,
      deadline: null
    },
    {
      name: 'SBA Veteran Certification',
      description: 'Apply for SBA Veteran-Owned Small Business certification',
      isRequired: false,
      deadline: null
    }
  ];
  
  for (const checkpoint of checkpoints) {
    const checkpointId = crypto.randomUUID();
    await dbUtils.run(`
      INSERT INTO compliance_checkpoints (
        id, "userId", name, description, "isRequired", deadline,
        "isCompleted", "createdAt", "updatedAt"
      ) VALUES ($1, $2, $3, $4, $5, $6, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `, [
      checkpointId,
      userId,
      checkpoint.name,
      checkpoint.description,
      checkpoint.isRequired,
      checkpoint.deadline ? checkpoint.deadline.toISOString() : null
    ]);
  }
};

/**
 * Get wizard phase and step information
 */
export const getWizardPhaseInfo = (phaseId: string) => {
  return Object.values(WIZARD_PHASES).find(phase => phase.id === phaseId);
};

/**
 * Get next step in wizard
 */
export const getNextStep = (currentPhase: string, currentStep: string) => {
  const phase = getWizardPhaseInfo(currentPhase);
  if (!phase) return null;
  
  const currentStepIndex = phase.steps.findIndex(step => step.id === currentStep);
  if (currentStepIndex === -1) return null;
  
  // Check if there's a next step in current phase
  if (currentStepIndex < phase.steps.length - 1) {
    return {
      phase: currentPhase,
      step: phase.steps[currentStepIndex + 1]
    };
  }
  
  // Move to next phase
  const nextPhase = Object.values(WIZARD_PHASES).find(p => p.order === phase.order + 1);
  if (nextPhase && nextPhase.steps.length > 0) {
    return {
      phase: nextPhase.id,
      step: nextPhase.steps[0]
    };
  }
  
  return null; // Wizard complete
};



