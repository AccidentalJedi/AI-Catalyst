# AI Catalyst Reusable Pattern Documentation

## Overview

This document extracts and documents the reusable architectural patterns, configurations, and template structures from the AI Catalyst automated development factory system. These patterns can be applied to other projects requiring sophisticated automation, security, and scalability.

## Executive Summary: Pattern Categories

**Pattern Types Identified:**
1. **Frontend Patterns** - React/TypeScript wizard interfaces, state management, UI frameworks
2. **Backend Patterns** - Express.js service architectures, middleware stacks, database designs
3. **Automation Factory Patterns** - Safe MCP configurations, GitHub Actions workflows, task management
4. **Security Patterns** - Authentication, authorization, data protection, audit logging
5. **Integration Patterns** - External service integrations, API contracts, error handling
6. **Configuration Management Patterns** - Environment handling, secrets management, deployment

## Frontend Architecture Patterns

### 1. Multi-Step Wizard Pattern

**Pattern Name:** TurboTax-Style Wizard Interface
**Use Case:** Complex multi-step user workflows requiring state persistence and validation

**Core Components:**
```typescript
// Wizard Layout Structure
interface WizardLayoutProps {
  children: React.ReactNode;
}

// State Management Pattern
interface WizardState {
  currentPhase: string;
  currentStep: string;
  phases: WizardPhase[];
  progress: Progress;
  completedSteps: string[];
  // Domain-specific state
  userProfile: UserProfile;
  businessFormation: BusinessFormation;
  // UI state
  isLoading: boolean;
  error: string | null;
}
```

**Implementation Template:**
```typescript
// 1. Zustand Store Pattern
export const useWizardStore = create<WizardState>()(
  persist(
    (set, get) => ({
      // State initialization
      currentPhase: 'discovery',
      currentStep: 'user-profile',
      
      // Actions
      setCurrentPhase: (phaseId: string) => { /* implementation */ },
      setCurrentStep: (stepId: string) => { /* implementation */ },
      completeStep: (stepId: string) => { /* implementation */ },
      updateUserProfile: (profile: Partial<UserProfile>) => { /* implementation */ }
    }),
    {
      name: 'wizard-storage',
      storage: createJSONStorage(() => localStorage)
    }
  )
);

// 2. Step Component Pattern
export const StepComponent: React.FC = () => {
  const { userProfile, updateUserProfile, setCurrentStep } = useWizardStore();
  const { register, handleSubmit, formState: { errors } } = useForm({
    resolver: yupResolver(validationSchema)
  });

  return (
    <VStack spacing={6}>
      <FormControl isInvalid={!!errors.field}>
        <FormLabel>Field Label</FormLabel>
        <Input {...register('field')} />
        <FormErrorMessage>{errors.field?.message}</FormErrorMessage>
      </FormControl>
      
      <Button onClick={handleSubmit(onSubmit)}>
        Continue
      </Button>
    </VStack>
  );
};
```

**Customization Points:**
- Phase and step definitions
- Validation schemas per step
- State persistence strategy
- Progress calculation logic
- Navigation flow control

### 2. Type-Safe API Integration Pattern

**Pattern Name:** Service Layer with Automatic Error Handling
**Use Case:** Frontend-backend communication with comprehensive error handling

**Implementation Template:**
```typescript
// API Service Pattern
class APIService {
  private client: AxiosInstance;

  constructor(baseURL: string) {
    this.client = axios.create({
      baseURL,
      timeout: 10000,
      headers: { 'Content-Type': 'application/json' }
    });

    // Request interceptor for authentication
    this.client.interceptors.request.use((config) => {
      const token = localStorage.getItem('authToken');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });

    // Response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      (error) => this.handleError(error)
    );
  }

  private handleError(error: AxiosError): Promise<never> {
    // Centralized error handling logic
    return Promise.reject(error);
  }

  async post<T>(endpoint: string, data: any): Promise<T> {
    const response = await this.client.post(endpoint, data);
    return response.data;
  }
}
```

### 3. Chakra UI Design System Pattern

**Pattern Name:** Consistent Design System Integration
**Use Case:** Scalable UI component library with theming

**Implementation Template:**
```typescript
// Theme Configuration
const theme = extendTheme({
  colors: {
    brand: {
      50: '#f0f9ff',
      500: '#3b82f6',
      900: '#1e3a8a'
    }
  },
  components: {
    Button: {
      defaultProps: { colorScheme: 'brand' },
      variants: {
        wizard: {
          bg: 'brand.500',
          color: 'white',
          _hover: { bg: 'brand.600' }
        }
      }
    }
  }
});

// Component Pattern
export const FormCard: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Card maxW="md" mx="auto" shadow="lg">
    <CardHeader>
      <Heading size="md">Step Title</Heading>
    </CardHeader>
    <CardBody>
      {children}
    </CardBody>
  </Card>
);
```

## Backend Architecture Patterns

### 1. Layered Service Architecture Pattern

**Pattern Name:** Enterprise Service Layer with Dependency Injection
**Use Case:** Scalable backend services with clear separation of concerns

**Implementation Template:**
```typescript
// Service Interface Pattern
interface IBusinessFormationService {
  startFormation(userId: string, payload: BusinessFormationPayload): Promise<ServiceResponse>;
  getWorkflowStatus(workflowId: string): Promise<WorkflowStatus>;
  updateWorkflow(workflowId: string, updates: WorkflowUpdates): Promise<ServiceResponse>;
}

// Service Implementation Pattern
export class BusinessFormationService implements IBusinessFormationService {
  constructor(
    private db: Database,
    private auditLogger: Logger,
    private documentService: IDocumentService
  ) {}

  async startFormation(userId: string, payload: BusinessFormationPayload): Promise<ServiceResponse> {
    return this.db.transaction(async () => {
      try {
        // 1. Validate input
        const validatedPayload = await this.validatePayload(payload);
        
        // 2. Create workflow
        const workflow = await this.createWorkflow(userId, validatedPayload);
        
        // 3. Audit logging
        this.auditLogger.info('Business formation started', {
          userId,
          workflowId: workflow.id
        });
        
        // 4. Return response
        return {
          success: true,
          data: { workflowId: workflow.id }
        };
      } catch (error) {
        this.auditLogger.error('Business formation failed', { userId, error });
        throw error;
      }
    });
  }
}
```

### 2. Middleware Stack Pattern

**Pattern Name:** Comprehensive Security and Validation Middleware
**Use Case:** Request processing pipeline with security, validation, and logging

**Implementation Template:**
```typescript
// Middleware Stack Configuration
const app = express();

// 1. Security Layer (Order Matters)
app.use(requestIdMiddleware);
app.use(requestLoggingMiddleware);
app.use(helmetMiddleware);
app.use(corsMiddleware);
app.use(rateLimitMiddleware);
app.use(securityHeadersMiddleware);

// 2. Body Parsing
app.use(json({ limit: '10mb' }));
app.use(urlencoded({ extended: true, limit: '10mb' }));

// 3. Input Sanitization
app.use(sanitizeInputMiddleware);

// 4. Authentication (Optional)
app.use('/api/protected', authenticateToken);

// 5. Route Mounting
app.use('/api/v1', apiRoutes);

// 6. Error Handling
app.use(notFoundHandler);
app.use(errorHandler);

// Security Middleware Pattern
export const securityHeadersMiddleware = (req: Request, res: Response, next: NextFunction) => {
  res.removeHeader('X-Powered-By');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
};
```

### 3. Bridge Service Pattern

**Pattern Name:** Legacy Integration with Modern Architecture
**Use Case:** Integrating different validation systems and maintaining backward compatibility

**Implementation Template:**
```typescript
// Bridge Service Pattern
export class BridgeService {
  constructor(
    private modernService: IModernService,
    private legacyValidator: ILegacyValidator
  ) {}

  async processRequest(legacyPayload: LegacyPayload): Promise<LegacyResponse> {
    // 1. Legacy validation
    const validatedLegacy = await this.legacyValidator.validate(legacyPayload);
    
    // 2. Transform to modern format
    const modernPayload = this.transformToModern(validatedLegacy);
    
    // 3. Process with modern service
    const modernResponse = await this.modernService.process(modernPayload);
    
    // 4. Transform back to legacy format
    return this.transformToLegacy(modernResponse);
  }

  private transformToModern(legacy: LegacyPayload): ModernPayload {
    // Transformation logic
  }

  private transformToLegacy(modern: ModernResponse): LegacyResponse {
    // Transformation logic
  }
}
```

## Automation Factory Patterns

### 1. Safe MCP Pattern

**Pattern Name:** AI-Safe Automation with Branch Isolation
**Use Case:** Automated development with bulletproof safety mechanisms

**Implementation Template:**
```yaml
# Task Definition Schema
- taskId: "T1-001"
  description: "Task description"
  status: "pending"
  priority: "high|medium|low"
  agent_preference: "aider|copilot"
  estimated_duration: "25-35 minutes"
  files_to_modify:
    - "path/to/file.ts"
  forbidden_files:
    - "critical/infrastructure/*"
  acceptance_criteria:
    - "Specific requirement 1"
    - "Specific requirement 2"
  validation_commands:
    - "npm run build"
    - "npm run test"
  safety_limits:
    max_files_changed: 3
    max_lines_deleted: 50
```

```python
# Safe MCP Implementation Pattern
class SafeMCP:
    def __init__(self, project_root: str):
        self.project_root = project_root
        self.logger = self.setup_logging()

    def execute_task(self, task: Task) -> TaskResult:
        try:
            # 1. Create isolated branch
            branch_name = f"safe-mcp-{task.id}-{int(time.time())}"
            self.create_branch(branch_name)
            
            # 2. Execute AI agent
            result = self.run_agent(task)
            
            # 3. Run validation pipeline ("The Gauntlet")
            validation_result = self.run_gauntlet()
            
            if validation_result.success:
                # 4. Merge to main
                self.merge_branch(branch_name)
                return TaskResult(success=True, branch=branch_name)
            else:
                # 5. Cleanup on failure
                self.cleanup_branch(branch_name)
                return TaskResult(success=False, error=validation_result.error)
                
        except Exception as e:
            self.cleanup_branch(branch_name)
            raise e

    def run_gauntlet(self) -> ValidationResult:
        # Sequential validation with fail-fast
        stages = ['format', 'lint', 'test', 'semantic']
        for stage in stages:
            result = self.run_validation_stage(stage)
            if not result.success:
                return ValidationResult(success=False, failed_stage=stage)
        return ValidationResult(success=True)
```

### 2. GitHub Actions Workflow Pattern

**Pattern Name:** Multi-Stage Automation Pipeline
**Use Case:** CI/CD automation with security and quality gates

**Implementation Template:**
```yaml
# Workflow Template
name: Automated Development Pipeline

on:
  workflow_dispatch:
    inputs:
      task_description:
        description: 'Task for AI agent'
        required: true
        type: string
  schedule:
    - cron: '0 4 * * 1'  # Weekly execution

jobs:
  execute-task:
    runs-on: ubuntu-latest
    if: github.repository == 'owner/repo'  # Security check
    
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4
        with:
          token: ${{ secrets.WORKFLOW_PAT }}
          fetch-depth: 0

      - name: Setup Environment
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install Dependencies
        run: |
          npm install
          pip install -r requirements.txt

      - name: Execute Safe MCP
        run: |
          python scripts/safe_mcp.py --task "${{ inputs.task_description }}"
        env:
          API_KEY: ${{ secrets.API_KEY }}

      - name: Push Changes
        run: git push origin main
```

## Security Patterns

### 1. JWT Authentication Pattern

**Pattern Name:** Stateless Authentication with Refresh Tokens
**Use Case:** Secure API authentication with session management

**Implementation Template:**
```typescript
// JWT Service Pattern
export class JWTService {
  private accessTokenSecret: string;
  private refreshTokenSecret: string;
  private accessTokenExpiry = '15m';
  private refreshTokenExpiry = '7d';

  generateTokens(userId: string): TokenPair {
    const accessToken = jwt.sign(
      { userId, type: 'access' },
      this.accessTokenSecret,
      { expiresIn: this.accessTokenExpiry }
    );

    const refreshToken = jwt.sign(
      { userId, type: 'refresh' },
      this.refreshTokenSecret,
      { expiresIn: this.refreshTokenExpiry }
    );

    return { accessToken, refreshToken };
  }

  verifyAccessToken(token: string): JWTPayload {
    return jwt.verify(token, this.accessTokenSecret) as JWTPayload;
  }

  refreshAccessToken(refreshToken: string): string {
    const payload = jwt.verify(refreshToken, this.refreshTokenSecret) as JWTPayload;
    return jwt.sign(
      { userId: payload.userId, type: 'access' },
      this.accessTokenSecret,
      { expiresIn: this.accessTokenExpiry }
    );
  }
}

// Authentication Middleware Pattern
export const authenticateToken = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  try {
    const payload = jwtService.verifyAccessToken(token);
    req.user = { id: payload.userId };
    next();
  } catch (error) {
    return res.status(403).json({ error: 'Invalid or expired token' });
  }
};
```

### 2. Input Validation and Sanitization Pattern

**Pattern Name:** Multi-Layer Input Validation
**Use Case:** Preventing injection attacks and ensuring data integrity

**Implementation Template:**
```typescript
// Validation Schema Pattern (Joi)
const businessFormationSchema = Joi.object({
  businessName: Joi.string().min(3).max(100).required(),
  businessType: Joi.string().valid('LLC', 'Corporation', 'Partnership').required(),
  address: Joi.object({
    street: Joi.string().required(),
    city: Joi.string().required(),
    state: Joi.string().length(2).required(),
    zipCode: Joi.string().pattern(/^\d{5}(-\d{4})?$/).required()
  }).required()
});

// Validation Middleware Pattern
export const validateBusinessFormation = (req: Request, res: Response, next: NextFunction) => {
  const { error, value } = businessFormationSchema.validate(req.body, {
    abortEarly: false,
    stripUnknown: true
  });

  if (error) {
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }))
    });
  }

  req.body = value;  // Use sanitized data
  next();
};

// Input Sanitization Pattern
export const sanitizeInputMiddleware = (req: Request, res: Response, next: NextFunction) => {
  if (req.body) {
    req.body = sanitizeObject(req.body);
  }
  if (req.query) {
    req.query = sanitizeObject(req.query);
  }
  next();
};

function sanitizeObject(obj: any): any {
  if (typeof obj === 'string') {
    return DOMPurify.sanitize(obj);
  }
  if (Array.isArray(obj)) {
    return obj.map(sanitizeObject);
  }
  if (obj && typeof obj === 'object') {
    const sanitized: any = {};
    for (const [key, value] of Object.entries(obj)) {
      sanitized[key] = sanitizeObject(value);
    }
    return sanitized;
  }
  return obj;
}
```

## Configuration Management Patterns

### 1. Environment Configuration Pattern

**Pattern Name:** Type-Safe Environment Configuration
**Use Case:** Managing environment variables with validation and defaults

**Implementation Template:**
```typescript
// Configuration Schema
interface ServerConfig {
  port: number;
  nodeEnv: 'development' | 'production' | 'test';
  database: {
    path: string;
    maxConnections: number;
  };
  jwt: {
    accessSecret: string;
    refreshSecret: string;
  };
  cors: {
    origin: string[];
    credentials: boolean;
  };
}

// Configuration Loader
export const loadConfig = (): ServerConfig => {
  const config: ServerConfig = {
    port: parseInt(process.env.PORT || '3001'),
    nodeEnv: (process.env.NODE_ENV as any) || 'development',
    database: {
      path: process.env.DATABASE_PATH || './data/ai-catalyst.db',
      maxConnections: parseInt(process.env.DB_MAX_CONNECTIONS || '10')
    },
    jwt: {
      accessSecret: process.env.JWT_ACCESS_SECRET || 'dev-access-secret',
      refreshSecret: process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret'
    },
    cors: {
      origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3000'],
      credentials: process.env.CORS_CREDENTIALS === 'true'
    }
  };

  // Validation
  validateConfig(config);
  return config;
};

function validateConfig(config: ServerConfig): void {
  if (config.nodeEnv === 'production') {
    if (config.jwt.accessSecret === 'dev-access-secret') {
      throw new Error('Production JWT secrets must be set');
    }
  }
}
```

### 2. Secrets Management Pattern

**Pattern Name:** Secure Secret Handling with Rotation
**Use Case:** Managing API keys and sensitive configuration

**Implementation Template:**
```typescript
// Secrets Manager Pattern
export class SecretsManager {
  private secrets: Map<string, string> = new Map();

  async loadSecrets(): Promise<void> {
    // Load from environment variables
    this.secrets.set('openrouter_api_key', process.env.OPENROUTER_API_KEY || '');
    this.secrets.set('docusign_client_id', process.env.DOCUSIGN_CLIENT_ID || '');
    
    // Validate required secrets
    this.validateSecrets();
  }

  getSecret(key: string): string {
    const secret = this.secrets.get(key);
    if (!secret) {
      throw new Error(`Secret '${key}' not found`);
    }
    return secret;
  }

  private validateSecrets(): void {
    const required = ['openrouter_api_key', 'docusign_client_id'];
    for (const key of required) {
      if (!this.secrets.has(key) || !this.secrets.get(key)) {
        throw new Error(`Required secret '${key}' is missing`);
      }
    }
  }

  async rotateSecret(key: string, newValue: string): Promise<void> {
    // Update secret with validation
    this.secrets.set(key, newValue);
    // Optionally persist to secure storage
  }
}
```

## Integration Patterns

### 1. External Service Integration Pattern

**Pattern Name:** Resilient External Service Integration
**Use Case:** Integrating with third-party APIs with fallback and error handling

**Implementation Template:**
```typescript
// Service Integration Pattern
export class ExternalServiceClient {
  private client: AxiosInstance;
  private circuitBreaker: CircuitBreaker;

  constructor(config: ServiceConfig) {
    this.client = axios.create({
      baseURL: config.baseURL,
      timeout: config.timeout || 10000,
      headers: config.defaultHeaders
    });

    this.circuitBreaker = new CircuitBreaker(this.makeRequest.bind(this), {
      timeout: 5000,
      errorThresholdPercentage: 50,
      resetTimeout: 30000
    });

    this.setupInterceptors();
  }

  private setupInterceptors(): void {
    // Request interceptor for authentication
    this.client.interceptors.request.use((config) => {
      config.headers.Authorization = `Bearer ${this.getAuthToken()}`;
      return config;
    });

    // Response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      (error) => this.handleError(error)
    );
  }

  async callService<T>(endpoint: string, data?: any): Promise<T> {
    try {
      const response = await this.circuitBreaker.fire(endpoint, data);
      return response.data;
    } catch (error) {
      // Fallback logic
      return this.handleFallback(endpoint, data, error);
    }
  }

  private async handleFallback<T>(endpoint: string, data: any, error: any): Promise<T> {
    // Implement fallback strategies
    throw new ServiceUnavailableError(`Service unavailable: ${error.message}`);
  }
}
```

### 2. Event-Driven Architecture Pattern

**Pattern Name:** Pub/Sub Event System
**Use Case:** Decoupled communication between system components

**Implementation Template:**
```typescript
// Event System Pattern
interface DomainEvent {
  id: string;
  type: string;
  timestamp: Date;
  payload: any;
  metadata?: Record<string, any>;
}

export class EventBus {
  private handlers: Map<string, Array<(event: DomainEvent) => Promise<void>>> = new Map();

  subscribe(eventType: string, handler: (event: DomainEvent) => Promise<void>): void {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, []);
    }
    this.handlers.get(eventType)!.push(handler);
  }

  async publish(event: DomainEvent): Promise<void> {
    const handlers = this.handlers.get(event.type) || [];

    // Execute handlers in parallel
    await Promise.allSettled(
      handlers.map(handler => handler(event))
    );
  }
}

// Usage Example
const eventBus = new EventBus();

// Subscribe to events
eventBus.subscribe('business.formation.completed', async (event) => {
  await emailService.sendWelcomeEmail(event.payload.userId);
});

eventBus.subscribe('document.signed', async (event) => {
  await workflowService.advanceWorkflow(event.payload.workflowId);
});

// Publish events
await eventBus.publish({
  id: uuid(),
  type: 'business.formation.completed',
  timestamp: new Date(),
  payload: { userId: '123', companyId: '456' }
});
```

## Testing Patterns

### 1. Comprehensive Testing Strategy Pattern

**Pattern Name:** Multi-Layer Testing with Mocks and Fixtures
**Use Case:** Ensuring code quality through comprehensive testing

**Implementation Template:**
```typescript
// Test Setup Pattern
describe('BusinessFormationService', () => {
  let service: BusinessFormationService;
  let mockDb: jest.Mocked<Database>;
  let mockAuditLogger: jest.Mocked<Logger>;

  beforeEach(() => {
    mockDb = createMockDatabase();
    mockAuditLogger = createMockLogger();
    service = new BusinessFormationService(mockDb, mockAuditLogger);
  });

  describe('startFormation', () => {
    it('should create business formation workflow successfully', async () => {
      // Arrange
      const userId = 'user-123';
      const payload = createBusinessFormationPayload();
      mockDb.transaction.mockImplementation(async (callback) => callback());

      // Act
      const result = await service.startFormation(userId, payload);

      // Assert
      expect(result.success).toBe(true);
      expect(result.data.workflowId).toBeDefined();
      expect(mockAuditLogger.info).toHaveBeenCalledWith(
        'Business formation started',
        expect.objectContaining({ userId })
      );
    });

    it('should handle validation errors gracefully', async () => {
      // Arrange
      const userId = 'user-123';
      const invalidPayload = { businessName: '' }; // Invalid

      // Act & Assert
      await expect(service.startFormation(userId, invalidPayload))
        .rejects.toThrow(ValidationError);
    });
  });
});

// Test Fixtures Pattern
export const createBusinessFormationPayload = (): BusinessFormationPayload => ({
  businessName: 'Test LLC',
  businessType: 'LLC',
  address: {
    street: '123 Test St',
    city: 'Austin',
    state: 'TX',
    zipCode: '78701'
  },
  registeredAgent: {
    type: 'self',
    name: 'John Doe'
  }
});
```

### 2. Integration Testing Pattern

**Pattern Name:** API Integration Testing with Test Database
**Use Case:** Testing complete request/response cycles

**Implementation Template:**
```typescript
// Integration Test Pattern
describe('Business Formation API Integration', () => {
  let app: Express;
  let testDb: Database;
  let authToken: string;

  beforeAll(async () => {
    // Setup test environment
    app = createTestApp();
    testDb = await createTestDatabase();
    authToken = await createTestUser();
  });

  afterAll(async () => {
    await cleanupTestDatabase(testDb);
  });

  beforeEach(async () => {
    await resetTestData(testDb);
  });

  it('should complete business formation workflow', async () => {
    // Test complete workflow
    const payload = createBusinessFormationPayload();

    const response = await request(app)
      .post('/api/v1/business/form')
      .set('Authorization', `Bearer ${authToken}`)
      .send(payload)
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data.workflowId).toBeDefined();

    // Verify database state
    const workflow = await testDb.get(
      'SELECT * FROM workflows WHERE id = ?',
      [response.body.data.workflowId]
    );
    expect(workflow).toBeDefined();
    expect(workflow.status).toBe('in_progress');
  });
});
```

## Template Structures

### 1. Project Template Structure

**Template Name:** Automated Development Factory Template
**Use Case:** Starting new projects with AI Catalyst patterns

```
project-root/
├── frontend/                 # React/TypeScript frontend
│   ├── src/
│   │   ├── components/      # Reusable UI components
│   │   ├── store/          # Zustand state management
│   │   ├── services/       # API integration services
│   │   ├── types/          # TypeScript type definitions
│   │   └── utils/          # Utility functions
│   ├── package.json        # Frontend dependencies
│   └── vite.config.ts      # Vite configuration
├── backend/                 # Express.js/TypeScript backend
│   ├── src/
│   │   ├── controllers/    # Request handlers
│   │   ├── services/       # Business logic
│   │   ├── middleware/     # Express middleware
│   │   ├── models/         # Data models
│   │   ├── utils/          # Utility functions
│   │   └── app.ts          # Express application
│   ├── package.json        # Backend dependencies
│   └── tsconfig.json       # TypeScript configuration
├── automation/              # Automation factory
│   ├── scripts/
│   │   ├── safe_mcp.py     # Safe MCP implementation
│   │   └── task_processor.py
│   ├── task_queue.yaml     # Task definitions
│   └── requirements.txt    # Python dependencies
├── .github/
│   ├── workflows/          # GitHub Actions workflows
│   └── dependabot.yml     # Dependency management
├── docs/                   # Documentation
└── README.md              # Project documentation
```

### 2. Configuration Template

**Template Name:** Environment and Deployment Configuration
**Use Case:** Standardized configuration management

```typescript
// config/template.ts
export interface ProjectConfig {
  app: {
    name: string;
    version: string;
    port: number;
    environment: 'development' | 'production' | 'test';
  };
  database: {
    type: 'sqlite' | 'postgresql';
    path?: string;
    url?: string;
    maxConnections: number;
  };
  security: {
    jwtSecret: string;
    corsOrigins: string[];
    rateLimitWindow: number;
    rateLimitMax: number;
  };
  integrations: {
    openai?: { apiKey: string; model: string; };
    docusign?: { clientId: string; clientSecret: string; };
    // Add other integrations as needed
  };
  automation: {
    enabled: boolean;
    schedules: {
      taskProcessor: string;
      securityScan: string;
      dependencyUpdate: string;
    };
  };
}
```

## Customization Guidelines

### 1. Frontend Customization Points

**Wizard Configuration:**
- Phase and step definitions in `wizardStore.ts`
- Validation schemas per step
- UI theme and component styling
- Progress calculation logic

**State Management:**
- Domain-specific state interfaces
- Persistence strategy (localStorage, sessionStorage, etc.)
- State synchronization with backend

### 2. Backend Customization Points

**Service Layer:**
- Business logic implementation
- Database schema and models
- External service integrations
- Validation rules and schemas

**Security Configuration:**
- Authentication strategy (JWT, OAuth, etc.)
- Authorization rules and roles
- Rate limiting and security headers
- Input validation and sanitization

### 3. Automation Customization Points

**Task Management:**
- Task definition schema
- Validation pipeline configuration
- Agent selection and preferences
- Safety limits and constraints

**Workflow Configuration:**
- GitHub Actions triggers and schedules
- Secret management and rotation
- Monitoring and alerting setup
- Deployment and environment management

---

*This comprehensive pattern documentation provides reusable templates and configurations extracted from the AI Catalyst system. Each pattern includes detailed implementation examples, customization points, and integration guidelines for adaptation to other sophisticated automation projects.*
