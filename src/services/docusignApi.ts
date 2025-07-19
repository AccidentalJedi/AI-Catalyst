import axios, { AxiosResponse } from 'axios';

// API Configuration
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api/v1';

// Create axios instance with default config
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 60000, // 60 seconds for document operations
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor for auth token
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('authToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('authToken');
      // Could dispatch logout action here
    }
    return Promise.reject(error);
  }
);

// TypeScript interfaces for DocuSign API
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
}

// Form data interfaces
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
 * DocuSign API Service
 * Provides frontend interface to DocuSign backend services
 */
export class DocuSignApiService {
  
  /**
   * Authenticate with DocuSign service
   */
  static async authenticate(): Promise<DocuSignAuthResult> {
    try {
      const response: AxiosResponse<DocuSignAuthResult> = await apiClient.post('/docusign/authenticate');
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Failed to authenticate with DocuSign');
    }
  }

  /**
   * Check if DocuSign service is authenticated
   */
  static async isAuthenticated(): Promise<boolean> {
    try {
      const response: AxiosResponse<{ authenticated: boolean }> = await apiClient.get('/docusign/status');
      return response.data.authenticated;
    } catch (error) {
      return false;
    }
  }

  /**
   * Create Form 205 envelope for Texas LLC formation
   */
  static async createForm205Envelope(data: Form205Data): Promise<DocuSignEnvelopeResult> {
    try {
      const response: AxiosResponse<DocuSignEnvelopeResult> = await apiClient.post('/docusign/envelopes/form205', data);
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Failed to create Form 205 envelope');
    }
  }

  /**
   * Create Operating Agreement envelope
   */
  static async createOperatingAgreementEnvelope(data: OperatingAgreementData): Promise<DocuSignEnvelopeResult> {
    try {
      const response: AxiosResponse<DocuSignEnvelopeResult> = await apiClient.post('/docusign/envelopes/operating-agreement', data);
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Failed to create Operating Agreement envelope');
    }
  }

  /**
   * Create EIN Application envelope
   */
  static async createEINApplicationEnvelope(data: EINApplicationData): Promise<DocuSignEnvelopeResult> {
    try {
      const response: AxiosResponse<DocuSignEnvelopeResult> = await apiClient.post('/docusign/envelopes/ein-application', data);
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Failed to create EIN Application envelope');
    }
  }

  /**
   * Create embedded signing view URL
   */
  static async createEmbeddedSigningView(envelopeId: string, recipientData: EmbeddedSigningData): Promise<DocuSignSigningResult> {
    try {
      const response: AxiosResponse<DocuSignSigningResult> = await apiClient.post(`/docusign/envelopes/${envelopeId}/signing-view`, recipientData);
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Failed to create embedded signing view');
    }
  }

  /**
   * Get envelope status
   */
  static async getEnvelopeStatus(envelopeId: string): Promise<DocuSignStatusResult> {
    try {
      const response: AxiosResponse<DocuSignStatusResult> = await apiClient.get(`/docusign/envelopes/${envelopeId}/status`);
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Failed to get envelope status');
    }
  }

  /**
   * Get recipient status for envelope
   */
  static async getRecipientStatus(envelopeId: string): Promise<DocuSignRecipientStatus[]> {
    try {
      const response: AxiosResponse<DocuSignRecipientStatus[]> = await apiClient.get(`/docusign/envelopes/${envelopeId}/recipients`);
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Failed to get recipient status');
    }
  }

  /**
   * Get available document templates
   */
  static async getAvailableTemplates(): Promise<string[]> {
    try {
      const response: AxiosResponse<string[]> = await apiClient.get('/docusign/templates');
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Failed to get available templates');
    }
  }

  /**
   * Create envelope from template
   */
  static async createEnvelopeFromTemplate(templateId: string, data: any): Promise<DocuSignEnvelopeResult> {
    try {
      const response: AxiosResponse<DocuSignEnvelopeResult> = await apiClient.post(`/docusign/templates/${templateId}/envelope`, data);
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Failed to create envelope from template');
    }
  }
}

export default DocuSignApiService;
