import { Response } from 'express';
import { asyncHandler } from '@middleware/errorHandler';
import { BusinessFormationPayload } from '../types/businessTypes';
import { AuthenticatedRequest, APIResponse } from '../types/index';
import { initiateBusinessFormation } from '@services/businessService';
import { businessFormationPayloadSchema } from '../types/index';

/**
 * SIMPLE ENTRY POINT - Bridge Service Integration
 *
 * @desc    Legacy endpoint that maintains backward compatibility while leveraging
 *          the comprehensive workflow system through the bridge service adapter.
 * @route   POST /api/v1/business/form
 * @access  Private (requires JWT)
 *
 * This controller serves as the "Simple Entry Point" for business formation,
 * designed for quick integrations and backward compatibility. It receives
 * business formation data, validates it using Zod schemas, and delegates
 * to the bridge service which translates the request into the comprehensive
 * BusinessFormationService workflow format.
 *
 * The bridge architecture ensures that this simple endpoint provides access
 * to the full power of the enterprise-grade workflow system, including:
 * - Automated document generation (Texas Form 205, Operating Agreements, EIN)
 * - Real-time progress tracking and status management
 * - Comprehensive audit logging and compliance tracking
 * - DocuSign integration for legal document execution
 *
 * This design allows existing integrations to continue working unchanged
 * while gaining access to advanced features through the unified backend.
 */
const formBusiness = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) {
      // This check is redundant if `protect` middleware is effective, but good for type safety.
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
        requestId: req.headers['x-request-id'],
      } as APIResponse);
    }

    const validationResult = businessFormationPayloadSchema.safeParse(req.body);

    if (!validationResult.success) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        data: validationResult.error.flatten().fieldErrors,
        timestamp: new Date(),
        requestId: req.headers['x-request-id'],
      } as APIResponse);
    }

    const payload: BusinessFormationPayload = validationResult.data;

    // The core logic is now handled by the service layer.
    const result = await initiateBusinessFormation(payload, req.user);

    res.status(201).json({
      success: true,
      message: 'Business formation process initiated successfully.',
      data: {
        businessName: payload.businessName,
        ...result,
      },
      timestamp: new Date(),
      requestId: req.headers['x-request-id'],
    } as APIResponse);
  }
);

export { formBusiness };


