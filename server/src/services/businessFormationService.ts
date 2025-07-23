/**
 * @file Business Formation Service
 * Core business logic for LLC and corporation formation workflows
 */

import crypto from 'crypto';
import { dbUtils } from '@utils/databaseAdapter';
import { dbLogger } from '@utils/logger';
import { encryptSensitiveFields, decryptSensitiveFields } from '@utils/encryption';
import { 
  BusinessFormationPayload,
  LLCFormationPayload,
  BusinessFormationWorkflow,
  Company,
  Address,
  RegisteredAgent,
  WorkflowType,
  WorkflowStatus,
  BusinessFormationResponse,
  BusinessEntityResponse,
  BusinessListResponse
} from '../types/businessTypes';

/**
 * Business Formation Service Class
 */
export class BusinessFormationService {
  
  /**
   * Start a new business formation workflow
   */
  static async startFormation(
    userId: string,
    payload: BusinessFormationPayload
  ): Promise<BusinessFormationResponse> {
    try {
      const workflowId = crypto.randomUUID();
      const workflowType: WorkflowType = `${payload.businessType.toLowerCase()}_formation` as WorkflowType;
      
      return await dbUtils.transaction(async (db) => {
        // Create addresses first
        const businessAddressId = await this.createAddress(payload.businessAddress);
        const mailingAddressId = payload.mailingAddress 
          ? await this.createAddress(payload.mailingAddress)
          : null;
        
        // Create registered agent
        const registeredAgentId = await this.createRegisteredAgent(payload.registeredAgent);
        
        // Create company record
        const companyId = await this.createCompany({
          userId,
          legalName: payload.businessName,
          businessType: payload.businessType,
          formationState: 'TX',
          businessAddressId,
          mailingAddressId,
          status: 'forming'
        }, registeredAgentId);
        
        // Create workflow
        const workflow = await this.createWorkflow({
          id: workflowId,
          userId,
          companyId,
          workflowType,
          currentStep: 'business_info',
          completedSteps: [],
          status: 'in_progress',
          formData: payload,
          generatedDocuments: [],
          errorLog: []
        });
        
        dbLogger.info('Business formation workflow started', {
          userId,
          workflowId,
          companyId,
          businessType: payload.businessType
        });
        
        return {
          success: true,
          data: {
            workflowId,
            companyId,
            currentStep: workflow.currentStep,
            nextSteps: this.getNextSteps(workflow.currentStep, workflowType),
            estimatedCompletion: this.calculateEstimatedCompletion(workflowType)
          }
        };
      });
    } catch (error) {
      dbLogger.error('Failed to start business formation:', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      
      return {
        success: false,
        error: 'Failed to start business formation workflow'
      };
    }
  }
  
  /**
   * Get business formation workflow by ID
   */
  static async getWorkflow(workflowId: string, userId: string): Promise<BusinessFormationWorkflow | null> {
    try {
      const result = await dbUtils.get(`
        SELECT * FROM business_formation_workflows
        WHERE id = $1 AND "userId" = $2
      `, [workflowId, userId]);
      
      if (!result) {
        return null;
      }
      
      return this.mapWorkflowFromDb(result as any);
    } catch (error) {
      dbLogger.error('Failed to get workflow:', {
        workflowId,
        userId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return null;
    }
  }
  
  /**
   * Update workflow step
   */
  static async updateWorkflowStep(
    workflowId: string,
    userId: string,
    stepId: string,
    stepData: Record<string, any>,
    markComplete: boolean = false
  ): Promise<boolean> {
    try {
      return await dbUtils.transaction(async (db) => {
        const workflow = await this.getWorkflow(workflowId, userId);
        if (!workflow) {
          throw new Error('Workflow not found');
        }
        
        // Update step data
        const updatedStepData = { ...workflow.stepData, [stepId]: stepData };
        
        // Update completed steps if marking complete
        let completedSteps = [...workflow.completedSteps];
        if (markComplete && !completedSteps.includes(stepId)) {
          completedSteps.push(stepId);
        }
        
        // Determine next step
        const nextStep = markComplete 
          ? this.getNextStep(stepId, workflow.workflowType)
          : workflow.currentStep;
        
        // Update workflow
        (db as any).run(`
          UPDATE business_formation_workflows 
          SET currentStep = ?, stepData = ?, completedSteps = ?, updatedAt = CURRENT_TIMESTAMP
          WHERE id = ? AND userId = ?
        `, [
          nextStep,
          JSON.stringify(updatedStepData),
          JSON.stringify(completedSteps),
          workflowId,
          userId
        ]);
        
        dbLogger.info('Workflow step updated', {
          workflowId,
          stepId,
          markComplete,
          nextStep
        });
        
        return true;
      });
    } catch (error) {
      dbLogger.error('Failed to update workflow step:', {
        workflowId,
        stepId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return false;
    }
  }
  
  /**
   * Get user's businesses
   */
  static async getUserBusinesses(userId: string): Promise<BusinessListResponse> {
    try {
      const results = dbUtils.all(`
        SELECT 
          c.*,
          ba.street as business_street,
          ba.city as business_city,
          ba.state as business_state,
          ba.zipCode as business_zip,
          ba.county as business_county,
          ra.name as agent_name,
          w.status as workflow_status,
          w.currentStep as workflow_step
        FROM companies c
        LEFT JOIN addresses ba ON c.businessAddressId = ba.id
        LEFT JOIN registered_agents ra ON ra.companyId = c.id
        LEFT JOIN business_formation_workflows w ON w.companyId = c.id
        WHERE c.userId = ?
        ORDER BY c.createdAt DESC
      `, [userId]);
      
      const businesses = results.map((row: any) => ({
        id: row.id,
        userId: row.userId,
        legalName: row.legalName,
        dbaName: row.dbaName,
        ein: row.ein,
        formationState: row.formationState,
        formationDate: row.formationDate,
        businessType: row.businessType,
        businessAddressId: row.businessAddressId,
        mailingAddressId: row.mailingAddressId,
        status: row.status,
        sosFileNumber: row.sosFileNumber,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        businessAddress: row.business_street ? {
          street: row.business_street,
          city: row.business_city,
          state: row.business_state,
          zipCode: row.business_zip,
          county: row.business_county,
          type: 'business' as const
        } : undefined,
        registeredAgent: row.agent_name ? {
          name: row.agent_name,
          address: {
            street: '',
            city: '',
            state: 'TX' as const,
            zipCode: '',
            county: '',
            type: 'business' as const
          },
          isIndividual: true
        } : undefined,
        workflow: row.workflow_status ? {
          userId: row.userId,
          workflowType: 'llc_formation' as const,
          currentStep: row.workflow_step || 'business_info',
          completedSteps: [],
          status: row.workflow_status
        } : undefined
      }));
      
      return {
        success: true,
        data: {
          businesses,
          total: businesses.length,
          page: 1,
          limit: 100
        }
      };
    } catch (error) {
      dbLogger.error('Failed to get user businesses:', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      
      return {
        success: false,
        error: 'Failed to retrieve businesses'
      };
    }
  }
  
  /**
   * Create address record
   */
  private static async createAddress(address: Address): Promise<string> {
    const addressId = crypto.randomUUID();
    
    dbUtils.run(`
      INSERT INTO addresses (id, street, city, state, zipCode, county, country, type)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      addressId,
      address.street,
      address.city,
      address.state,
      address.zipCode,
      address.county,
      address.country || 'US',
      address.type
    ]);
    
    return addressId;
  }
  
  /**
   * Create registered agent record
   */
  private static async createRegisteredAgent(agent: RegisteredAgent): Promise<string> {
    const agentId = crypto.randomUUID();
    const addressId = await this.createAddress(agent.address);
    
    dbUtils.run(`
      INSERT INTO registered_agents (id, name, addressId, isIndividual, acceptanceDate)
      VALUES (?, ?, ?, ?, ?)
    `, [
      agentId,
      agent.name,
      addressId,
      agent.isIndividual,
      agent.acceptanceDate || null
    ]);
    
    return agentId;
  }
  
  /**
   * Create company record
   */
  private static async createCompany(
    company: Partial<Company>,
    registeredAgentId: string
  ): Promise<string> {
    const companyId = crypto.randomUUID();
    
    dbUtils.run(`
      INSERT INTO companies (
        id, userId, legalName, dbaName, ein, formationState, formationDate,
        businessType, businessAddressId, mailingAddressId, status, sosFileNumber
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      companyId,
      company.userId,
      company.legalName,
      company.dbaName || null,
      company.ein || null,
      company.formationState,
      company.formationDate || null,
      company.businessType,
      company.businessAddressId,
      company.mailingAddressId || null,
      company.status,
      company.sosFileNumber || null
    ]);
    
    // Link registered agent to company
    dbUtils.run(`
      UPDATE registered_agents SET companyId = ? WHERE id = ?
    `, [companyId, registeredAgentId]);
    
    return companyId;
  }

  /**
   * Create workflow record
   */
  private static async createWorkflow(workflow: BusinessFormationWorkflow): Promise<BusinessFormationWorkflow> {
    dbUtils.run(`
      INSERT INTO business_formation_workflows (
        id, userId, companyId, workflowType, currentStep, stepData,
        completedSteps, status, formData, generatedDocuments,
        submissionData, errorLog, estimatedCompletion
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      workflow.id,
      workflow.userId,
      workflow.companyId,
      workflow.workflowType,
      workflow.currentStep,
      JSON.stringify(workflow.stepData || {}),
      JSON.stringify(workflow.completedSteps),
      workflow.status,
      JSON.stringify(workflow.formData || {}),
      JSON.stringify(workflow.generatedDocuments || []),
      JSON.stringify(workflow.submissionData || {}),
      JSON.stringify(workflow.errorLog || []),
      workflow.estimatedCompletion
    ]);

    return workflow;
  }

  /**
   * Map workflow from database result
   */
  private static mapWorkflowFromDb(row: any): BusinessFormationWorkflow {
    return {
      id: row.id,
      userId: row.userId,
      companyId: row.companyId,
      workflowType: row.workflowType,
      currentStep: row.currentStep,
      stepData: row.stepData ? JSON.parse(row.stepData) : {},
      completedSteps: row.completedSteps ? JSON.parse(row.completedSteps) : [],
      status: row.status,
      formData: row.formData ? JSON.parse(row.formData) : {},
      generatedDocuments: row.generatedDocuments ? JSON.parse(row.generatedDocuments) : [],
      submissionData: row.submissionData ? JSON.parse(row.submissionData) : {},
      errorLog: row.errorLog ? JSON.parse(row.errorLog) : [],
      estimatedCompletion: row.estimatedCompletion,
      actualCompletion: row.actualCompletion,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt
    };
  }

  /**
   * Get next steps for current step
   */
  private static getNextSteps(currentStep: string, workflowType: WorkflowType): string[] {
    const stepMap: Record<WorkflowType, Record<string, string[]>> = {
      llc_formation: {
        business_info: ['registered_agent', 'business_address'],
        registered_agent: ['business_address', 'organizers'],
        business_address: ['organizers', 'management_structure'],
        organizers: ['management_structure', 'operating_agreement'],
        management_structure: ['operating_agreement', 'document_generation'],
        operating_agreement: ['document_generation', 'review_submit'],
        document_generation: ['review_submit', 'filing'],
        review_submit: ['filing', 'completion'],
        filing: ['completion'],
        completion: []
      },
      corporation_formation: {
        business_info: ['registered_agent', 'business_address'],
        registered_agent: ['business_address', 'incorporators'],
        business_address: ['incorporators', 'directors'],
        incorporators: ['directors', 'bylaws'],
        directors: ['bylaws', 'document_generation'],
        bylaws: ['document_generation', 'review_submit'],
        document_generation: ['review_submit', 'filing'],
        review_submit: ['filing', 'completion'],
        filing: ['completion'],
        completion: []
      },
      partnership_formation: {
        business_info: ['registered_agent', 'business_address'],
        registered_agent: ['business_address', 'partners'],
        business_address: ['partners', 'partnership_agreement'],
        partners: ['partnership_agreement', 'document_generation'],
        partnership_agreement: ['document_generation', 'review_submit'],
        document_generation: ['review_submit', 'filing'],
        review_submit: ['filing', 'completion'],
        filing: ['completion'],
        completion: []
      }
    };

    return stepMap[workflowType]?.[currentStep] || [];
  }

  /**
   * Get next step in workflow
   */
  private static getNextStep(currentStep: string, workflowType: WorkflowType): string {
    const nextSteps = this.getNextSteps(currentStep, workflowType);
    return nextSteps[0] || currentStep;
  }

  /**
   * Calculate estimated completion date
   */
  private static calculateEstimatedCompletion(workflowType: WorkflowType): string {
    const daysToAdd = workflowType === 'llc_formation' ? 7 : 14; // LLCs faster than corporations
    const estimatedDate = new Date();
    estimatedDate.setDate(estimatedDate.getDate() + daysToAdd);
    return estimatedDate.toISOString().split('T')[0];
  }

  /**
   * Complete workflow
   */
  static async completeWorkflow(workflowId: string, userId: string): Promise<boolean> {
    try {
      return await transaction(async (db) => {
        // Update workflow status
        (db as any).run(`
          UPDATE business_formation_workflows
          SET status = 'completed', actualCompletion = CURRENT_TIMESTAMP, updatedAt = CURRENT_TIMESTAMP
          WHERE id = ? AND userId = ?
        `, [workflowId, userId]);

        // Update company status
        (db as any).run(`
          UPDATE companies
          SET status = 'active', updatedAt = CURRENT_TIMESTAMP
          WHERE id = (
            SELECT companyId FROM business_formation_workflows
            WHERE id = ? AND userId = ?
          )
        `, [workflowId, userId]);

        dbLogger.info('Workflow completed successfully', {
          workflowId,
          userId
        });

        return true;
      });
    } catch (error) {
      dbLogger.error('Failed to complete workflow:', {
        workflowId,
        userId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return false;
    }
  }

  /**
   * Cancel workflow
   */
  static async cancelWorkflow(workflowId: string, userId: string, reason?: string): Promise<boolean> {
    try {
      return await transaction(async (db) => {
        const workflow = await this.getWorkflow(workflowId, userId);
        if (!workflow) {
          throw new Error('Workflow not found');
        }

        // Add cancellation to error log
        const errorLog = [...(workflow.errorLog || [])];
        if (reason) {
          errorLog.push(`Workflow cancelled: ${reason}`);
        }

        // Update workflow status
        (db as any).run(`
          UPDATE business_formation_workflows
          SET status = 'cancelled', errorLog = ?, updatedAt = CURRENT_TIMESTAMP
          WHERE id = ? AND userId = ?
        `, [JSON.stringify(errorLog), workflowId, userId]);

        dbLogger.info('Workflow cancelled', {
          workflowId,
          userId,
          reason
        });

        return true;
      });
    } catch (error) {
      dbLogger.error('Failed to cancel workflow:', {
        workflowId,
        userId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return false;
    }
  }
}



