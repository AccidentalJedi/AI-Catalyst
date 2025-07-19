/**
 * @file DocuSign Service Test Suite
 * Test-driven development for DocuSign integration following Bridge-Service-Architecture.md guidelines
 * 
 * This test suite follows the isolated unit testing pattern described in the architecture documentation,
 * enabling comprehensive testing of DocuSign functionality while maintaining clear separation of concerns.
 */

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { DocuSignService } from '../docusignService';
import { docusignConfig } from '@config/index';

// Mock DocuSign SDK
jest.mock('docusign-esign', () => ({
  ApiClient: jest.fn().mockImplementation(() => ({
    setBasePath: jest.fn(),
    setOAuthBasePath: jest.fn(),
    addDefaultHeader: jest.fn(),
    requestJWTUserToken: jest.fn().mockResolvedValue({
      body: {
        access_token: 'mock-access-token',
        expires_in: 3600,
      }
    }),
    configureJWTAuthorizationFlow: jest.fn(),
    getUserInfo: jest.fn(),
  })),
  EnvelopesApi: jest.fn().mockImplementation(() => ({
    createEnvelope: jest.fn().mockResolvedValue({
      envelopeId: 'mock-envelope-id'
    }),
    getEnvelope: jest.fn(),
    createRecipientView: jest.fn().mockResolvedValue({
      url: 'https://demo.docusign.net/signing/mock-url'
    }),
    listRecipients: jest.fn().mockResolvedValue({
      signers: [{
        email: 'test@example.com',
        name: 'Test User',
        status: 'sent',
        signedDateTime: new Date().toISOString()
      }]
    }),
  })),
  EnvelopeDefinition: jest.fn(),
  Document: jest.fn(),
  Signer: jest.fn(),
  SignHere: jest.fn(),
  Tabs: jest.fn(),
  Recipients: jest.fn(),
  RecipientViewRequest: jest.fn(),
}));

// Mock configuration
jest.mock('@config/index', () => ({
  docusignConfig: {
    integrationKey: 'test-integration-key',
    userId: 'test-user-id',
    accountId: 'test-account-id',
    privateKey: 'test-private-key',
    basePath: 'https://demo.docusign.net/restapi',
    oAuthBasePath: 'https://account-d.docusign.com',
  },
}));

describe('DocuSign Service - JWT Authentication', () => {
  let docusignService: DocuSignService;

  beforeEach(() => {
    jest.clearAllMocks();
    docusignService = new DocuSignService();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Authentication Flow', () => {
    it('should initialize with correct configuration', () => {
      expect(docusignService).toBeDefined();
      expect(docusignService.isAuthenticated()).toBe(false);
    });

    it('should authenticate using JWT flow', async () => {
      // Mock successful JWT authentication
      const mockApiClient = {
        configureJWTAuthorizationFlow: jest.fn().mockResolvedValue({
          access_token: 'mock-access-token',
          expires_in: 3600,
        }),
        getUserInfo: jest.fn().mockResolvedValue({
          accounts: [{ account_id: 'test-account-id', is_default: true }],
        }),
      };

      // Test JWT authentication
      const result = await docusignService.authenticate();

      expect(result.success).toBe(true);
      expect(result.accessToken).toBeDefined();
      expect(docusignService.isAuthenticated()).toBe(true);
    });

    it('should handle authentication failures gracefully', async () => {
      // Mock authentication failure by making requestJWTUserToken throw an error
      jest.spyOn(docusignService['apiClient'], 'requestJWTUserToken')
        .mockRejectedValue(new Error('Invalid JWT configuration'));

      const result = await docusignService.authenticate();

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid JWT configuration');
      expect(docusignService.isAuthenticated()).toBe(false);
    });
  });
});

describe('DocuSign Service - Document Generation', () => {
  let docusignService: DocuSignService;

  beforeEach(async () => {
    docusignService = new DocuSignService();
    // Mock successful authentication
    await docusignService.authenticate();
  });

  describe('Texas LLC Formation Documents', () => {
    it('should create envelope for Form 205 (Texas LLC Formation)', async () => {
      const mockEnvelopeData = {
        documentName: 'Texas Form 205 - Certificate of Formation',
        signerEmail: 'test@example.com',
        signerName: 'Test User',
        companyName: 'Test LLC',
        registeredAgentName: 'Agent Name',
        registeredAgentAddress: '123 Main St, Austin, TX 78701',
      };

      const result = await docusignService.createForm205Envelope(mockEnvelopeData);

      expect(result.success).toBe(true);
      expect(result.envelopeId).toBeDefined();
      expect(result.status).toBe('sent');
    });

    it('should create envelope for Operating Agreement', async () => {
      const mockOperatingAgreementData = {
        documentName: 'LLC Operating Agreement',
        signerEmail: 'test@example.com',
        signerName: 'Test User',
        companyName: 'Test LLC',
        memberName: 'Test Member',
        membershipPercentage: '100',
        effectiveDate: new Date().toISOString(),
        managementStructure: 'Member-managed',
        initialCapital: '1000',
      };

      const result = await docusignService.createOperatingAgreementEnvelope(
        mockOperatingAgreementData
      );

      expect(result.success).toBe(true);
      expect(result.envelopeId).toBeDefined();
      expect(result.documentType).toBe('operating_agreement');
    });

    it('should create envelope for EIN Application (Form SS-4)', async () => {
      const mockEINData = {
        documentName: 'IRS Form SS-4 - EIN Application',
        signerEmail: 'test@example.com',
        signerName: 'Test User',
        companyName: 'Test LLC',
        businessAddress: '123 Main St, Austin, TX 78701',
        responsiblePartyName: 'Test User',
        responsiblePartySSN: 'XXX-XX-XXXX',
      };

      const result = await docusignService.createEINApplicationEnvelope(mockEINData);

      expect(result.success).toBe(true);
      expect(result.envelopeId).toBeDefined();
      expect(result.documentType).toBe('ein_application');
    });
  });

  describe('Document Template Management', () => {
    it('should validate document templates exist', async () => {
      const templates = await docusignService.getAvailableTemplates();

      expect(templates).toContain('form_205_template');
      expect(templates).toContain('operating_agreement_template');
      expect(templates).toContain('ein_application_template');
    });

    it('should handle missing templates gracefully', async () => {
      const result = await docusignService.createEnvelopeFromTemplate(
        'non_existent_template',
        {}
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Template not found');
    });
  });
});

describe('DocuSign Service - Embedded Signing', () => {
  let docusignService: DocuSignService;

  beforeEach(async () => {
    docusignService = new DocuSignService();
    await docusignService.authenticate();
  });

  describe('Embedded Signing URL Generation', () => {
    it('should generate embedded signing URL for authenticated user', async () => {
      const mockEnvelopeId = 'test-envelope-123';
      const mockRecipientData = {
        email: 'test@example.com',
        name: 'Test User',
        clientUserId: 'user-123',
      };

      const result = await docusignService.createEmbeddedSigningView(
        mockEnvelopeId,
        mockRecipientData
      );

      expect(result.success).toBe(true);
      expect(result.signingUrl).toBeDefined();
      expect(result.signingUrl).toContain('https://');
    });

    it('should handle invalid envelope IDs', async () => {
      const result = await docusignService.createEmbeddedSigningView(
        'invalid-envelope',
        {
          email: 'test@example.com',
          name: 'Test User',
          clientUserId: 'user-123',
        }
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid envelope');
    });
  });

  describe('Signing Status Tracking', () => {
    it('should track envelope signing status', async () => {
      const mockEnvelopeId = 'test-envelope-123';

      const status = await docusignService.getEnvelopeStatus(mockEnvelopeId);

      expect(status.envelopeId).toBe(mockEnvelopeId);
      expect(['sent', 'delivered', 'completed', 'declined']).toContain(status.status);
    });

    it('should provide detailed recipient status', async () => {
      const mockEnvelopeId = 'test-envelope-123';

      const recipients = await docusignService.getRecipientStatus(mockEnvelopeId);

      expect(Array.isArray(recipients)).toBe(true);
      if (recipients.length > 0) {
        expect(recipients[0]).toHaveProperty('email');
        expect(recipients[0]).toHaveProperty('status');
        expect(recipients[0]).toHaveProperty('signedDateTime');
      }
    });
  });
});

describe('DocuSign Service - Error Handling', () => {
  let docusignService: DocuSignService;

  beforeEach(() => {
    docusignService = new DocuSignService();
  });

  describe('Network and API Errors', () => {
    it('should handle network timeouts gracefully', async () => {
      // Mock network timeout on the underlying API client
      const timeoutError = new Error('Network timeout');
      timeoutError.code = 'ETIMEDOUT';

      jest.spyOn(docusignService['apiClient'], 'requestJWTUserToken')
        .mockRejectedValue(timeoutError);

      const result = await docusignService.authenticate();

      expect(result.success).toBe(false);
      expect(result.error).toContain('Network timeout');
    });

    it('should handle DocuSign API rate limits', async () => {
      // Mock rate limit error on the underlying API
      const rateLimitError = new Error('Rate limit exceeded');
      rateLimitError.response = {
        status: 429,
        data: { message: 'Rate limit exceeded' }
      };

      jest.spyOn(docusignService['envelopesApi'], 'createEnvelope')
        .mockRejectedValue(rateLimitError);

      // Authenticate first
      await docusignService.authenticate();

      const result = await docusignService.createForm205Envelope({
        documentName: 'Test Form 205',
        signerEmail: 'test@example.com',
        signerName: 'Test User',
        companyName: 'Test LLC',
        registeredAgentName: 'Test Agent',
        registeredAgentAddress: '123 Test St',
        managementStructure: 'Member-managed',
        purpose: 'General business purposes'
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Rate limit exceeded');
    });

    it('should handle invalid document data', async () => {
      const invalidData = {
        // Missing required fields
        signerEmail: 'invalid-email',
      };

      const result = await docusignService.createForm205Envelope(invalidData);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid document data');
      expect(result.validationErrors).toBeDefined();
    });
  });
});
