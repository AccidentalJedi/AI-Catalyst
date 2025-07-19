import crypto from 'crypto';
import { Request, Response } from 'express';
import { dbUtils } from '@utils/database';
import { logSuccess, logFailure, AuditAction, AuditResource } from '@utils/audit';
import { dbLogger } from '@utils/logger';

// Webhook event types
export enum WebhookEventType {
  DOCUSIGN_ENVELOPE_COMPLETED = 'docusign.envelope.completed',
  DOCUSIGN_ENVELOPE_DECLINED = 'docusign.envelope.declined',
  DOCUSIGN_ENVELOPE_VOIDED = 'docusign.envelope.voided',
  TEXAS_SOS_FILING_APPROVED = 'texas_sos.filing.approved',
  TEXAS_SOS_FILING_REJECTED = 'texas_sos.filing.rejected',
  FINCEN_BOI_SUBMITTED = 'fincen.boi.submitted',
  FINCEN_BOI_APPROVED = 'fincen.boi.approved',
  FINCEN_BOI_REJECTED = 'fincen.boi.rejected'
}

// Webhook payload interface
export interface WebhookPayload {
  eventType: WebhookEventType;
  eventId: string;
  timestamp: string;
  data: Record<string, any>;
  source: string;
  signature?: string;
}

// Webhook handler interface
export interface WebhookHandler {
  eventType: WebhookEventType;
  handler: (payload: WebhookPayload, req: Request) => Promise<void>;
}

// Registered webhook handlers
const webhookHandlers = new Map<WebhookEventType, WebhookHandler['handler']>();

/**
 * Register a webhook handler
 */
export const registerWebhookHandler = (
  eventType: WebhookEventType,
  handler: WebhookHandler['handler']
): void => {
  webhookHandlers.set(eventType, handler);
  dbLogger.info('Webhook handler registered', { eventType });
};

/**
 * Verify webhook signature (for DocuSign)
 */
export const verifyDocuSignSignature = (
  payload: string,
  signature: string,
  secret: string
): boolean => {
  try {
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('base64');
    
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  } catch (error) {
    dbLogger.error('DocuSign signature verification failed:', {
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    return false;
  }
};

/**
 * Verify webhook signature (generic HMAC-SHA256)
 */
export const verifyWebhookSignature = (
  payload: string,
  signature: string,
  secret: string,
  algorithm: string = 'sha256'
): boolean => {
  try {
    const expectedSignature = crypto
      .createHmac(algorithm, secret)
      .update(payload)
      .digest('hex');
    
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  } catch (error) {
    dbLogger.error('Webhook signature verification failed:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      algorithm
    });
    return false;
  }
};

/**
 * Process webhook payload
 */
export const processWebhook = async (
  payload: WebhookPayload,
  req: Request,
  res: Response
): Promise<void> => {
  try {
    // Log webhook receipt
    await logSuccess(AuditAction.WIZARD_STEP_COMPLETE, AuditResource.SYSTEM, {
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      metadata: {
        eventType: payload.eventType,
        eventId: payload.eventId,
        source: payload.source
      }
    });
    
    // Find and execute handler
    const handler = webhookHandlers.get(payload.eventType);
    if (!handler) {
      dbLogger.warn('No handler found for webhook event', {
        eventType: payload.eventType,
        eventId: payload.eventId
      });
      
      res.status(200).json({
        success: true,
        message: 'Webhook received but no handler configured'
      });
      return;
    }
    
    // Execute handler
    await handler(payload, req);
    
    dbLogger.info('Webhook processed successfully', {
      eventType: payload.eventType,
      eventId: payload.eventId
    });
    
    res.status(200).json({
      success: true,
      message: 'Webhook processed successfully'
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    await logFailure(AuditAction.WIZARD_STEP_COMPLETE, AuditResource.SYSTEM, errorMessage, {
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      metadata: {
        eventType: payload.eventType,
        eventId: payload.eventId
      }
    });
    
    dbLogger.error('Webhook processing failed:', {
      error: errorMessage,
      eventType: payload.eventType,
      eventId: payload.eventId
    });
    
    res.status(500).json({
      success: false,
      error: 'Webhook processing failed'
    });
  }
};

/**
 * DocuSign envelope completion handler
 */
const handleDocuSignEnvelopeCompleted = async (
  payload: WebhookPayload,
  req: Request
): Promise<void> => {
  const { envelopeId, status, documentsUri } = payload.data;
  
  // Update document status in database
  dbUtils.run(`
    UPDATE documents 
    SET status = 'signed', signedAt = CURRENT_TIMESTAMP, updatedAt = CURRENT_TIMESTAMP
    WHERE docusignEnvelopeId = ?
  `, [envelopeId]);
  
  // TODO: Download signed documents from DocuSign
  // TODO: Update wizard progress if this was a required document
  // TODO: Send notification to user
  
  dbLogger.info('DocuSign envelope completed', {
    envelopeId,
    status,
    documentsUri
  });
};

/**
 * Texas SOS filing approval handler
 */
const handleTexasSosFilingApproved = async (
  payload: WebhookPayload,
  req: Request
): Promise<void> => {
  const { fileNumber, entityName, approvalDate } = payload.data;
  
  // Update company status
  dbUtils.run(`
    UPDATE companies 
    SET status = 'active', sosFileNumber = ?, updatedAt = CURRENT_TIMESTAMP
    WHERE legalName = ?
  `, [fileNumber, entityName]);
  
  // TODO: Update wizard progress
  // TODO: Send notification to user
  // TODO: Trigger next steps in formation process
  
  dbLogger.info('Texas SOS filing approved', {
    fileNumber,
    entityName,
    approvalDate
  });
};

/**
 * FinCEN BOI submission handler
 */
const handleFinCenBoiSubmitted = async (
  payload: WebhookPayload,
  req: Request
): Promise<void> => {
  const { confirmationNumber, submissionId, companyId } = payload.data;
  
  // Update BOI compliance status
  dbUtils.run(`
    UPDATE boi_compliance 
    SET filingStatus = 'submitted', confirmationNumber = ?, 
        submissionDate = CURRENT_TIMESTAMP, updatedAt = CURRENT_TIMESTAMP
    WHERE companyId = ?
  `, [confirmationNumber, companyId]);
  
  // TODO: Update wizard progress
  // TODO: Send confirmation to user
  
  dbLogger.info('FinCEN BOI submitted', {
    confirmationNumber,
    submissionId,
    companyId
  });
};

// Register default webhook handlers
registerWebhookHandler(WebhookEventType.DOCUSIGN_ENVELOPE_COMPLETED, handleDocuSignEnvelopeCompleted);
registerWebhookHandler(WebhookEventType.TEXAS_SOS_FILING_APPROVED, handleTexasSosFilingApproved);
registerWebhookHandler(WebhookEventType.FINCEN_BOI_SUBMITTED, handleFinCenBoiSubmitted);

/**
 * Create webhook endpoint middleware
 */
export const createWebhookEndpoint = (
  eventType: WebhookEventType,
  verifySignature?: (payload: string, signature: string) => boolean
) => {
  return async (req: Request, res: Response): Promise<void> => {
    try {
      const rawPayload = (req as any).rawBody?.toString() || JSON.stringify(req.body);
      
      // Verify signature if verification function provided
      if (verifySignature) {
        const signature = req.headers['x-signature'] as string || 
                         req.headers['x-docusign-signature-1'] as string;
        
        if (!signature || !verifySignature(rawPayload, signature)) {
          res.status(401).json({
            success: false,
            error: 'Invalid webhook signature'
          });
          return;
        }
      }
      
      // Parse payload
      const payload: WebhookPayload = {
        eventType,
        eventId: req.headers['x-event-id'] as string || crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        data: req.body,
        source: req.headers['user-agent'] as string || 'unknown'
      };
      
      await processWebhook(payload, req, res);
    } catch (error) {
      dbLogger.error('Webhook endpoint error:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        eventType
      });
      
      res.status(500).json({
        success: false,
        error: 'Webhook processing failed'
      });
    }
  };
};


