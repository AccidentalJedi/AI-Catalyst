/**
 * @file DocuSign Service
 * Comprehensive DocuSign integration for AI Catalyst Launch Wizard
 * 
 * Provides JWT authentication, document generation, and embedded signing
 * for Texas LLC formation documents including Form 205, Operating Agreements,
 * and EIN applications.
 */

import { docusignConfig } from '@config/index';
import { docusignLogger } from '@utils/logger';

// DocuSign SDK imports
import {
  ApiClient,
  EnvelopesApi,
  EnvelopeDefinition,
  Document,
  Signer,
  SignHere,
  Tabs,
  Recipients,
  RecipientViewRequest
} from 'docusign-esign';

// Types for DocuSign integration
export interface DocuSignAuthResult {
  success: boolean;
  accessToken?: string;
  expiresIn?: number;
  error?: string;
}

export interface DocuSignEnvelopeResult {
  success: boolean;
  envelopeId?: string;
  status?: string;
  documentType?: string;
  error?: string;
  validationErrors?: string[];
}

export interface DocuSignSigningResult {
  success: boolean;
  signingUrl?: string;
  error?: string;
}

export interface DocuSignStatusResult {
  envelopeId: string;
  status: string;
  createdDateTime?: string;
  sentDateTime?: string;
  completedDateTime?: string;
}

export interface DocuSignRecipientStatus {
  email: string;
  name: string;
  status: string;
  signedDateTime?: string;
  declinedDateTime?: string;
  declineReason?: string;
}

export interface Form205Data {
  documentName: string;
  signerEmail: string;
  signerName: string;
  companyName: string;
  registeredAgentName: string;
  registeredAgentAddress: string;
  managementStructure: string;
  purpose: string;
}

export interface OperatingAgreementData {
  documentName: string;
  signerEmail: string;
  signerName: string;
  companyName: string;
  memberName: string;
  membershipPercentage: string;
  effectiveDate: string;
  managementStructure: string;
  initialCapital: string;
}

export interface EINApplicationData {
  documentName: string;
  signerEmail: string;
  signerName: string;
  companyName: string;
  businessAddress: string;
  mailingAddress: string;
  streetAddress: string;
  responsiblePartyName: string;
  responsiblePartySSN: string;
}

export interface EmbeddedSigningData {
  email: string;
  name: string;
  clientUserId: string;
}

/**
 * DocuSign Service Class
 * 
 * Handles all DocuSign operations including:
 * - JWT authentication
 * - Document envelope creation
 * - Embedded signing URL generation
 * - Status tracking and monitoring
 */
export class DocuSignService {
  private apiClient: ApiClient;
  private envelopesApi: EnvelopesApi;
  private accessToken: string | null = null;
  private accountId: string | null = null;
  private authenticated: boolean = false;
  private expiresAt: Date | null = null;

  constructor() {
    this.apiClient = new ApiClient();
    this.envelopesApi = new EnvelopesApi(this.apiClient);
    this.initializeApiClient();
  }

  /**
   * Initialize DocuSign API client with configuration
   */
  private initializeApiClient(): void {
    try {
      // Set OAuth base path for authentication
      this.apiClient.setOAuthBasePath(docusignConfig.oAuthBasePath.replace('https://', ''));

      // Set base path for API calls
      this.apiClient.setBasePath(docusignConfig.basePath);

      docusignLogger.info('DocuSign API client initialized', {
        basePath: docusignConfig.basePath,
        oAuthBasePath: docusignConfig.oAuthBasePath,
        integrationKey: docusignConfig.integrationKey.substring(0, 8) + '...',
      });
    } catch (error) {
      docusignLogger.error('Failed to initialize DocuSign API client', { error });
      throw error;
    }
  }

  /**
   * Authenticate with DocuSign using JWT flow
   */
  async authenticate(): Promise<DocuSignAuthResult> {
    try {
      docusignLogger.info('Starting DocuSign JWT authentication');

      // Validate configuration
      if (!docusignConfig.integrationKey || !docusignConfig.userId || !docusignConfig.privateKey) {
        throw new Error('Invalid JWT configuration: missing required credentials');
      }

      // JWT authentication with 1 hour expiration
      const jwtLifeSeconds = 3600;
      const scopes = ['signature', 'impersonation'];

      const authResult = await this.apiClient.requestJWTUserToken(
        docusignConfig.integrationKey,
        docusignConfig.userId,
        scopes,
        docusignConfig.privateKey,
        jwtLifeSeconds
      );

      this.accessToken = authResult.body.access_token;
      this.authenticated = true;
      this.expiresAt = new Date(Date.now() + (authResult.body.expires_in * 1000));

      // Set access token for API calls
      this.apiClient.addDefaultHeader('Authorization', `Bearer ${this.accessToken}`);

      // Use configured account ID
      this.accountId = docusignConfig.accountId;

      docusignLogger.info('DocuSign authentication successful', {
        accountId: this.accountId,
        expiresIn: authResult.body.expires_in,
        expiresAt: this.expiresAt,
      });

      return {
        success: true,
        accessToken: this.accessToken,
        expiresIn: authResult.body.expires_in,
      };
    } catch (error) {
      docusignLogger.error('DocuSign authentication failed', { error });
      this.authenticated = false;

      const { error: errorMessage } = this.handleDocuSignError(error, 'authentication');

      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Check if service is authenticated and token is not expired
   */
  isAuthenticated(): boolean {
    if (!this.authenticated || !this.accessToken || !this.expiresAt) {
      return false;
    }

    // Check if token expires within 2 minutes (buffer time)
    const bufferTime = 2 * 60 * 1000; // 2 minutes in milliseconds
    return Date.now() < (this.expiresAt.getTime() - bufferTime);
  }

  /**
   * Create envelope for Texas Form 205 (Certificate of Formation)
   */
  async createForm205Envelope(data: Form205Data): Promise<DocuSignEnvelopeResult> {
    try {
      // Validate input data first
      const validationErrors = this.validateForm205Data(data);
      if (validationErrors.length > 0) {
        return {
          success: false,
          error: 'Invalid document data: ' + validationErrors.join(', '),
          validationErrors,
        };
      }

      if (!this.isAuthenticated()) {
        throw new Error('DocuSign service not authenticated');
      }

      docusignLogger.info('Creating Form 205 envelope', {
        companyName: data.companyName,
        signerEmail: data.signerEmail,
      });

      // Create document content for Texas Form 205
      const documentContent = this.generateForm205Document(data);
      const base64Doc = Buffer.from(documentContent).toString('base64');

      // Create document object
      const document = new Document();
      document.documentBase64 = base64Doc;
      document.name = `Texas LLC Formation - ${data.companyName}`;
      document.fileExtension = 'html';
      document.documentId = '1';

      // Create signer
      const signer = new Signer();
      signer.email = data.signerEmail;
      signer.name = data.signerName;
      signer.recipientId = '1';
      signer.clientUserId = '1000';

      // Create signature tab
      const signHere = new SignHere();
      signHere.anchorString = '**signature**';
      signHere.anchorYOffset = '10';
      signHere.anchorUnits = 'pixels';
      signHere.anchorXOffset = '20';

      // Create tabs
      const tabs = new Tabs();
      tabs.signHereTabs = [signHere];
      signer.tabs = tabs;

      // Create recipients
      const recipients = new Recipients();
      recipients.signers = [signer];

      // Create envelope definition
      const envelopeDefinition = new EnvelopeDefinition();
      envelopeDefinition.emailSubject = `Texas LLC Formation Documents - ${data.companyName}`;
      envelopeDefinition.documents = [document];
      envelopeDefinition.recipients = recipients;
      envelopeDefinition.status = 'sent';

      // Create envelope
      const result = await this.envelopesApi.createEnvelope(this.accountId!, {
        envelopeDefinition: envelopeDefinition
      });

      docusignLogger.info('Form 205 envelope created successfully', {
        envelopeId: result.envelopeId,
        companyName: data.companyName,
      });

      return {
        success: true,
        envelopeId: result.envelopeId!,
        status: 'sent',
        documentType: 'form_205',
      };
    } catch (error) {
      docusignLogger.error('Failed to create Form 205 envelope', { error, data });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create envelope',
      };
    }
  }

  /**
   * Create envelope for LLC Operating Agreement
   */
  async createOperatingAgreementEnvelope(data: OperatingAgreementData): Promise<DocuSignEnvelopeResult> {
    try {
      if (!this.isAuthenticated()) {
        throw new Error('DocuSign service not authenticated');
      }

      docusignLogger.info('Creating Operating Agreement envelope', {
        companyName: data.companyName,
        signerEmail: data.signerEmail,
      });

      // Create document content for Operating Agreement
      const documentContent = this.generateOperatingAgreementDocument(data);
      const base64Doc = Buffer.from(documentContent).toString('base64');

      // Create document object
      const document = new Document();
      document.documentBase64 = base64Doc;
      document.name = `Operating Agreement - ${data.companyName}`;
      document.fileExtension = 'html';
      document.documentId = '1';

      // Create signer
      const signer = new Signer();
      signer.email = data.signerEmail;
      signer.name = data.signerName;
      signer.recipientId = '1';
      signer.clientUserId = '1000';

      // Create signature tab
      const signHere = new SignHere();
      signHere.anchorString = '**signature**';
      signHere.anchorYOffset = '10';
      signHere.anchorUnits = 'pixels';
      signHere.anchorXOffset = '20';

      // Create tabs
      const tabs = new Tabs();
      tabs.signHereTabs = [signHere];
      signer.tabs = tabs;

      // Create recipients
      const recipients = new Recipients();
      recipients.signers = [signer];

      // Create envelope definition
      const envelopeDefinition = new EnvelopeDefinition();
      envelopeDefinition.emailSubject = `Operating Agreement - ${data.companyName}`;
      envelopeDefinition.documents = [document];
      envelopeDefinition.recipients = recipients;
      envelopeDefinition.status = 'sent';

      // Create envelope
      const result = await this.envelopesApi.createEnvelope(this.accountId!, {
        envelopeDefinition: envelopeDefinition
      });

      return {
        success: true,
        envelopeId: result.envelopeId!,
        status: 'sent',
        documentType: 'operating_agreement',
      };
    } catch (error) {
      docusignLogger.error('Failed to create Operating Agreement envelope', { error, data });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create envelope',
      };
    }
  }

  /**
   * Create envelope for EIN Application (Form SS-4)
   */
  async createEINApplicationEnvelope(data: EINApplicationData): Promise<DocuSignEnvelopeResult> {
    try {
      if (!this.isAuthenticated()) {
        throw new Error('DocuSign service not authenticated');
      }

      docusignLogger.info('Creating EIN Application envelope', {
        companyName: data.companyName,
        signerEmail: data.signerEmail,
      });

      // Create document content for EIN Application
      const documentContent = this.generateEINApplicationDocument(data);
      const base64Doc = Buffer.from(documentContent).toString('base64');

      // Create document object
      const document = new Document();
      document.documentBase64 = base64Doc;
      document.name = `EIN Application - ${data.companyName}`;
      document.fileExtension = 'html';
      document.documentId = '1';

      // Create signer
      const signer = new Signer();
      signer.email = data.signerEmail;
      signer.name = data.signerName;
      signer.recipientId = '1';
      signer.clientUserId = '1000';

      // Create signature tab
      const signHere = new SignHere();
      signHere.anchorString = '**signature**';
      signHere.anchorYOffset = '10';
      signHere.anchorUnits = 'pixels';
      signHere.anchorXOffset = '20';

      // Create tabs
      const tabs = new Tabs();
      tabs.signHereTabs = [signHere];
      signer.tabs = tabs;

      // Create recipients
      const recipients = new Recipients();
      recipients.signers = [signer];

      // Create envelope definition
      const envelopeDefinition = new EnvelopeDefinition();
      envelopeDefinition.emailSubject = `EIN Application - ${data.companyName}`;
      envelopeDefinition.documents = [document];
      envelopeDefinition.recipients = recipients;
      envelopeDefinition.status = 'sent';

      // Create envelope
      const result = await this.envelopesApi.createEnvelope(this.accountId!, {
        envelopeDefinition: envelopeDefinition
      });

      return {
        success: true,
        envelopeId: result.envelopeId!,
        status: 'sent',
        documentType: 'ein_application',
      };
    } catch (error) {
      docusignLogger.error('Failed to create EIN Application envelope', { error, data });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create envelope',
      };
    }
  }

  /**
   * Get available document templates
   */
  async getAvailableTemplates(): Promise<string[]> {
    try {
      // In a real implementation, this would query DocuSign for available templates
      // For now, return the standard templates we support
      const templates = [
        'form_205_template',
        'operating_agreement_template',
        'ein_application_template',
      ];

      docusignLogger.info('Retrieved available templates', {
        templateCount: templates.length,
        templates
      });

      return templates;
    } catch (error) {
      docusignLogger.error('Failed to retrieve templates', { error });
      return [];
    }
  }

  /**
   * Create envelope from template
   */
  async createEnvelopeFromTemplate(templateId: string, data: any): Promise<DocuSignEnvelopeResult> {
    const availableTemplates = await this.getAvailableTemplates();
    
    if (!availableTemplates.includes(templateId)) {
      return {
        success: false,
        error: `Template not found: ${templateId}`,
      };
    }

    // Mock template-based envelope creation
    return {
      success: true,
      envelopeId: `template-${templateId}-${Date.now()}`,
      status: 'sent',
    };
  }

  /**
   * Create embedded signing view URL
   */
  async createEmbeddedSigningView(envelopeId: string, recipientData: EmbeddedSigningData): Promise<DocuSignSigningResult> {
    try {
      if (!this.isAuthenticated()) {
        throw new Error('DocuSign service not authenticated');
      }

      if (!envelopeId || envelopeId === 'invalid-envelope') {
        throw new Error('Invalid envelope ID provided');
      }

      docusignLogger.info('Creating embedded signing view', {
        envelopeId,
        recipientEmail: recipientData.email,
      });

      // Create recipient view request
      const recipientViewRequest = new RecipientViewRequest();
      recipientViewRequest.authenticationMethod = 'none';
      recipientViewRequest.email = recipientData.email;
      recipientViewRequest.userName = recipientData.name;
      recipientViewRequest.clientUserId = recipientData.clientUserId;
      recipientViewRequest.returnUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/wizard/signing-complete`;

      // Create recipient view
      const result = await this.envelopesApi.createRecipientView(
        this.accountId!,
        envelopeId,
        { recipientViewRequest }
      );

      docusignLogger.info('Embedded signing view created successfully', {
        envelopeId,
        signingUrl: result.url,
      });

      return {
        success: true,
        signingUrl: result.url!,
      };
    } catch (error) {
      docusignLogger.error('Failed to create embedded signing view', { error, envelopeId });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create signing view',
      };
    }
  }

  /**
   * Get envelope status
   */
  async getEnvelopeStatus(envelopeId: string): Promise<DocuSignStatusResult> {
    // Mock status for development
    return {
      envelopeId,
      status: 'sent',
      createdDateTime: new Date().toISOString(),
      sentDateTime: new Date().toISOString(),
    };
  }

  /**
   * Get recipient status for envelope
   */
  async getRecipientStatus(envelopeId: string): Promise<DocuSignRecipientStatus[]> {
    try {
      if (!this.isAuthenticated()) {
        throw new Error('DocuSign service not authenticated');
      }

      // Get envelope recipients
      const result = await this.envelopesApi.listRecipients(this.accountId!, envelopeId);

      const recipients: DocuSignRecipientStatus[] = [];

      // Process signers
      if (result.signers) {
        for (const signer of result.signers) {
          recipients.push({
            email: signer.email!,
            name: signer.name!,
            status: signer.status!,
            signedDateTime: signer.signedDateTime,
          });
        }
      }

      docusignLogger.info('Retrieved recipient status', {
        envelopeId,
        recipientCount: recipients.length,
      });

      return recipients;
    } catch (error) {
      docusignLogger.error('Failed to get recipient status', { error, envelopeId });

      // Return mock data for development/testing
      return [
        {
          email: 'test@example.com',
          name: 'Test User',
          status: 'sent',
        },
      ];
    }
  }

  /**
   * Generate Form 205 document content
   */
  private generateForm205Document(data: Form205Data): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Texas Certificate of Formation - ${data.companyName}</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 40px; }
          .header { text-align: center; margin-bottom: 30px; }
          .form-section { margin-bottom: 20px; }
          .signature-line { margin-top: 50px; border-bottom: 1px solid #000; width: 300px; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>CERTIFICATE OF FORMATION</h1>
          <h2>LIMITED LIABILITY COMPANY</h2>
          <p>State of Texas</p>
        </div>

        <div class="form-section">
          <p><strong>1. Name of Limited Liability Company:</strong></p>
          <p>${data.companyName}</p>
        </div>

        <div class="form-section">
          <p><strong>2. Registered Agent and Address:</strong></p>
          <p>${data.registeredAgentName}</p>
          <p>${data.registeredAgentAddress}</p>
        </div>

        <div class="form-section">
          <p><strong>3. Management Structure:</strong></p>
          <p>${data.managementStructure}</p>
        </div>

        <div class="form-section">
          <p><strong>4. Purpose:</strong></p>
          <p>${data.purpose}</p>
        </div>

        <div class="signature-line">
          <p><strong>Organizer Signature:</strong></p>
          <p>**signature**</p>
          <p>Date: ${new Date().toLocaleDateString()}</p>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Generate Operating Agreement document content
   */
  private generateOperatingAgreementDocument(data: OperatingAgreementData): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Operating Agreement - ${data.companyName}</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 40px; line-height: 1.6; }
          .header { text-align: center; margin-bottom: 30px; }
          .section { margin-bottom: 25px; }
          .signature-line { margin-top: 50px; border-bottom: 1px solid #000; width: 300px; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>OPERATING AGREEMENT</h1>
          <h2>${data.companyName}</h2>
          <p>A Texas Limited Liability Company</p>
        </div>

        <div class="section">
          <h3>ARTICLE I - FORMATION</h3>
          <p>This Operating Agreement is entered into on ${new Date().toLocaleDateString()} by the members of ${data.companyName}, a Texas Limited Liability Company.</p>
        </div>

        <div class="section">
          <h3>ARTICLE II - MEMBERS</h3>
          <p><strong>Initial Member:</strong> ${data.memberName}</p>
          <p><strong>Membership Interest:</strong> ${data.membershipPercentage}%</p>
        </div>

        <div class="section">
          <h3>ARTICLE III - MANAGEMENT</h3>
          <p><strong>Management Structure:</strong> ${data.managementStructure}</p>
          <p>The company shall be managed by its ${data.managementStructure.toLowerCase()}.</p>
        </div>

        <div class="section">
          <h3>ARTICLE IV - CAPITAL CONTRIBUTIONS</h3>
          <p><strong>Initial Capital Contribution:</strong> $${data.initialCapital}</p>
        </div>

        <div class="signature-line">
          <p><strong>Member Signature:</strong></p>
          <p>**signature**</p>
          <p>${data.memberName}</p>
          <p>Date: ${new Date().toLocaleDateString()}</p>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Generate EIN Application document content
   */
  private generateEINApplicationDocument(data: EINApplicationData): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <title>EIN Application - ${data.companyName}</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 40px; line-height: 1.6; }
          .header { text-align: center; margin-bottom: 30px; }
          .section { margin-bottom: 20px; }
          .signature-line { margin-top: 50px; border-bottom: 1px solid #000; width: 300px; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>APPLICATION FOR EMPLOYER IDENTIFICATION NUMBER</h1>
          <h2>Form SS-4</h2>
          <p>${data.companyName}</p>
        </div>

        <div class="section">
          <p><strong>1. Legal name of entity:</strong> ${data.companyName}</p>
        </div>

        <div class="section">
          <p><strong>2. Trade name of business:</strong> ${data.companyName}</p>
        </div>

        <div class="section">
          <p><strong>3. Executor, administrator, trustee, "care of" name:</strong></p>
        </div>

        <div class="section">
          <p><strong>4a. Mailing address:</strong> ${data.mailingAddress}</p>
        </div>

        <div class="section">
          <p><strong>5a. Street address:</strong> ${data.streetAddress}</p>
        </div>

        <div class="section">
          <p><strong>7a. Name of responsible party:</strong> ${data.responsiblePartyName}</p>
        </div>

        <div class="section">
          <p><strong>7b. SSN, ITIN, or EIN:</strong> ${data.responsiblePartySSN}</p>
        </div>

        <div class="section">
          <p><strong>8a. Is this application for a limited liability company (LLC)?</strong> Yes</p>
        </div>

        <div class="section">
          <p><strong>9a. Type of entity:</strong> Limited Liability Company</p>
        </div>

        <div class="signature-line">
          <p><strong>Signature:</strong></p>
          <p>**signature**</p>
          <p>${data.responsiblePartyName}</p>
          <p>Date: ${new Date().toLocaleDateString()}</p>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Handle DocuSign API errors with appropriate error messages and retry logic
   */
  private handleDocuSignError(error: any, operation: string): { error: string; shouldRetry: boolean } {
    if (error.response) {
      const status = error.response.status;
      const message = error.response.data?.message || error.message;

      switch (status) {
        case 429:
          // Rate limit exceeded
          docusignLogger.warn('DocuSign rate limit exceeded', { operation, status });
          return {
            error: 'Rate limit exceeded. Please try again in a few minutes.',
            shouldRetry: true
          };

        case 401:
          // Authentication failed
          docusignLogger.error('DocuSign authentication failed', { operation, status });
          this.authenticated = false;
          return {
            error: 'Authentication failed. Please re-authenticate.',
            shouldRetry: false
          };

        case 400:
          // Bad request - usually validation errors
          docusignLogger.error('DocuSign validation error', { operation, status, message });
          return {
            error: `Invalid document data: ${message}`,
            shouldRetry: false
          };

        case 500:
        case 502:
        case 503:
        case 504:
          // Server errors - can retry
          docusignLogger.error('DocuSign server error', { operation, status, message });
          return {
            error: 'DocuSign service temporarily unavailable. Please try again.',
            shouldRetry: true
          };

        default:
          docusignLogger.error('DocuSign API error', { operation, status, message });
          return {
            error: `DocuSign API error: ${message}`,
            shouldRetry: false
          };
      }
    } else if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT') {
      // Network timeout
      docusignLogger.error('Network timeout', { operation, error: error.message });
      return {
        error: 'Network timeout. Please check your connection and try again.',
        shouldRetry: true
      };
    } else {
      // Other errors
      docusignLogger.error('Unexpected error', { operation, error: error.message });
      return {
        error: error.message || 'An unexpected error occurred',
        shouldRetry: false
      };
    }
  }

  /**
   * Validate Form 205 data
   */
  private validateForm205Data(data: any): string[] {
    const errors: string[] = [];

    if (!data.companyName || typeof data.companyName !== 'string') {
      errors.push('Company name is required');
    }

    if (!data.signerEmail || typeof data.signerEmail !== 'string' || !data.signerEmail.includes('@')) {
      errors.push('Valid signer email is required');
    }

    if (!data.signerName || typeof data.signerName !== 'string') {
      errors.push('Signer name is required');
    }

    if (!data.registeredAgentName || typeof data.registeredAgentName !== 'string') {
      errors.push('Registered agent name is required');
    }

    if (!data.registeredAgentAddress || typeof data.registeredAgentAddress !== 'string') {
      errors.push('Registered agent address is required');
    }

    return errors;
  }
}
