/**
 * @file Validation Service
 * Comprehensive validation schemas and utilities for business formation
 */

import Joi from 'joi';
import { dbLogger } from '@utils/logger';
import {
  BusinessFormationPayload,
  LLCFormationPayload,
  Address,
  Person,
  RegisteredAgent,
  WorkflowStepUpdateRequest,
  DocumentGenerationRequest
} from '../types/businessTypes';

/**
 * Validation Service Class
 */
export class ValidationService {
  
  /**
   * Address validation schema
   */
  static readonly addressSchema = Joi.object<Address>({
    id: Joi.string().uuid().optional(),
    street: Joi.string().min(1).max(255).required()
      .messages({
        'string.empty': 'Street address is required',
        'string.max': 'Street address must be less than 255 characters'
      }),
    city: Joi.string().min(1).max(100).required()
      .messages({
        'string.empty': 'City is required',
        'string.max': 'City must be less than 100 characters'
      }),
    state: Joi.string().valid('TX').required()
      .messages({
        'any.only': 'Only Texas (TX) is supported at this time'
      }),
    zipCode: Joi.string().pattern(/^\d{5}(-\d{4})?$/).required()
      .messages({
        'string.pattern.base': 'ZIP code must be in format 12345 or 12345-6789'
      }),
    county: Joi.string().min(1).max(100).required()
      .messages({
        'string.empty': 'County is required',
        'string.max': 'County must be less than 100 characters'
      }),
    country: Joi.string().default('US').optional(),
    type: Joi.string().valid('residential', 'business', 'mailing').required()
      .messages({
        'any.only': 'Address type must be residential, business, or mailing'
      }),
    createdAt: Joi.string().isoDate().optional(),
    updatedAt: Joi.string().isoDate().optional()
  });
  
  /**
   * Person validation schema
   */
  static readonly personSchema = Joi.object<Person>({
    firstName: Joi.string().min(1).max(100).required()
      .messages({
        'string.empty': 'First name is required',
        'string.max': 'First name must be less than 100 characters'
      }),
    lastName: Joi.string().min(1).max(100).required()
      .messages({
        'string.empty': 'Last name is required',
        'string.max': 'Last name must be less than 100 characters'
      }),
    address: this.addressSchema.required(),
    email: Joi.string().email().optional()
      .messages({
        'string.email': 'Please provide a valid email address'
      }),
    phone: Joi.string().pattern(/^\+?[\d\s\-\(\)]+$/).optional()
      .messages({
        'string.pattern.base': 'Please provide a valid phone number'
      }),
    ssn: Joi.string().pattern(/^\d{3}-?\d{2}-?\d{4}$/).optional()
      .messages({
        'string.pattern.base': 'SSN must be in format 123-45-6789 or 123456789'
      }),
    dateOfBirth: Joi.string().isoDate().optional()
  });
  
  /**
   * Registered agent validation schema
   */
  static readonly registeredAgentSchema = Joi.object<RegisteredAgent>({
    id: Joi.string().uuid().optional(),
    companyId: Joi.string().uuid().optional(),
    name: Joi.string().min(1).max(255).required()
      .messages({
        'string.empty': 'Registered agent name is required',
        'string.max': 'Registered agent name must be less than 255 characters'
      }),
    address: this.addressSchema.required(),
    isIndividual: Joi.boolean().required()
      .messages({
        'any.required': 'Please specify if the registered agent is an individual'
      }),
    acceptanceDate: Joi.string().isoDate().optional(),
    createdAt: Joi.string().isoDate().optional(),
    updatedAt: Joi.string().isoDate().optional()
  });
  
  /**
   * Business formation payload validation schema
   */
  static readonly businessFormationSchema = Joi.object<BusinessFormationPayload>({
    businessName: Joi.string().min(1).max(255).required()
      .pattern(/^[a-zA-Z0-9\s\-\.\,\&\']+$/)
      .messages({
        'string.empty': 'Business name is required',
        'string.max': 'Business name must be less than 255 characters',
        'string.pattern.base': 'Business name contains invalid characters'
      }),
    businessType: Joi.string().valid('LLC', 'Corporation', 'Partnership').required()
      .messages({
        'any.only': 'Business type must be LLC, Corporation, or Partnership'
      }),
    owners: Joi.array().items(this.personSchema).min(1).max(50).required()
      .messages({
        'array.min': 'At least one owner is required',
        'array.max': 'Maximum 50 owners allowed'
      }),
    registeredAgent: this.registeredAgentSchema.required(),
    businessAddress: this.addressSchema.required(),
    mailingAddress: this.addressSchema.optional(),
    purpose: Joi.string().max(1000).optional()
      .messages({
        'string.max': 'Purpose must be less than 1000 characters'
      }),
    managementStructure: Joi.string().valid('member_managed', 'manager_managed').optional()
      .messages({
        'any.only': 'Management structure must be member_managed or manager_managed'
      }),
    duration: Joi.string().max(100).optional()
      .messages({
        'string.max': 'Duration must be less than 100 characters'
      })
  });
  
  /**
   * LLC formation specific validation schema
   */
  static readonly llcFormationSchema = Joi.object({
    businessName: Joi.string().min(1).max(255).required(),
    businessType: Joi.string().valid('LLC').required(),
    owners: Joi.array().items(this.personSchema).min(1).max(10).required(),
    registeredAgent: this.registeredAgentSchema.required(),
    businessAddress: this.addressSchema.required(),
    mailingAddress: this.addressSchema.optional(),
    organizers: Joi.array().items(this.personSchema).min(1).max(10).required()
      .messages({
        'array.min': 'At least one organizer is required',
        'array.max': 'Maximum 10 organizers allowed'
      }),
    initialMembers: Joi.array().items(this.personSchema).min(1).max(50).required()
      .messages({
        'array.min': 'At least one initial member is required',
        'array.max': 'Maximum 50 initial members allowed'
      }),
    operatingAgreement: Joi.boolean().optional(),
    managementStructure: Joi.string().valid('member_managed', 'manager_managed').required()
      .messages({
        'any.required': 'Management structure is required for LLCs',
        'any.only': 'Management structure must be member_managed or manager_managed'
      })
  });
  
  /**
   * Workflow step update validation schema
   */
  static readonly workflowStepUpdateSchema = Joi.object<WorkflowStepUpdateRequest>({
    workflowId: Joi.string().uuid().required()
      .messages({
        'string.guid': 'Invalid workflow ID format'
      }),
    stepId: Joi.string().min(1).max(100).required()
      .messages({
        'string.empty': 'Step ID is required'
      }),
    stepData: Joi.object().required()
      .messages({
        'any.required': 'Step data is required'
      }),
    markComplete: Joi.boolean().optional().default(false)
  });
  
  /**
   * Document generation validation schema
   */
  static readonly documentGenerationSchema = Joi.object<DocumentGenerationRequest>({
    workflowId: Joi.string().uuid().required()
      .messages({
        'string.guid': 'Invalid workflow ID format'
      }),
    documentType: Joi.string().valid('form_205', 'operating_agreement', 'ein_application').required()
      .messages({
        'any.only': 'Document type must be form_205, operating_agreement, or ein_application'
      }),
    templateData: Joi.object().required()
      .messages({
        'any.required': 'Template data is required'
      })
  });
  
  /**
   * Validate business formation payload
   */
  static validateBusinessFormation(payload: any): { isValid: boolean; errors?: string[]; data?: BusinessFormationPayload } {
    try {
      const { error, value } = this.businessFormationSchema.validate(payload, {
        abortEarly: false,
        stripUnknown: true
      });
      
      if (error) {
        const errors = error.details.map(detail => detail.message);
        dbLogger.warn('Business formation validation failed', { errors });
        return { isValid: false, errors };
      }
      
      return { isValid: true, data: value };
    } catch (err) {
      dbLogger.error('Business formation validation error:', {
        error: err instanceof Error ? err.message : 'Unknown error'
      });
      return { isValid: false, errors: ['Validation failed due to internal error'] };
    }
  }
  
  /**
   * Validate LLC formation payload
   */
  static validateLLCFormation(payload: any): { isValid: boolean; errors?: string[]; data?: LLCFormationPayload } {
    try {
      const { error, value } = this.llcFormationSchema.validate(payload, {
        abortEarly: false,
        stripUnknown: true
      });
      
      if (error) {
        const errors = error.details.map(detail => detail.message);
        dbLogger.warn('LLC formation validation failed', { errors });
        return { isValid: false, errors };
      }
      
      return { isValid: true, data: value };
    } catch (err) {
      dbLogger.error('LLC formation validation error:', {
        error: err instanceof Error ? err.message : 'Unknown error'
      });
      return { isValid: false, errors: ['Validation failed due to internal error'] };
    }
  }
  
  /**
   * Validate workflow step update
   */
  static validateWorkflowStepUpdate(payload: any): { isValid: boolean; errors?: string[]; data?: WorkflowStepUpdateRequest } {
    try {
      const { error, value } = this.workflowStepUpdateSchema.validate(payload, {
        abortEarly: false,
        stripUnknown: true
      });
      
      if (error) {
        const errors = error.details.map(detail => detail.message);
        return { isValid: false, errors };
      }
      
      return { isValid: true, data: value };
    } catch (err) {
      dbLogger.error('Workflow step update validation error:', {
        error: err instanceof Error ? err.message : 'Unknown error'
      });
      return { isValid: false, errors: ['Validation failed due to internal error'] };
    }
  }
  
  /**
   * Validate document generation request
   */
  static validateDocumentGeneration(payload: any): { isValid: boolean; errors?: string[]; data?: DocumentGenerationRequest } {
    try {
      const { error, value } = this.documentGenerationSchema.validate(payload, {
        abortEarly: false,
        stripUnknown: true
      });
      
      if (error) {
        const errors = error.details.map(detail => detail.message);
        return { isValid: false, errors };
      }
      
      return { isValid: true, data: value };
    } catch (err) {
      dbLogger.error('Document generation validation error:', {
        error: err instanceof Error ? err.message : 'Unknown error'
      });
      return { isValid: false, errors: ['Validation failed due to internal error'] };
    }
  }
}


