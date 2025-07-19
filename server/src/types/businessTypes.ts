/**
 * @file Defines the core data structures for the Business Formation subsystem.
 * These types establish the API contract for creating a new business entity.
 */

// Base address interface
export interface Address {
  id?: string;
  street: string;
  city: string;
  state: 'TX'; // Restricted to Texas for this system
  zipCode: string;
  county: string;
  country?: string;
  type: 'residential' | 'business' | 'mailing';
  createdAt?: string;
  updatedAt?: string;
}

// Person interface for business owners and contacts
export interface Person {
  firstName: string;
  lastName: string;
  address: Address;
  email?: string;
  phone?: string;
  ssn?: string; // Encrypted in database
  dateOfBirth?: string;
}

// Registered agent interface
export interface RegisteredAgent {
  id?: string;
  companyId?: string;
  name: string;
  address: Address;
  isIndividual: boolean;
  acceptanceDate?: string;
  createdAt?: string;
  updatedAt?: string;
}

// Business entity types
export type BusinessType = 'LLC' | 'Corporation' | 'Partnership';
export type BusinessStatus = 'forming' | 'active' | 'inactive' | 'dissolved';

// Company/LLC entity interface
export interface Company {
  id?: string;
  userId: string;
  legalName: string;
  dbaName?: string;
  ein?: string;
  formationState: string;
  formationDate?: string;
  businessType: BusinessType;
  businessAddressId: string;
  mailingAddressId?: string;
  status: BusinessStatus;
  sosFileNumber?: string;
  createdAt?: string;
  updatedAt?: string;
}

// Business formation workflow types
export type WorkflowType = 'llc_formation' | 'corporation_formation' | 'partnership_formation';
export type WorkflowStatus = 'not_started' | 'in_progress' | 'completed' | 'failed' | 'cancelled';

// Business formation step data
export interface BusinessFormationStepData {
  stepId: string;
  stepName: string;
  data: Record<string, any>;
  completedAt?: string;
  errors?: string[];
}

// Business formation workflow interface
export interface BusinessFormationWorkflow {
  id?: string;
  userId: string;
  companyId?: string;
  workflowType: WorkflowType;
  currentStep: string;
  stepData?: Record<string, any>;
  completedSteps: string[];
  status: WorkflowStatus;
  formData?: Record<string, any>;
  generatedDocuments?: string[];
  submissionData?: Record<string, any>;
  errorLog?: string[];
  estimatedCompletion?: string;
  actualCompletion?: string;
  createdAt?: string;
  updatedAt?: string;
}

// API Request/Response Types

// Business formation request payload
export interface BusinessFormationPayload {
  businessName: string;
  businessType: BusinessType;
  owners: Person[];
  registeredAgent: RegisteredAgent;
  businessAddress: Address;
  mailingAddress?: Address;
  purpose?: string;
  managementStructure?: 'member_managed' | 'manager_managed';
  duration?: string;
}

// LLC formation specific payload
export interface LLCFormationPayload extends BusinessFormationPayload {
  businessType: 'LLC';
  organizers: Person[];
  initialMembers: Person[];
  operatingAgreement?: boolean;
}

// Business formation response
export interface BusinessFormationResponse {
  success: boolean;
  data?: {
    workflowId: string;
    companyId?: string;
    currentStep: string;
    nextSteps: string[];
    estimatedCompletion?: string;
  };
  error?: string;
  validationErrors?: Record<string, string[]>;
}

// Business entity response
export interface BusinessEntityResponse {
  success: boolean;
  data?: Company & {
    businessAddress?: Address;
    mailingAddress?: Address;
    registeredAgent?: RegisteredAgent;
    workflow?: BusinessFormationWorkflow;
  };
  error?: string;
}

// Business list response
export interface BusinessListResponse {
  success: boolean;
  data?: {
    businesses: (Company & {
      businessAddress?: Address;
      registeredAgent?: RegisteredAgent;
      workflow?: BusinessFormationWorkflow;
    })[];
    total: number;
    page: number;
    limit: number;
  };
  error?: string;
}

// Document generation request
export interface DocumentGenerationRequest {
  workflowId: string;
  documentType: 'form_205' | 'operating_agreement' | 'ein_application';
  templateData: Record<string, any>;
}

// Document generation response
export interface DocumentGenerationResponse {
  success: boolean;
  data?: {
    documentId: string;
    documentPath: string;
    documentUrl: string;
    generatedAt: string;
  };
  error?: string;
}

// Workflow step update request
export interface WorkflowStepUpdateRequest {
  workflowId: string;
  stepId: string;
  stepData: Record<string, any>;
  markComplete?: boolean;
}

// Workflow step update response
export interface WorkflowStepUpdateResponse {
  success: boolean;
  data?: {
    currentStep: string;
    nextStep?: string;
    progress: number;
    completedSteps: string[];
  };
  error?: string;
}

// Validation Types

// Address validation schema
export interface AddressValidation {
  street: { required: true; minLength: 1; maxLength: 255 };
  city: { required: true; minLength: 1; maxLength: 100 };
  state: { required: true; enum: ['TX'] };
  zipCode: { required: true; pattern: string }; // /^\d{5}(-\d{4})?$/
  county: { required: true; minLength: 1; maxLength: 100 };
  type: { required: true; enum: ['residential', 'business', 'mailing'] };
}

// Person validation schema
export interface PersonValidation {
  firstName: { required: true; minLength: 1; maxLength: 100 };
  lastName: { required: true; minLength: 1; maxLength: 100 };
  email: { required: false; pattern: string }; // /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  phone: { required: false; pattern: string }; // /^\+?[\d\s\-\(\)]+$/
}

// Business formation validation schema
export interface BusinessFormationValidation {
  businessName: { required: true; minLength: 1; maxLength: 255 };
  businessType: { required: true; enum: ['LLC', 'Corporation', 'Partnership'] };
  owners: { required: true; minItems: 1; maxItems: 50 };
  registeredAgent: { required: true };
  businessAddress: { required: true };
}

// Utility Types

// Create request type (omit auto-generated fields)
export type CreateBusinessRequest = Omit<Company, 'id' | 'createdAt' | 'updatedAt'>;
export type CreateAddressRequest = Omit<Address, 'id' | 'createdAt' | 'updatedAt'>;
export type CreateRegisteredAgentRequest = Omit<RegisteredAgent, 'id' | 'createdAt' | 'updatedAt'>;

// Update request type (make all fields optional except id)
export type UpdateBusinessRequest = Partial<Omit<Company, 'id' | 'userId' | 'createdAt'>> & { id: string };
export type UpdateAddressRequest = Partial<Omit<Address, 'id' | 'createdAt'>> & { id: string };
export type UpdateRegisteredAgentRequest = Partial<Omit<RegisteredAgent, 'id' | 'createdAt'>> & { id: string };

// Database entity types (with required auto-generated fields)
export type CompanyEntity = Required<Company>;
export type AddressEntity = Required<Address>;
export type RegisteredAgentEntity = Required<RegisteredAgent>;
export type BusinessFormationWorkflowEntity = Required<BusinessFormationWorkflow>;

// Texas-specific types
export interface TexasLLCRequirements {
  minimumMembers: 1;
  maximumMembers?: number; // No limit in Texas
  registeredAgentRequired: true;
  registeredOfficeRequired: true;
  operatingAgreementRequired: false; // Recommended but not required
  publicationRequired: false;
  minimumCapital: 0;
}

// Form 205 specific data structure
export interface Form205Data {
  entityName: string;
  entityType: 'Limited Liability Company';
  registeredAgentName: string;
  registeredOfficeAddress: Address;
  organizers: Person[];
  managementStructure: 'member_managed' | 'manager_managed';
  purpose: string;
  duration: string;
  effectiveDate?: string;
  delayedEffectiveDate?: string;
}

// Types are already exported above as individual exports

