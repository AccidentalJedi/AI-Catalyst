/**
 * @file LLC Formation Workflow Service
 * Orchestrates the complete LLC formation process with document generation and status tracking
 */

import { BusinessFormationService } from './businessFormationService';
import { DocumentGenerationService } from './documentGenerationService';
import { ValidationService } from './validationService';
import { dbLogger, auditLogger } from '@utils/logger';
import { dbUtils } from '@utils/databaseAdapter';
import {
  LLCFormationPayload,
  BusinessFormationWorkflow,
  Form205Data,
  DocumentGenerationResponse,
  BusinessFormationResponse
} from '../types/businessTypes';

/**
 * LLC Formation Workflow Steps
 */
export enum LLCWorkflowStep {
  BUSINESS_INFO = 'business_info',
  REGISTERED_AGENT = 'registered_agent',
  BUSINESS_ADDRESS = 'business_address',
  ORGANIZERS = 'organizers',
  MANAGEMENT_STRUCTURE = 'management_structure',
  OPERATING_AGREEMENT = 'operating_agreement',
  DOCUMENT_GENERATION = 'document_generation',
  REVIEW_SUBMIT = 'review_submit',
  FILING = 'filing',
  COMPLETION = 'completion'
}

/**
 * LLC Formation Workflow Service
 */
export class LLCFormationWorkflowService {
  
  /**
   * Start complete LLC formation workflow
   */
  static async startLLCFormation(
    userId: string,
    payload: LLCFormationPayload
  ): Promise<BusinessFormationResponse> {
    try {
      // Validate LLC formation payload
      const validation = ValidationService.validateLLCFormation(payload);
      if (!validation.isValid) {
        return {
          success: false,
          error: 'Validation failed',
          validationErrors: validation.errors?.reduce((acc, error) => {
            acc.general = acc.general || [];
            acc.general.push(error);
            return acc;
          }, {} as Record<string, string[]>)
        };
      }

      // Start business formation workflow
      const result = await BusinessFormationService.startFormation(userId, validation.data!);
      
      if (result.success && result.data) {
        // Initialize LLC-specific workflow data
        await this.initializeLLCWorkflowData(result.data.workflowId, validation.data!);
        
        auditLogger.info('LLC formation workflow started', {
          userId,
          workflowId: result.data.workflowId,
          businessName: validation.data!.businessName,
          managementStructure: validation.data!.managementStructure
        });
      }
      
      return result;
    } catch (error) {
      dbLogger.error('Failed to start LLC formation workflow:', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      
      return {
        success: false,
        error: 'Failed to start LLC formation workflow'
      };
    }
  }
  
  /**
   * Process workflow step completion
   */
  static async processStepCompletion(
    workflowId: string,
    userId: string,
    stepId: string,
    stepData: Record<string, any>
  ): Promise<{ success: boolean; nextStep?: string; documentsGenerated?: string[] }> {
    try {
      return await transaction(async () => {
        // Update the workflow step
        const success = await BusinessFormationService.updateWorkflowStep(
          workflowId,
          userId,
          stepId,
          stepData,
          true
        );
        
        if (!success) {
          throw new Error('Failed to update workflow step');
        }
        
        // Get updated workflow
        const workflow = await BusinessFormationService.getWorkflow(workflowId, userId);
        if (!workflow) {
          throw new Error('Workflow not found');
        }
        
        // Process step-specific logic
        const result = await this.processStepSpecificLogic(workflow, stepId, stepData);
        
        // Determine next step
        const nextStep = this.getNextStep(stepId);
        
        auditLogger.info('LLC workflow step completed', {
          userId,
          workflowId,
          stepId,
          nextStep,
          documentsGenerated: result.documentsGenerated
        });
        
        return {
          success: true,
          nextStep,
          documentsGenerated: result.documentsGenerated
        };
      });
    } catch (error) {
      dbLogger.error('Failed to process step completion:', {
        workflowId,
        stepId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      
      return { success: false };
    }
  }
  
  /**
   * Generate all required documents for LLC formation
   */
  static async generateAllDocuments(
    workflowId: string,
    userId: string
  ): Promise<{ success: boolean; documents?: DocumentGenerationResponse[] }> {
    try {
      const workflow = await BusinessFormationService.getWorkflow(workflowId, userId);
      if (!workflow) {
        throw new Error('Workflow not found');
      }
      
      const documents: DocumentGenerationResponse[] = [];
      
      // Generate Form 205 (Certificate of Formation)
      const form205Data = this.prepareForm205Data(workflow);
      const form205Result = await DocumentGenerationService.generateForm205(workflowId, form205Data);
      if (form205Result.success) {
        documents.push(form205Result);
      }
      
      // Generate Operating Agreement (if requested)
      if (workflow.formData?.operatingAgreement !== false) {
        const operatingAgreementData = this.prepareOperatingAgreementData(workflow);
        const operatingAgreementResult = await DocumentGenerationService.generateOperatingAgreement(
          workflowId,
          operatingAgreementData
        );
        if (operatingAgreementResult.success) {
          documents.push(operatingAgreementResult);
        }
      }
      
      // Generate EIN Application
      const einData = this.prepareEINApplicationData(workflow);
      const einResult = await DocumentGenerationService.generateEINApplication(workflowId, einData);
      if (einResult.success) {
        documents.push(einResult);
      }
      
      auditLogger.info('LLC documents generated', {
        userId,
        workflowId,
        documentsGenerated: documents.length,
        documentTypes: documents.map(d => d.data?.documentId)
      });
      
      return {
        success: true,
        documents
      };
    } catch (error) {
      dbLogger.error('Failed to generate LLC documents:', {
        workflowId,
        userId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      
      return { success: false };
    }
  }
  
  /**
   * Complete LLC formation workflow
   */
  static async completeLLCFormation(
    workflowId: string,
    userId: string
  ): Promise<{ success: boolean; companyId?: string }> {
    try {
      return await transaction(async () => {
        // Complete the workflow
        const success = await BusinessFormationService.completeWorkflow(workflowId, userId);
        if (!success) {
          throw new Error('Failed to complete workflow');
        }
        
        // Get the completed workflow
        const workflow = await BusinessFormationService.getWorkflow(workflowId, userId);
        if (!workflow) {
          throw new Error('Workflow not found');
        }
        
        // Perform final LLC formation tasks
        await this.performFinalLLCTasks(workflow);
        
        auditLogger.info('LLC formation completed', {
          userId,
          workflowId,
          companyId: workflow.companyId
        });
        
        return {
          success: true,
          companyId: workflow.companyId
        };
      });
    } catch (error) {
      dbLogger.error('Failed to complete LLC formation:', {
        workflowId,
        userId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      
      return { success: false };
    }
  }
  
  /**
   * Initialize LLC-specific workflow data
   */
  private static async initializeLLCWorkflowData(
    workflowId: string,
    payload: LLCFormationPayload
  ): Promise<void> {
    const llcSpecificData = {
      organizers: payload.organizers,
      initialMembers: payload.initialMembers,
      managementStructure: payload.managementStructure,
      operatingAgreement: payload.operatingAgreement,
      estimatedFilingDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days from now
      requiredDocuments: ['form_205', 'operating_agreement', 'ein_application'],
      filingFee: 300, // Texas LLC filing fee as of 2025
      processingTime: '5-7 business days'
    };
    
    dbUtils.run(`
      UPDATE business_formation_workflows 
      SET stepData = ? 
      WHERE id = ?
    `, [JSON.stringify(llcSpecificData), workflowId]);
  }
  
  /**
   * Process step-specific logic
   */
  private static async processStepSpecificLogic(
    workflow: BusinessFormationWorkflow,
    stepId: string,
    stepData: Record<string, any>
  ): Promise<{ documentsGenerated?: string[] }> {
    const result: { documentsGenerated?: string[] } = {};
    
    switch (stepId) {
      case LLCWorkflowStep.DOCUMENT_GENERATION:
        // Auto-generate documents when reaching document generation step
        const docResult = await this.generateAllDocuments(workflow.id!, workflow.userId);
        if (docResult.success && docResult.documents) {
          result.documentsGenerated = docResult.documents
            .filter(d => d.success && d.data?.documentId)
            .map(d => d.data!.documentId);
        }
        break;
        
      case LLCWorkflowStep.REVIEW_SUBMIT:
        // Validate all required data is present
        await this.validateCompleteness(workflow);
        break;
        
      case LLCWorkflowStep.FILING:
        // Prepare filing package
        await this.prepareFilingPackage(workflow);
        break;
    }
    
    return result;
  }
  
  /**
   * Get next step in LLC formation workflow
   */
  private static getNextStep(currentStep: string): string {
    const stepOrder = [
      LLCWorkflowStep.BUSINESS_INFO,
      LLCWorkflowStep.REGISTERED_AGENT,
      LLCWorkflowStep.BUSINESS_ADDRESS,
      LLCWorkflowStep.ORGANIZERS,
      LLCWorkflowStep.MANAGEMENT_STRUCTURE,
      LLCWorkflowStep.OPERATING_AGREEMENT,
      LLCWorkflowStep.DOCUMENT_GENERATION,
      LLCWorkflowStep.REVIEW_SUBMIT,
      LLCWorkflowStep.FILING,
      LLCWorkflowStep.COMPLETION
    ];
    
    const currentIndex = stepOrder.indexOf(currentStep as LLCWorkflowStep);
    return currentIndex >= 0 && currentIndex < stepOrder.length - 1 
      ? stepOrder[currentIndex + 1] 
      : currentStep;
  }
  
  /**
   * Prepare Form 205 data from workflow
   */
  private static prepareForm205Data(workflow: BusinessFormationWorkflow): Form205Data {
    const formData = workflow.formData as LLCFormationPayload;
    
    return {
      entityName: formData.businessName,
      entityType: 'Limited Liability Company',
      registeredAgentName: formData.registeredAgent.name,
      registeredOfficeAddress: formData.registeredAgent.address,
      organizers: formData.organizers,
      managementStructure: formData.managementStructure || 'member_managed',
      purpose: formData.purpose || 'To engage in any lawful act or activity for which a limited liability company may be organized under the Texas Business Organizations Code.',
      duration: formData.duration || 'Perpetual',
      effectiveDate: new Date().toISOString()
    };
  }
  
  /**
   * Prepare Operating Agreement data from workflow
   */
  private static prepareOperatingAgreementData(workflow: BusinessFormationWorkflow): any {
    const formData = workflow.formData as LLCFormationPayload;
    
    return {
      entityName: formData.businessName,
      formationDate: new Date().toISOString(),
      registeredAgentName: formData.registeredAgent.name,
      registeredOfficeAddress: formData.registeredAgent.address,
      businessAddress: formData.businessAddress,
      purpose: formData.purpose,
      duration: formData.duration,
      managementStructure: formData.managementStructure,
      initialMembers: formData.initialMembers,
      generatedDate: new Date().toISOString()
    };
  }
  
  /**
   * Prepare EIN Application data from workflow
   */
  private static prepareEINApplicationData(workflow: BusinessFormationWorkflow): any {
    const formData = workflow.formData as LLCFormationPayload;
    
    return {
      entityName: formData.businessName,
      entityType: 'LLC',
      mailingAddress: formData.mailingAddress || formData.businessAddress,
      businessAddress: formData.businessAddress,
      responsibleParty: formData.organizers[0], // First organizer as responsible party
      memberCount: formData.initialMembers.length,
      formationDate: new Date().toISOString(),
      businessPurpose: formData.purpose,
      generatedDate: new Date().toISOString()
    };
  }
  
  /**
   * Validate workflow completeness
   */
  private static async validateCompleteness(workflow: BusinessFormationWorkflow): Promise<void> {
    const requiredSteps = [
      LLCWorkflowStep.BUSINESS_INFO,
      LLCWorkflowStep.REGISTERED_AGENT,
      LLCWorkflowStep.BUSINESS_ADDRESS,
      LLCWorkflowStep.ORGANIZERS,
      LLCWorkflowStep.MANAGEMENT_STRUCTURE
    ];
    
    const missingSteps = requiredSteps.filter(step => !workflow.completedSteps.includes(step));
    
    if (missingSteps.length > 0) {
      throw new Error(`Missing required steps: ${missingSteps.join(', ')}`);
    }
  }
  
  /**
   * Prepare filing package
   */
  private static async prepareFilingPackage(workflow: BusinessFormationWorkflow): Promise<void> {
    // This would prepare the filing package for submission to Texas SOS
    // For now, we'll just log the preparation
    dbLogger.info('Filing package prepared', {
      workflowId: workflow.id,
      companyId: workflow.companyId,
      documents: workflow.generatedDocuments
    });
  }
  
  /**
   * Perform final LLC formation tasks
   */
  private static async performFinalLLCTasks(workflow: BusinessFormationWorkflow): Promise<void> {
    // Update company status to active
    if (workflow.companyId) {
      dbUtils.run(`
        UPDATE companies 
        SET status = 'active', formationDate = CURRENT_TIMESTAMP 
        WHERE id = ?
      `, [workflow.companyId]);
    }
    
    // Log completion
    dbLogger.info('LLC formation finalized', {
      workflowId: workflow.id,
      companyId: workflow.companyId
    });
  }
}


