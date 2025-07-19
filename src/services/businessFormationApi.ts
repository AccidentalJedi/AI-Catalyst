import axios from 'axios'

// API Configuration
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api/v1'

// Create axios instance with default config
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000, // 30 seconds
  headers: {
    'Content-Type': 'application/json',
  },
})

// Request interceptor for auth token
apiClient.interceptors.request.use(
  (config) => {
    // Add auth token if available
    const token = localStorage.getItem('authToken')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// Response interceptor for error handling
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Handle unauthorized - redirect to login or refresh token
      localStorage.removeItem('authToken')
      // Could dispatch logout action here
    }
    return Promise.reject(error)
  }
)

// Types for API requests/responses
export interface BusinessFormationRequest {
  businessName: string
  businessType: 'llc' | 'corporation' | 'partnership'
  filingState: string
  registeredAgent?: {
    name: string
    address: string
    city: string
    state: string
    zipCode: string
  }
  members?: Array<{
    name: string
    address: string
    ownershipPercentage: number
  }>
  documents?: {
    documentsToGenerate: string[]
    signatureMethod: string
    documentDelivery: string
  }
}

export interface BusinessFormationResponse {
  success: boolean
  data?: {
    workflowId: string
    companyId: string
    currentStep: string
    nextSteps: string[]
    estimatedCompletion: string
    message?: string
  }
  error?: string
  validationErrors?: string[]
}

// Business Formation API Service
export class BusinessFormationApiService {
  /**
   * Submit business formation request to backend
   */
  static async submitBusinessFormation(
    formData: BusinessFormationRequest
  ): Promise<BusinessFormationResponse> {
    try {
      const response = await apiClient.post<BusinessFormationResponse>(
        '/business/form',
        formData
      )
      
      return response.data
    } catch (error) {
      if (axios.isAxiosError(error)) {
        // Handle API error response
        if (error.response?.data) {
          return error.response.data as BusinessFormationResponse
        }
        
        // Handle network/timeout errors
        return {
          success: false,
          error: error.message || 'Network error occurred'
        }
      }
      
      // Handle unexpected errors
      return {
        success: false,
        error: 'An unexpected error occurred'
      }
    }
  }

  /**
   * Get business formation status
   */
  static async getFormationStatus(workflowId: string): Promise<any> {
    try {
      const response = await apiClient.get(`/business/formation/${workflowId}/status`)
      return response.data
    } catch (error) {
      throw error
    }
  }

  /**
   * Generate business documents
   */
  static async generateDocuments(workflowId: string, documentTypes: string[]): Promise<any> {
    try {
      const response = await apiClient.post(`/business/documents/generate`, {
        workflowId,
        documentTypes
      })
      return response.data
    } catch (error) {
      throw error
    }
  }
}

export default BusinessFormationApiService
