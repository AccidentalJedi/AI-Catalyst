/**
 * @file Document Generation Service
 * Handles generation of business formation documents using Handlebars templates
 */

import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import Handlebars from 'handlebars';
import { dbUtils, transaction } from '@utils/database';
import { dbLogger } from '@utils/logger';
import {
  DocumentGenerationRequest,
  DocumentGenerationResponse,
  Form205Data,
  BusinessFormationWorkflow,
  Company,
  Address,
  RegisteredAgent
} from '../types/businessTypes';

/**
 * Document Generation Service Class
 */
export class DocumentGenerationService {
  private static readonly TEMPLATES_DIR = path.join(process.cwd(), 'src', 'templates');
  private static readonly DOCUMENTS_DIR = path.join(process.cwd(), 'generated-documents');
  private static compiledTemplates: Map<string, HandlebarsTemplateDelegate> = new Map();
  
  /**
   * Initialize document generation service
   */
  static async initialize(): Promise<void> {
    try {
      // Ensure directories exist
      await fs.mkdir(this.TEMPLATES_DIR, { recursive: true });
      await fs.mkdir(this.DOCUMENTS_DIR, { recursive: true });
      
      // Register Handlebars helpers
      this.registerHelpers();
      
      // Precompile templates
      await this.precompileTemplates();
      
      dbLogger.info('Document generation service initialized successfully');
    } catch (error) {
      dbLogger.error('Failed to initialize document generation service:', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }
  
  /**
   * Generate document from template
   */
  static async generateDocument(request: DocumentGenerationRequest): Promise<DocumentGenerationResponse> {
    try {
      const { workflowId, documentType, templateData } = request;
      
      // Get compiled template
      const template = this.compiledTemplates.get(documentType);
      if (!template) {
        throw new Error(`Template not found for document type: ${documentType}`);
      }
      
      // Sanitize template data
      const sanitizedData = this.sanitizeTemplateData(templateData);
      
      // Generate document content
      const documentContent = template(sanitizedData);
      
      // Generate unique document ID and filename
      const documentId = crypto.randomUUID();
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `${documentType}_${timestamp}_${documentId.slice(0, 8)}.html`;
      const documentPath = path.join(this.DOCUMENTS_DIR, filename);
      
      // Save document to file
      await fs.writeFile(documentPath, documentContent, 'utf8');
      
      // Store document record in database
      await this.storeDocumentRecord(documentId, workflowId, documentType, filename, documentPath);
      
      // Update workflow with generated document
      await this.updateWorkflowDocuments(workflowId, documentId);
      
      dbLogger.info('Document generated successfully', {
        documentId,
        workflowId,
        documentType,
        filename
      });
      
      return {
        success: true,
        data: {
          documentId,
          documentPath: filename, // Return relative path for security
          documentUrl: `/api/documents/${documentId}`,
          generatedAt: new Date().toISOString()
        }
      };
    } catch (error) {
      dbLogger.error('Failed to generate document:', {
        workflowId: request.workflowId,
        documentType: request.documentType,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      
      return {
        success: false,
        error: 'Failed to generate document'
      };
    }
  }
  
  /**
   * Generate Texas Form 205 (Certificate of Formation)
   */
  static async generateForm205(workflowId: string, formData: Form205Data): Promise<DocumentGenerationResponse> {
    return this.generateDocument({
      workflowId,
      documentType: 'form_205',
      templateData: formData
    });
  }
  
  /**
   * Generate Operating Agreement
   */
  static async generateOperatingAgreement(workflowId: string, companyData: any): Promise<DocumentGenerationResponse> {
    return this.generateDocument({
      workflowId,
      documentType: 'operating_agreement',
      templateData: companyData
    });
  }
  
  /**
   * Generate EIN Application (SS-4)
   */
  static async generateEINApplication(workflowId: string, companyData: any): Promise<DocumentGenerationResponse> {
    return this.generateDocument({
      workflowId,
      documentType: 'ein_application',
      templateData: companyData
    });
  }
  
  /**
   * Get document by ID
   */
  static async getDocument(documentId: string, userId: string): Promise<{ content: string; filename: string } | null> {
    try {
      const result = dbUtils.get(`
        SELECT d.*, w.userId 
        FROM generated_documents d
        JOIN business_formation_workflows w ON d.workflowId = w.id
        WHERE d.id = ? AND w.userId = ?
      `, [documentId, userId]);
      
      if (!result) {
        return null;
      }
      
      const documentPath = path.join(this.DOCUMENTS_DIR, result.filename);
      const content = await fs.readFile(documentPath, 'utf8');
      
      return {
        content,
        filename: result.filename
      };
    } catch (error) {
      dbLogger.error('Failed to get document:', {
        documentId,
        userId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return null;
    }
  }
  
  /**
   * Register Handlebars helpers
   */
  private static registerHelpers(): void {
    // Date formatting helper
    Handlebars.registerHelper('formatDate', (date: string | Date) => {
      if (!date) return '';
      const d = new Date(date);
      return d.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    });
    
    // Currency formatting helper
    Handlebars.registerHelper('formatCurrency', (amount: number) => {
      if (typeof amount !== 'number') return '$0.00';
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD'
      }).format(amount);
    });
    
    // Uppercase helper
    Handlebars.registerHelper('uppercase', (str: string) => {
      return str ? str.toUpperCase() : '';
    });
    
    // Conditional helper
    Handlebars.registerHelper('ifEquals', function(arg1: any, arg2: any, options: any) {
      return (arg1 === arg2) ? options.fn(this) : options.inverse(this);
    });
    
    // Address formatting helper
    Handlebars.registerHelper('formatAddress', (address: Address) => {
      if (!address) return '';
      return `${address.street}, ${address.city}, ${address.state} ${address.zipCode}`;
    });
    
    // Safe string helper (prevents XSS)
    Handlebars.registerHelper('safeString', (str: string) => {
      return new Handlebars.SafeString(Handlebars.escapeExpression(str || ''));
    });
  }
  
  /**
   * Precompile templates
   */
  private static async precompileTemplates(): Promise<void> {
    const templateFiles = [
      'form_205.hbs',
      'operating_agreement.hbs',
      'ein_application.hbs'
    ];
    
    for (const templateFile of templateFiles) {
      try {
        const templatePath = path.join(this.TEMPLATES_DIR, templateFile);
        const templateSource = await fs.readFile(templatePath, 'utf8');
        const compiled = Handlebars.compile(templateSource);
        
        const templateName = path.basename(templateFile, '.hbs');
        this.compiledTemplates.set(templateName, compiled);
        
        dbLogger.info(`Template compiled: ${templateName}`);
      } catch (error) {
        dbLogger.warn(`Failed to compile template: ${templateFile}`, {
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
  }
  
  /**
   * Sanitize template data to prevent injection attacks
   */
  private static sanitizeTemplateData(data: any): any {
    if (typeof data === 'string') {
      return Handlebars.escapeExpression(data);
    }
    
    if (Array.isArray(data)) {
      return data.map(item => this.sanitizeTemplateData(item));
    }
    
    if (data && typeof data === 'object') {
      const sanitized: any = {};
      for (const [key, value] of Object.entries(data)) {
        sanitized[key] = this.sanitizeTemplateData(value);
      }
      return sanitized;
    }
    
    return data;
  }
  
  /**
   * Store document record in database
   */
  private static async storeDocumentRecord(
    documentId: string,
    workflowId: string,
    documentType: string,
    filename: string,
    filePath: string
  ): Promise<void> {
    dbUtils.run(`
      INSERT INTO generated_documents (
        id, workflowId, documentType, filename, filePath, generatedAt
      ) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `, [documentId, workflowId, documentType, filename, filePath]);
  }
  
  /**
   * Update workflow with generated document
   */
  private static async updateWorkflowDocuments(workflowId: string, documentId: string): Promise<void> {
    const workflow = dbUtils.get(`
      SELECT generatedDocuments FROM business_formation_workflows WHERE id = ?
    `, [workflowId]);
    
    if (workflow) {
      const documents = workflow.generatedDocuments ? JSON.parse(workflow.generatedDocuments) : [];
      documents.push(documentId);
      
      dbUtils.run(`
        UPDATE business_formation_workflows 
        SET generatedDocuments = ?, updatedAt = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [JSON.stringify(documents), workflowId]);
    }
  }
  
  /**
   * Clean up old documents (run periodically)
   */
  static async cleanupOldDocuments(daysOld: number = 30): Promise<void> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysOld);
      
      const oldDocuments = dbUtils.all(`
        SELECT * FROM generated_documents 
        WHERE generatedAt < ?
      `, [cutoffDate.toISOString()]);
      
      for (const doc of oldDocuments) {
        try {
          // Delete file
          await fs.unlink(doc.filePath);
          
          // Delete database record
          dbUtils.run('DELETE FROM generated_documents WHERE id = ?', [doc.id]);
          
          dbLogger.info(`Cleaned up old document: ${doc.filename}`);
        } catch (error) {
          dbLogger.warn(`Failed to cleanup document: ${doc.filename}`, {
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }
      
      dbLogger.info(`Document cleanup completed. Removed ${oldDocuments.length} old documents`);
    } catch (error) {
      dbLogger.error('Document cleanup failed:', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
}


