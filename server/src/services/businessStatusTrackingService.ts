/**
 * @file Business Status Tracking Service
 * Comprehensive tracking system for business formation progress and status updates
 */

import crypto from 'crypto';
import { dbUtils, transaction } from '@utils/database';
import { dbLogger, auditLogger } from '@utils/logger';
import {
  BusinessFormationWorkflow,
  WorkflowStatus,
  Company
} from '../types/businessTypes';

/**
 * Business Formation Progress Phases
 */
export enum BusinessFormationPhase {
  INITIALIZATION = 'initialization',
  INFORMATION_GATHERING = 'information_gathering',
  DOCUMENT_PREPARATION = 'document_preparation',
  REVIEW_AND_VALIDATION = 'review_and_validation',
  FILING_AND_SUBMISSION = 'filing_and_submission',
  COMPLETION = 'completion'
}

/**
 * Status Update Event Types
 */
export enum StatusUpdateEvent {
  WORKFLOW_STARTED = 'workflow_started',
  STEP_COMPLETED = 'step_completed',
  DOCUMENT_GENERATED = 'document_generated',
  VALIDATION_PASSED = 'validation_passed',
  VALIDATION_FAILED = 'validation_failed',
  FILING_SUBMITTED = 'filing_submitted',
  FILING_APPROVED = 'filing_approved',
  FILING_REJECTED = 'filing_rejected',
  WORKFLOW_COMPLETED = 'workflow_completed',
  WORKFLOW_CANCELLED = 'workflow_cancelled',
  ERROR_OCCURRED = 'error_occurred'
}

/**
 * Progress Status Interface
 */
export interface BusinessFormationProgress {
  workflowId: string;
  userId: string;
  companyId?: string;
  currentPhase: BusinessFormationPhase;
  currentStep: string;
  completedSteps: string[];
  totalSteps: number;
  progressPercentage: number;
  estimatedTimeRemaining: number; // in minutes
  lastUpdated: string;
  statusHistory: StatusUpdateEvent[];
  milestones: {
    [key: string]: {
      completed: boolean;
      completedAt?: string;
      estimatedCompletion?: string;
    };
  };
}

/**
 * Business Status Tracking Service
 */
export class BusinessStatusTrackingService {
  
  /**
   * Initialize progress tracking for a new workflow
   */
  static async initializeProgressTracking(
    workflowId: string,
    userId: string,
    workflowType: string
  ): Promise<BusinessFormationProgress> {
    try {
      const totalSteps = this.getTotalStepsForWorkflowType(workflowType);
      const milestones = this.getWorkflowMilestones(workflowType);
      
      const progress: BusinessFormationProgress = {
        workflowId,
        userId,
        currentPhase: BusinessFormationPhase.INITIALIZATION,
        currentStep: 'business_info',
        completedSteps: [],
        totalSteps,
        progressPercentage: 0,
        estimatedTimeRemaining: this.calculateEstimatedTime(workflowType),
        lastUpdated: new Date().toISOString(),
        statusHistory: [StatusUpdateEvent.WORKFLOW_STARTED],
        milestones
      };
      
      // Store in wizard_progress table for integration
      await this.updateWizardProgress(progress);
      
      // Log status update
      await this.logStatusUpdate(workflowId, StatusUpdateEvent.WORKFLOW_STARTED, {
        workflowType,
        totalSteps,
        estimatedTime: progress.estimatedTimeRemaining
      });
      
      auditLogger.info('Business formation progress tracking initialized', {
        userId,
        workflowId,
        workflowType,
        totalSteps
      });
      
      return progress;
    } catch (error) {
      dbLogger.error('Failed to initialize progress tracking:', {
        workflowId,
        userId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }
  
  /**
   * Update progress when a step is completed
   */
  static async updateStepProgress(
    workflowId: string,
    stepId: string,
    stepData?: Record<string, any>
  ): Promise<BusinessFormationProgress> {
    try {
      return await transaction(async () => {
        // Get current progress
        const currentProgress = await this.getProgress(workflowId);
        if (!currentProgress) {
          throw new Error('Progress tracking not found');
        }
        
        // Update completed steps
        if (!currentProgress.completedSteps.includes(stepId)) {
          currentProgress.completedSteps.push(stepId);
        }
        
        // Update current step and phase
        currentProgress.currentStep = stepId;
        currentProgress.currentPhase = this.determinePhaseFromStep(stepId);
        
        // Calculate progress percentage
        currentProgress.progressPercentage = Math.round(
          (currentProgress.completedSteps.length / currentProgress.totalSteps) * 100
        );
        
        // Update estimated time remaining
        currentProgress.estimatedTimeRemaining = this.calculateRemainingTime(
          currentProgress.completedSteps.length,
          currentProgress.totalSteps
        );
        
        // Update milestones
        this.updateMilestones(currentProgress, stepId);
        
        // Add to status history
        currentProgress.statusHistory.push(StatusUpdateEvent.STEP_COMPLETED);
        currentProgress.lastUpdated = new Date().toISOString();
        
        // Update wizard progress
        await this.updateWizardProgress(currentProgress);
        
        // Log status update
        await this.logStatusUpdate(workflowId, StatusUpdateEvent.STEP_COMPLETED, {
          stepId,
          progressPercentage: currentProgress.progressPercentage,
          currentPhase: currentProgress.currentPhase,
          stepData
        });
        
        auditLogger.info('Business formation step progress updated', {
          userId: currentProgress.userId,
          workflowId,
          stepId,
          progressPercentage: currentProgress.progressPercentage,
          currentPhase: currentProgress.currentPhase
        });
        
        return currentProgress;
      });
    } catch (error) {
      dbLogger.error('Failed to update step progress:', {
        workflowId,
        stepId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }
  
  /**
   * Update progress when a document is generated
   */
  static async updateDocumentProgress(
    workflowId: string,
    documentType: string,
    documentId: string
  ): Promise<void> {
    try {
      await this.logStatusUpdate(workflowId, StatusUpdateEvent.DOCUMENT_GENERATED, {
        documentType,
        documentId,
        timestamp: new Date().toISOString()
      });
      
      // Update milestone if applicable
      const progress = await this.getProgress(workflowId);
      if (progress) {
        const milestoneKey = `document_${documentType}`;
        if (progress.milestones[milestoneKey]) {
          progress.milestones[milestoneKey].completed = true;
          progress.milestones[milestoneKey].completedAt = new Date().toISOString();
          await this.updateWizardProgress(progress);
        }
      }
      
      auditLogger.info('Document generation progress updated', {
        workflowId,
        documentType,
        documentId
      });
    } catch (error) {
      dbLogger.error('Failed to update document progress:', {
        workflowId,
        documentType,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
  
  /**
   * Update progress when workflow is completed
   */
  static async completeWorkflowProgress(workflowId: string): Promise<void> {
    try {
      const progress = await this.getProgress(workflowId);
      if (!progress) {
        throw new Error('Progress tracking not found');
      }
      
      progress.currentPhase = BusinessFormationPhase.COMPLETION;
      progress.progressPercentage = 100;
      progress.estimatedTimeRemaining = 0;
      progress.statusHistory.push(StatusUpdateEvent.WORKFLOW_COMPLETED);
      progress.lastUpdated = new Date().toISOString();
      
      // Mark all milestones as completed
      Object.keys(progress.milestones).forEach(key => {
        if (!progress.milestones[key].completed) {
          progress.milestones[key].completed = true;
          progress.milestones[key].completedAt = new Date().toISOString();
        }
      });
      
      await this.updateWizardProgress(progress);
      
      await this.logStatusUpdate(workflowId, StatusUpdateEvent.WORKFLOW_COMPLETED, {
        completionTime: new Date().toISOString(),
        totalSteps: progress.totalSteps
      });
      
      auditLogger.info('Business formation workflow completed', {
        userId: progress.userId,
        workflowId,
        totalSteps: progress.totalSteps
      });
    } catch (error) {
      dbLogger.error('Failed to complete workflow progress:', {
        workflowId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
  
  /**
   * Get current progress for a workflow
   */
  static async getProgress(workflowId: string): Promise<BusinessFormationProgress | null> {
    try {
      const result = dbUtils.get(`
        SELECT * FROM wizard_progress 
        WHERE id = ?
      `, [workflowId]);
      
      if (!result) {
        return null;
      }
      
      const completedSteps = result.completedSteps ? JSON.parse(result.completedSteps) : [];
      
      return {
        workflowId: result.id,
        userId: result.userId,
        currentPhase: result.currentPhase as BusinessFormationPhase,
        currentStep: result.currentStep,
        completedSteps,
        totalSteps: 10, // Default, should be calculated based on workflow type
        progressPercentage: result.overallProgress,
        estimatedTimeRemaining: result.estimatedTimeRemaining,
        lastUpdated: result.lastUpdated,
        statusHistory: [], // Would need separate table for full history
        milestones: {} // Would need separate table for milestones
      };
    } catch (error) {
      dbLogger.error('Failed to get progress:', {
        workflowId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return null;
    }
  }
  
  /**
   * Get progress statistics for user
   */
  static async getUserProgressStats(userId: string): Promise<{
    totalWorkflows: number;
    completedWorkflows: number;
    inProgressWorkflows: number;
    averageCompletionTime: number;
  }> {
    try {
      const stats = dbUtils.get(`
        SELECT 
          COUNT(*) as totalWorkflows,
          SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completedWorkflows,
          SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as inProgressWorkflows
        FROM business_formation_workflows 
        WHERE userId = ?
      `, [userId]);
      
      // Calculate average completion time (simplified)
      const avgTime = dbUtils.get(`
        SELECT AVG(
          CASE 
            WHEN actualCompletion IS NOT NULL 
            THEN (julianday(actualCompletion) - julianday(createdAt)) * 24 * 60 
            ELSE NULL 
          END
        ) as avgMinutes
        FROM business_formation_workflows 
        WHERE userId = ? AND status = 'completed'
      `, [userId]);
      
      return {
        totalWorkflows: stats?.totalWorkflows || 0,
        completedWorkflows: stats?.completedWorkflows || 0,
        inProgressWorkflows: stats?.inProgressWorkflows || 0,
        averageCompletionTime: avgTime?.avgMinutes || 0
      };
    } catch (error) {
      dbLogger.error('Failed to get user progress stats:', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      
      return {
        totalWorkflows: 0,
        completedWorkflows: 0,
        inProgressWorkflows: 0,
        averageCompletionTime: 0
      };
    }
  }
  
  /**
   * Update wizard progress table for integration
   */
  private static async updateWizardProgress(progress: BusinessFormationProgress): Promise<void> {
    dbUtils.run(`
      INSERT OR REPLACE INTO wizard_progress (
        id, userId, currentPhase, currentStep, completedSteps,
        overallProgress, estimatedTimeRemaining, lastUpdated
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      progress.workflowId,
      progress.userId,
      progress.currentPhase,
      progress.currentStep,
      JSON.stringify(progress.completedSteps),
      progress.progressPercentage,
      progress.estimatedTimeRemaining,
      progress.lastUpdated
    ]);
  }
  
  /**
   * Log status update event
   */
  private static async logStatusUpdate(
    workflowId: string,
    event: StatusUpdateEvent,
    metadata: Record<string, any>
  ): Promise<void> {
    dbUtils.run(`
      INSERT INTO audit_logs (
        id, userId, action, resourceType, resourceId, 
        metadata, timestamp
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [
      crypto.randomUUID(),
      'system', // System-generated event
      event,
      'business_formation_workflow',
      workflowId,
      JSON.stringify(metadata),
      new Date().toISOString()
    ]);
  }
  
  /**
   * Get total steps for workflow type
   */
  private static getTotalStepsForWorkflowType(workflowType: string): number {
    const stepCounts: Record<string, number> = {
      'llc_formation': 10,
      'corporation_formation': 12,
      'partnership_formation': 8
    };
    
    return stepCounts[workflowType] || 10;
  }
  
  /**
   * Get workflow milestones
   */
  private static getWorkflowMilestones(workflowType: string): BusinessFormationProgress['milestones'] {
    const baseMilestones = {
      'information_complete': { completed: false },
      'documents_generated': { completed: false },
      'review_completed': { completed: false },
      'filing_submitted': { completed: false },
      'formation_complete': { completed: false }
    };
    
    if (workflowType === 'llc_formation') {
      return {
        ...baseMilestones,
        'document_form_205': { completed: false },
        'document_operating_agreement': { completed: false },
        'document_ein_application': { completed: false }
      };
    }
    
    return baseMilestones;
  }
  
  /**
   * Determine phase from current step
   */
  private static determinePhaseFromStep(stepId: string): BusinessFormationPhase {
    const phaseMap: Record<string, BusinessFormationPhase> = {
      'business_info': BusinessFormationPhase.INFORMATION_GATHERING,
      'registered_agent': BusinessFormationPhase.INFORMATION_GATHERING,
      'business_address': BusinessFormationPhase.INFORMATION_GATHERING,
      'organizers': BusinessFormationPhase.INFORMATION_GATHERING,
      'management_structure': BusinessFormationPhase.INFORMATION_GATHERING,
      'operating_agreement': BusinessFormationPhase.DOCUMENT_PREPARATION,
      'document_generation': BusinessFormationPhase.DOCUMENT_PREPARATION,
      'review_submit': BusinessFormationPhase.REVIEW_AND_VALIDATION,
      'filing': BusinessFormationPhase.FILING_AND_SUBMISSION,
      'completion': BusinessFormationPhase.COMPLETION
    };
    
    return phaseMap[stepId] || BusinessFormationPhase.INFORMATION_GATHERING;
  }
  
  /**
   * Calculate estimated time remaining
   */
  private static calculateEstimatedTime(workflowType: string): number {
    const baseTimes: Record<string, number> = {
      'llc_formation': 120, // 2 hours
      'corporation_formation': 180, // 3 hours
      'partnership_formation': 90 // 1.5 hours
    };
    
    return baseTimes[workflowType] || 120;
  }
  
  /**
   * Calculate remaining time based on progress
   */
  private static calculateRemainingTime(completedSteps: number, totalSteps: number): number {
    const baseTime = 120; // 2 hours base
    const progressRatio = completedSteps / totalSteps;
    return Math.max(0, Math.round(baseTime * (1 - progressRatio)));
  }
  
  /**
   * Update milestones based on step completion
   */
  private static updateMilestones(progress: BusinessFormationProgress, stepId: string): void {
    const milestoneMap: Record<string, string> = {
      'organizers': 'information_complete',
      'document_generation': 'documents_generated',
      'review_submit': 'review_completed',
      'filing': 'filing_submitted',
      'completion': 'formation_complete'
    };
    
    const milestone = milestoneMap[stepId];
    if (milestone && progress.milestones[milestone]) {
      progress.milestones[milestone].completed = true;
      progress.milestones[milestone].completedAt = new Date().toISOString();
    }
  }
}


