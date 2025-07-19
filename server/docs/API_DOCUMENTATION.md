# AI Catalyst Business Formation API Documentation

## Overview

The AI Catalyst Business Formation API provides a comprehensive suite of endpoints for managing the entire business formation lifecycle. The system supports both simple, direct API access and sophisticated "TurboTax-style" workflow management with real-time progress tracking, automated document generation, and seamless DocuSign integration.

## Authentication

All endpoints require JWT authentication via the `Authorization` header:
```
Authorization: Bearer <jwt_token>
```

## Base URL
```
/api/business
```

## API Endpoints

### 1. Simple Business Formation (Legacy Compatibility)

#### POST /form
**Purpose**: Simple, direct business formation endpoint for backward compatibility
**Description**: Maintains compatibility with existing integrations while leveraging the full workflow system

**Request Body**:
```json
{
  "businessName": "Example LLC",
  "businessType": "LLC",
  "owners": [
    {
      "firstName": "John",
      "lastName": "Doe",
      "email": "john@example.com",
      "phone": "555-0123",
      "address": {
        "street": "123 Main St",
        "city": "Austin",
        "state": "TX",
        "zipCode": "78701",
        "county": "Travis"
      }
    }
  ],
  "registeredAgent": {
    "name": "John Doe",
    "address": {
      "street": "123 Main St",
      "city": "Austin", 
      "state": "TX",
      "zipCode": "78701",
      "county": "Travis"
    },
    "isIndividual": true
  },
  "businessAddress": {
    "street": "123 Business Ave",
    "city": "Austin",
    "state": "TX", 
    "zipCode": "78701",
    "county": "Travis"
  }
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "workflowId": "wf_abc123",
    "businessId": "biz_def456",
    "status": "completed",
    "documents": [
      {
        "type": "form_205",
        "documentId": "doc_789",
        "status": "generated"
      }
    ]
  },
  "message": "Business formation completed successfully"
}
```

### 2. Comprehensive Workflow Management

#### POST /formation
**Purpose**: Start a new business formation workflow with full lifecycle management
**Description**: Initiates a comprehensive workflow with step-by-step progress tracking

**Request Body**:
```json
{
  "businessName": "Example LLC",
  "businessType": "LLC",
  "owners": [...],
  "registeredAgent": {...},
  "businessAddress": {...},
  "mailingAddress": {...}
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "workflowId": "wf_abc123",
    "businessId": "biz_def456", 
    "currentStep": "business_info",
    "status": "in_progress",
    "completedSteps": [],
    "nextSteps": ["registered_agent", "owners", "documents"]
  }
}
```

#### POST /formation/llc
**Purpose**: Start LLC-specific formation workflow with enhanced validation
**Description**: Specialized endpoint for LLC formation with LLC-specific requirements

**Request Body**: Same as `/formation` but with LLC-specific validation
**Response**: Same structure as `/formation`

#### GET /
**Purpose**: Get user's businesses
**Description**: Retrieve all businesses associated with the authenticated user

**Response**:
```json
{
  "success": true,
  "data": {
    "businesses": [
      {
        "id": "biz_def456",
        "businessName": "Example LLC",
        "businessType": "LLC",
        "status": "active",
        "createdAt": "2025-01-19T10:00:00Z",
        "workflow": {
          "workflowId": "wf_abc123",
          "status": "completed",
          "currentStep": "completed"
        }
      }
    ],
    "total": 1
  }
}
```

### 3. Workflow Management

#### GET /workflow/:workflowId
**Purpose**: Get detailed workflow information
**Description**: Retrieve comprehensive workflow status, steps, and progress

**Response**:
```json
{
  "success": true,
  "data": {
    "workflowId": "wf_abc123",
    "businessId": "biz_def456",
    "workflowType": "llc_formation",
    "status": "in_progress",
    "currentStep": "documents",
    "completedSteps": ["business_info", "registered_agent", "owners"],
    "stepDetails": {
      "business_info": {
        "completedAt": "2025-01-19T10:00:00Z",
        "data": {...}
      }
    },
    "documents": [
      {
        "type": "form_205",
        "status": "pending",
        "documentId": null
      }
    ]
  }
}
```

#### PUT /workflow/:workflowId/step
**Purpose**: Update workflow step data
**Description**: Progress the workflow to the next step with validation

**Request Body**:
```json
{
  "step": "registered_agent",
  "data": {
    "registeredAgent": {
      "name": "John Doe",
      "address": {...},
      "isIndividual": true
    }
  }
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "workflowId": "wf_abc123",
    "currentStep": "owners",
    "completedSteps": ["business_info", "registered_agent"],
    "nextSteps": ["owners", "documents"]
  }
}
```

### 4. Document Generation

#### POST /documents/generate
**Purpose**: Generate business formation documents
**Description**: Create legal documents based on workflow data

**Request Body**:
```json
{
  "workflowId": "wf_abc123",
  "documentType": "form_205",
  "options": {
    "format": "pdf",
    "includeSignatureFields": true
  }
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "documentId": "doc_789",
    "documentType": "form_205",
    "status": "generated",
    "downloadUrl": "/api/business/documents/doc_789",
    "signatureRequired": true
  }
}
```

#### POST /documents/form-205
**Purpose**: Generate Texas Form 205 (Certificate of Formation)
**Description**: Create the official Texas LLC formation document

**Request Body**:
```json
{
  "workflowId": "wf_abc123",
  "formData": {
    "businessName": "Example LLC",
    "organizers": [...],
    "managementStructure": "member_managed",
    "purpose": "General business purposes",
    "duration": "Perpetual"
  }
}
```

#### POST /documents/operating-agreement
**Purpose**: Generate LLC Operating Agreement
**Description**: Create a comprehensive operating agreement document

#### POST /documents/ein-application
**Purpose**: Generate EIN Application (Form SS-4)
**Description**: Create IRS tax identification application

#### GET /documents/:documentId
**Purpose**: Download generated document
**Description**: Retrieve a previously generated document

**Response**: Binary document data or JSON with download URL

### 5. Workflow Completion

#### POST /workflow/:workflowId/complete
**Purpose**: Complete the business formation workflow
**Description**: Finalize the workflow and mark business as active

**Response**:
```json
{
  "success": true,
  "data": {
    "workflowId": "wf_abc123",
    "businessId": "biz_def456",
    "status": "completed",
    "completedAt": "2025-01-19T12:00:00Z",
    "documents": [
      {
        "type": "form_205",
        "documentId": "doc_789",
        "status": "signed"
      }
    ]
  }
}
```

#### POST /workflow/:workflowId/cancel
**Purpose**: Cancel an in-progress workflow
**Description**: Cancel workflow with optional reason

**Request Body**:
```json
{
  "reason": "User requested cancellation"
}
```

## Error Responses

All endpoints return consistent error responses:

```json
{
  "success": false,
  "error": "Error message",
  "code": "ERROR_CODE",
  "timestamp": "2025-01-19T10:00:00Z",
  "requestId": "req_abc123"
}
```

## Rate Limiting

Business formation endpoints are rate limited:
- **Formation endpoints**: 5 requests per hour per user
- **Document generation**: 10 requests per hour per user
- **General endpoints**: 100 requests per hour per user

## Workflow States

- `pending`: Workflow created but not started
- `in_progress`: Workflow actively being completed
- `completed`: All steps finished successfully
- `cancelled`: Workflow cancelled by user
- `failed`: Workflow failed due to error

## Document Types

- `form_205`: Texas Certificate of Formation
- `operating_agreement`: LLC Operating Agreement
- `ein_application`: IRS Form SS-4
- `bylaws`: Corporate Bylaws (for corporations)
- `articles_incorporation`: Articles of Incorporation

## Integration Examples

### Simple Integration
```javascript
// Quick business formation
const response = await fetch('/api/business/form', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify(businessData)
});
```

### Workflow Integration
```javascript
// Start workflow
const workflow = await fetch('/api/business/formation', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify(businessData)
});

// Update step
await fetch(`/api/business/workflow/${workflowId}/step`, {
  method: 'PUT',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ step: 'owners', data: ownersData })
});
```
