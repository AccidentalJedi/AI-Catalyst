// Core wizard types
export interface WizardStep {
  id: string;
  title: string;
  description: string;
  component: React.ComponentType<any>;
  isComplete: boolean;
  isOptional?: boolean;
  dependencies?: string[];
}

export interface WizardPhase {
  id: string;
  title: string;
  description: string;
  steps: WizardStep[];
  isComplete: boolean;
  estimatedTime: number; // in minutes
}

// User profile types
export interface UserProfile {
  personalInfo: PersonalInfo;
  contactInfo: PersonalInfo; // Alias for personalInfo to support legacy component access
  veteranStatus: VeteranStatus;
  businessVision: BusinessVision;
  preferences: UserPreferences;
  businessName?: BusinessName;
  legalStructure?: LegalStructure;
  registeredAgent?: RegisteredAgent;
  legalDocuments?: LegalDocuments;
}

export interface PersonalInfo {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address: Address;
}

export interface Address {
  street: string;
  city: string;
  state: string;
  zipCode: string;
  county: string;
}

export interface VeteranStatus {
  serviceStatus: string;
  branch: string;
  serviceStartDate: Date | undefined;
  serviceEndDate: Date | undefined;
  dischargeType: string;
  disabilityRating?: number | null;
  ratingType?: string;
  hasGiBill: boolean;
  giBillType?: string;
  giBillMonthsUsed?: number | null;
  hasVrAndE: boolean;
  veteranCertifications: string[];
  militaryOccupationalSpecialty?: string;
  securityClearance?: string;
  combatVeteran: boolean;
  deployments?: number | null;
}

export interface BusinessVision {
  businessName: string;
  missionStatement: string;
  visionStatement: string;
  coreValues: string[];
  targetAudience: string[];
  primaryGoals: string[];
  businessModel: string;
  revenueStreams: string[];
  socialImpactFocus: string;
  successMetrics: string[];
  timelineGoals: {
    sixMonths: string;
    oneYear: string;
    threeYears: string;
  };
  competitiveAdvantage: string;
  challengesAnticipated: string[];
  resourcesNeeded: string[];
  partnershipInterests: string[];
}

export interface RevenueModel {
  type: 'subscription' | 'donations' | 'products' | 'services' | 'grants';
  description: string;
  estimatedMonthlyRevenue: number;
}

export interface UserPreferences {
  interactionLevel: 'minimal' | 'moderate' | 'high';
  automationLevel: 'basic' | 'advanced' | 'maximum';
  privacyLevel: 'standard' | 'enhanced' | 'maximum';
  communicationPreferences: string[];
  workingHours: {
    timezone: string;
    preferredDays: string[];
    startTime: string;
    endTime: string;
  };
  notificationSettings: {
    email: boolean;
    sms: boolean;
    push: boolean;
    frequency: string;
  };
  documentPreferences: {
    format: string;
    delivery: string;
    retention: string;
  };
  supportPreferences: {
    preferredMethod: string;
    responseTime: string;
    complexity: string;
  };
  integrationPreferences: string[];
  accessibilityNeeds: string[];
  customizationLevel: number;
}

// Business name types
export interface BusinessName {
  primaryName: string;
  alternativeNames: string[];
  hasTrademarks: boolean;
  trademarkDetails?: string;
  businessPurpose?: string; // Added for legal document generation
  domainPreferences: string[];
  socialMediaHandles: {
    twitter?: string;
    facebook?: string;
    instagram?: string;
    linkedin?: string;
    youtube?: string;
    tiktok?: string;
  };
  nameAvailabilityChecked: boolean;
}

// Legal documents types
export interface LegalDocuments {
  documentsToGenerate: string[];
  operatingAgreementType?: string;
  customClauses: string[];
  signatureMethod: string;
  documentDelivery: string;
  reviewRequired: boolean;
  attorneyReview: boolean;
  expeditedProcessing: boolean;
}

// Business formation types
export interface BusinessFormation {
  legalStructure: LegalStructure;
  businessIdentity: BusinessIdentity;
  financialSetup: FinancialSetup;
  compliance: ComplianceRequirements;
}

export interface LegalStructure {
  entityType: string;
  taxElection: string;
  managementStructure: string;
  ownershipStructure: string;
  filingState: string;
}

export interface RegisteredAgent {
  agentType: string;
  agentName: string;
  agentAddress: Address;
  agentPhone: string;
  agentEmail: string;
  serviceProvider?: string;
  annualFee?: number;
  acceptsService: boolean;
  businessHours: {
    monday: boolean;
    tuesday: boolean;
    wednesday: boolean;
    thursday: boolean;
    friday: boolean;
    saturday: boolean;
    sunday: boolean;
  };
  specialInstructions?: string;
}

export interface OperatingAgreement {
  template: string;
  customizations: Record<string, any>;
  socialMissionClause: string;
  generatedDocument?: string;
}

export interface BusinessIdentity {
  legalName: string;
  dbaName?: string;
  domainName: string;
  logoUrl?: string;
  brandColors: string[];
  tagline: string;
}

export interface FinancialSetup {
  ein: string;
  bankAccount: BankAccount;
  accounting: AccountingSetup;
  taxes: TaxSetup;
}

export interface BankAccount {
  bankName: string;
  accountType: string;
  requiredDocuments: string[];
  isOpened: boolean;
}

export interface AccountingSetup {
  method: 'cash' | 'accrual';
  software: string;
  chartOfAccounts: string[];
  automatedTracking: boolean;
}

export interface TaxSetup {
  federalTaxId: string;
  stateTaxId?: string;
  quarterlyEstimates: QuarterlyEstimate[];
  deductions: TaxDeduction[];
  veteranExemptions: string[];
}

export interface QuarterlyEstimate {
  quarter: number;
  year: number;
  estimatedIncome: number;
  estimatedTax: number;
  dueDate: Date;
  isPaid: boolean;
}

export interface TaxDeduction {
  category: string;
  description: string;
  estimatedAnnualAmount: number;
  trackingMethod: string;
}

export interface ComplianceRequirements {
  federal: ComplianceItem[];
  state: ComplianceItem[];
  local: ComplianceItem[];
  industry: ComplianceItem[];
}

export interface ComplianceItem {
  requirement: string;
  description: string;
  deadline?: Date;
  isComplete: boolean;
  documents: string[];
  cost?: number;
}

// Digital platform types
export interface DigitalPlatform {
  website: WebsiteConfig;
  contentStrategy: ContentStrategy;
  automation: AutomationConfig;
  analytics: AnalyticsConfig;
}

export interface WebsiteConfig {
  template: string;
  domain: string;
  hosting: string;
  pages: WebPage[];
  legalPages: LegalPage[];
  seoConfig: SEOConfig;
}

export interface WebPage {
  slug: string;
  title: string;
  content: string;
  template: string;
  isPublished: boolean;
}

export interface LegalPage {
  type: 'terms' | 'privacy' | 'disclaimer';
  content: string;
  lastUpdated: Date;
  isRequired: boolean;
}

export interface SEOConfig {
  title: string;
  description: string;
  keywords: string[];
  socialMedia: SocialMediaConfig;
}

export interface SocialMediaConfig {
  platforms: string[];
  handles: Record<string, string>;
  automatedPosting: boolean;
  contentCalendar: ContentCalendarItem[];
}

export interface ContentStrategy {
  contentTypes: string[];
  publishingSchedule: PublishingSchedule;
  contentCalendar: ContentCalendarItem[];
  automationRules: AutomationRule[];
}

export interface PublishingSchedule {
  frequency: 'daily' | 'weekly' | 'biweekly' | 'monthly';
  platforms: string[];
  optimalTimes: Record<string, string>;
}

export interface ContentCalendarItem {
  date: Date;
  platform: string;
  contentType: string;
  title: string;
  description: string;
  isScheduled: boolean;
}

export interface AutomationRule {
  trigger: string;
  action: string;
  conditions: Record<string, any>;
  isActive: boolean;
}

export interface AutomationConfig {
  emailSequences: EmailSequence[];
  socialMediaAutomation: boolean;
  supportTicketing: TicketingConfig;
  analyticsTracking: boolean;
}

export interface EmailSequence {
  name: string;
  trigger: string;
  emails: EmailTemplate[];
  isActive: boolean;
}

export interface EmailTemplate {
  subject: string;
  content: string;
  delayDays: number;
  isActive: boolean;
}

export interface TicketingConfig {
  platform: string;
  automatedResponses: boolean;
  categories: string[];
  escalationRules: EscalationRule[];
}

export interface EscalationRule {
  condition: string;
  action: string;
  timeLimit: number;
}

export interface AnalyticsConfig {
  platforms: string[];
  kpis: KPI[];
  reportingSchedule: string;
  automatedReports: boolean;
}

export interface KPI {
  name: string;
  description: string;
  target: number;
  currentValue: number;
  trackingMethod: string;
}

// Grant and funding types
export interface GrantOpportunity {
  id: string;
  title: string;
  organization: string;
  description: string;
  eligibilityRequirements: string[];
  fundingAmount: FundingAmount;
  deadline: Date;
  applicationRequirements: string[];
  matchScore: number;
  status: 'discovered' | 'researching' | 'applying' | 'submitted' | 'awarded' | 'rejected';
}

export interface FundingAmount {
  min: number;
  max: number;
  typical: number;
  currency: string;
}

// Document generation types
export interface DocumentTemplate {
  id: string;
  name: string;
  type: 'legal' | 'business' | 'marketing' | 'compliance';
  template: string;
  variables: TemplateVariable[];
  requiredData: string[];
}

export interface TemplateVariable {
  name: string;
  type: 'string' | 'number' | 'date' | 'boolean' | 'array';
  description: string;
  required: boolean;
  defaultValue?: any;
}

export interface GeneratedDocument {
  id: string;
  templateId: string;
  name: string;
  content: string;
  format: 'html' | 'pdf' | 'docx';
  generatedAt: Date;
  variables: Record<string, any>;
}

// Progress tracking types
export interface Progress {
  currentPhase: string;
  currentStep: string;
  completedSteps: string[];
  overallProgress: number;
  estimatedTimeRemaining: number;
  lastUpdated: Date;
}

export interface ActionItem {
  id: string;
  title: string;
  description: string;
  category: 'legal' | 'financial' | 'digital' | 'compliance' | 'marketing';
  priority: 'low' | 'medium' | 'high' | 'critical';
  deadline?: Date;
  isComplete: boolean;
  automatable: boolean;
  estimatedTime: number;
  dependencies: string[];
  instructions: string;
}

// API response types
export interface APIResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ValidationError {
  field: string;
  message: string;
  code: string;
}

export interface ValidationWarning {
  field: string;
  message: string;
  suggestion?: string;
}
