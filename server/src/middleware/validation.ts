import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import { ValidationResult, ValidationError } from '../types/index';
import logger from '@utils/logger';

// Generic validation middleware factory
export const validateRequest = (schema: {
  body?: Joi.ObjectSchema;
  query?: Joi.ObjectSchema;
  params?: Joi.ObjectSchema;
}) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const errors: ValidationError[] = [];

    // Validate request body
    if (schema.body && req.body) {
      const { error } = schema.body.validate(req.body, { abortEarly: false });
      if (error) {
        errors.push(...error.details.map(detail => ({
          field: detail.path.join('.'),
          message: detail.message,
          value: detail.context?.value
        })));
      }
    }

    // Validate query parameters
    if (schema.query && req.query) {
      const { error } = schema.query.validate(req.query, { abortEarly: false });
      if (error) {
        errors.push(...error.details.map(detail => ({
          field: `query.${detail.path.join('.')}`,
          message: detail.message,
          value: detail.context?.value
        })));
      }
    }

    // Validate route parameters
    if (schema.params && req.params) {
      const { error } = schema.params.validate(req.params, { abortEarly: false });
      if (error) {
        errors.push(...error.details.map(detail => ({
          field: `params.${detail.path.join('.')}`,
          message: detail.message,
          value: detail.context?.value
        })));
      }
    }

    if (errors.length > 0) {
      logger.warn('Validation failed', {
        errors,
        url: req.url,
        method: req.method,
        requestId: req.headers['x-request-id']
      });

      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors,
        requestId: req.headers['x-request-id']
      });
    }

    next();
  };
};

// Common validation schemas
export const commonSchemas = {
  // UUID validation
  uuid: Joi.string().uuid().required(),
  
  // Email validation
  email: Joi.string().email().required(),
  
  // Phone validation (US format)
  phone: Joi.string().pattern(/^\+?1?[-.\s]?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}$/).required(),
  
  // Password validation
  password: Joi.string().min(8).pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/).required()
    .messages({
      'string.pattern.base': 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'
    }),
  
  // Date validation
  date: Joi.date().iso().required(),
  
  // Pagination
  pagination: {
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20)
  }
};

// User validation schemas
export const userSchemas = {
  register: Joi.object({
    firstName: Joi.string().min(1).max(50).required(),
    lastName: Joi.string().min(1).max(50).required(),
    email: commonSchemas.email,
    phone: commonSchemas.phone,
    password: commonSchemas.password
  }),
  
  login: Joi.object({
    email: commonSchemas.email,
    password: Joi.string().required()
  }),
  
  updateProfile: Joi.object({
    firstName: Joi.string().min(1).max(50),
    lastName: Joi.string().min(1).max(50),
    phone: commonSchemas.phone
  }).min(1)
};

// Address validation schema
export const addressSchema = Joi.object({
  street: Joi.string().min(1).max(200).required(),
  city: Joi.string().min(1).max(100).required(),
  state: Joi.string().length(2).uppercase().required(),
  zipCode: Joi.string().pattern(/^\d{5}(-\d{4})?$/).required(),
  county: Joi.string().min(1).max(100).required(),
  country: Joi.string().length(2).uppercase().default('US')
});

// FinCEN BOI validation schemas (2025 Critical)
export const boiSchemas = {
  beneficialOwner: Joi.object({
    firstName: Joi.string().min(1).max(50).required(),
    lastName: Joi.string().min(1).max(50).required(),
    dateOfBirth: commonSchemas.date,
    address: addressSchema.required(),
    identificationDocument: Joi.object({
      type: Joi.string().valid('passport', 'drivers_license', 'state_id').required(),
      number: Joi.string().min(1).max(50).required(),
      issuingState: Joi.string().length(2).uppercase().when('type', {
        is: Joi.string().valid('drivers_license', 'state_id'),
        then: Joi.required(),
        otherwise: Joi.optional()
      }),
      issuingCountry: Joi.string().length(2).uppercase().required(),
      expirationDate: Joi.date().iso().greater('now').optional()
    }).required(),
    ownershipPercentage: Joi.number().min(0).max(100).when('controlType', {
      is: Joi.string().valid('ownership', 'both'),
      then: Joi.required(),
      otherwise: Joi.optional()
    }),
    controlType: Joi.string().valid('ownership', 'control', 'both').required(),
    isExempt: Joi.boolean().default(false)
  }),
  
  complianceStatus: Joi.object({
    filingStatus: Joi.string().valid('not_started', 'in_progress', 'submitted', 'approved', 'rejected').required(),
    exemptionClaimed: Joi.string().valid(
      'large_operating_company',
      'subsidiary',
      'inactive_entity',
      'public_company',
      'governmental_authority',
      'bank',
      'credit_union',
      'depository_institution_holding_company',
      'money_services_business',
      'broker_dealer',
      'securities_exchange_act_company',
      'investment_company',
      'investment_adviser',
      'venture_capital_fund_adviser',
      'insurance_company',
      'state_licensed_insurance_producer',
      'commodity_exchange_act_entity',
      'accounting_firm',
      'public_utility',
      'financial_market_utility',
      'pooled_investment_vehicle',
      'tax_exempt_entity'
    ).optional(),
    exemptionReason: Joi.string().max(500).when('exemptionClaimed', {
      is: Joi.exist(),
      then: Joi.required(),
      otherwise: Joi.optional()
    })
  })
};

// Company/LLC validation schemas
export const companySchemas = {
  create: Joi.object({
    legalName: Joi.string().min(1).max(200).required(),
    dbaName: Joi.string().min(1).max(200).optional(),
    businessType: Joi.string().valid('LLC', 'Corporation', 'Partnership').required(),
    formationState: Joi.string().length(2).uppercase().required(),
    businessAddress: addressSchema.required(),
    mailingAddress: addressSchema.optional(),
    registeredAgent: Joi.object({
      name: Joi.string().min(1).max(200).required(),
      address: addressSchema.required(),
      isIndividual: Joi.boolean().required()
    }).required()
  }),
  
  update: Joi.object({
    legalName: Joi.string().min(1).max(200),
    dbaName: Joi.string().min(1).max(200).allow(null),
    businessAddress: addressSchema,
    mailingAddress: addressSchema.allow(null),
    status: Joi.string().valid('forming', 'active', 'inactive', 'dissolved')
  }).min(1)
};

// Document validation schemas
export const documentSchemas = {
  generate: Joi.object({
    templateId: commonSchemas.uuid,
    variables: Joi.object().required(),
    name: Joi.string().min(1).max(200).required()
  }),
  
  upload: Joi.object({
    name: Joi.string().min(1).max(200).required(),
    type: Joi.string().valid('legal', 'business', 'marketing', 'compliance').required()
  })
};

// Wizard progress validation schemas
export const wizardSchemas = {
  updateProgress: Joi.object({
    currentPhase: Joi.string().min(1).max(100).required(),
    currentStep: Joi.string().min(1).max(100).required(),
    completedSteps: Joi.array().items(Joi.string()).required(),
    overallProgress: Joi.number().min(0).max(100).required()
  })
};

// File upload validation
export const fileUploadSchema = Joi.object({
  fieldname: Joi.string().required(),
  originalname: Joi.string().required(),
  encoding: Joi.string().required(),
  mimetype: Joi.string().valid(
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/gif',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ).required(),
  size: Joi.number().max(10485760).required() // 10MB max
});

// Export validation middleware for common use cases
export const validateUser = {
  register: validateRequest({ body: userSchemas.register }),
  login: validateRequest({ body: userSchemas.login }),
  updateProfile: validateRequest({ body: userSchemas.updateProfile })
};

export const validateCompany = {
  create: validateRequest({ body: companySchemas.create }),
  update: validateRequest({ body: companySchemas.update })
};

export const validateBOI = {
  beneficialOwner: validateRequest({ body: boiSchemas.beneficialOwner }),
  complianceStatus: validateRequest({ body: boiSchemas.complianceStatus })
};

export const validateDocument = {
  generate: validateRequest({ body: documentSchemas.generate }),
  upload: validateRequest({ body: documentSchemas.upload })
};

export const validateWizard = {
  updateProgress: validateRequest({ body: wizardSchemas.updateProgress })
};



