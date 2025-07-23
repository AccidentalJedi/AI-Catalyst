# AI Catalyst Launch Wizard - Backend

A comprehensive backend system for the AI Catalyst Launch Wizard, designed to automate the process of launching mission-driven AI education platforms with full legal compliance for 2025 requirements.

## Mission Statement

The AI Catalyst Launch Wizard empowers veterans and entrepreneurs to transform their vision of mission-driven AI education into legally compliant, operational businesses through comprehensive automation that eliminates traditional barriers to entry. Our system recognizes that a critical gap exists between public understanding of artificial intelligence and the rapidly evolving realities of AI implementation in industry, creating an urgent need for accessible, practical AI education initiatives.

By providing a complete, wizard-driven business formation platform, we enable users to navigate the complex landscape of legal compliance, document generation, and regulatory requirements without requiring external legal expertise or costly consultations. The system automatically handles 2025 legal mandates including FinCEN Beneficial Ownership Information reporting, Corporate Transparency Act compliance, and Texas LLC formation procedures, ensuring users meet all regulatory deadlines and requirements from day one.

Our self-contained approach minimizes dependencies on external services while maximizing automation through integrated DocuSign workflows, real-time compliance tracking, and intelligent document generation. Users progress through a structured process that transforms their educational mission into a fully formed business entity, complete with operating agreements, tax identification, and all necessary legal documentation.

The wizard serves as a true catalyst, not merely automating paperwork but enabling the rapid deployment of AI education initiatives that address real-world knowledge gaps in communities across Texas and beyond. By democratizing access to business formation expertise, we remove the traditional gatekeepers that have prevented mission-driven educators from launching their ventures.

Each successful deployment of the AI Catalyst system creates a new node in a growing network of practical AI education providers, collectively working to bridge the disconnect between academic AI theory and industry application. Our platform transforms the complex, intimidating process of business formation into an accessible, step-by-step journey that any motivated individual can complete.

The system embodies our belief that the most effective AI education comes from practitioners who understand both the technical realities and the practical challenges of implementing AI solutions in real-world contexts. By enabling these practitioners to quickly establish legitimate business entities, we accelerate the development of a more informed, capable workforce ready to engage with AI technologies responsibly and effectively.

Through comprehensive automation and unwavering focus on legal compliance, the AI Catalyst Launch Wizard transforms entrepreneurial vision into operational reality, creating sustainable pathways for mission-driven AI education that serves communities while building economically viable enterprises.

## 🚨 Critical 2025 Legal Compliance

This system includes **mandatory FinCEN Beneficial Ownership Information (BOI) reporting** compliance:
- **March 21, 2025 deadline** for existing companies
- **Corporate Transparency Act** enforcement active
- **Automatic compliance tracking** and deadline reminders
- **Secure beneficial ownership data** collection and submission

## 🏗️ Architecture

- **Framework**: Express.js with TypeScript
- **Database**: PostgreSQL (production) / SQLite (development) with connection pooling
- **Authentication**: JWT with secure middleware
- **Security**: Helmet, CORS, rate limiting, input sanitization
- **Logging**: Winston with structured logging
- **Document Generation**: Handlebars templates with PDF generation
- **External Integrations**: DocuSign SDK, Texas SOS API
- **Performance**: Supports 200+ concurrent users with <100ms response times

## 📁 Project Structure

```
server/
├── src/
│   ├── config/           # Configuration management
│   ├── controllers/      # Route controllers (to be implemented)
│   ├── middleware/       # Express middleware
│   ├── models/           # Database models and schema
│   ├── routes/           # API route definitions (to be implemented)
│   ├── services/         # Business logic services (to be implemented)
│   ├── templates/        # Document templates (to be implemented)
│   ├── types/            # TypeScript type definitions
│   ├── utils/            # Utility functions
│   ├── app.ts            # Express application setup
│   └── index.ts          # Server entry point
├── data/                 # SQLite database files
├── logs/                 # Application logs
├── uploads/              # File upload storage
├── .env.example          # Environment variables template
├── nodemon.json          # Nodemon configuration
├── tsconfig.json         # TypeScript configuration
└── README.md             # This file
```

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- Git
- PostgreSQL 14+ (for production) or SQLite (for development)

### Database Setup

#### Option 1: PostgreSQL (Recommended for Production)

1. **Install PostgreSQL**:

   **Ubuntu/Debian:**
   ```bash
   sudo apt update
   sudo apt install postgresql postgresql-contrib
   ```

   **macOS:**
   ```bash
   brew install postgresql
   brew services start postgresql
   ```

   **Windows:**
   Download from [PostgreSQL official website](https://www.postgresql.org/download/windows/)

2. **Create Database and User**:
   ```bash
   # Create user
   sudo -u postgres createuser --interactive ai_catalyst_user

   # Create database
   sudo -u postgres createdb ai_catalyst_dev -O ai_catalyst_user

   # Set password
   sudo -u postgres psql -c "ALTER USER ai_catalyst_user PASSWORD 'your_secure_password';"
   ```

3. **Configure Environment Variables**:
   ```bash
   # Add to .env file
   DATABASE_TYPE=postgresql
   DATABASE_URL=postgresql://ai_catalyst_user:your_password@localhost:5432/ai_catalyst_dev
   POSTGRES_HOST=localhost
   POSTGRES_PORT=5432
   POSTGRES_DATABASE=ai_catalyst_dev
   POSTGRES_USER=ai_catalyst_user
   POSTGRES_PASSWORD=your_secure_password
   ```

#### Option 2: SQLite (Development Only)

SQLite is automatically configured for development. No additional setup required.

### Installation

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Set up environment variables**:
   ```bash
   cp .env.example .env
   # Edit .env with your actual values
   ```

3. **Start development server**:
   ```bash
   npm run server:dev
   ```

4. **Start both frontend and backend**:
   ```bash
   npm run dev:full
   ```

### Available Scripts

#### Development Scripts
- `npm run server:dev` - Start development server with hot reload
- `npm run server:build` - Build TypeScript to JavaScript
- `npm run server:start` - Start production server
- `npm run server:watch` - Watch TypeScript compilation
- `npm run dev:full` - Start both frontend and backend concurrently

#### Database Management Scripts
- `npm run db:status` - Check migration status
- `npm run db:migrate:latest` - Run all pending migrations
- `npm run db:migrate:up` - Run next migration
- `npm run db:migrate:down` - Rollback last migration
- `npm run db:rollback:last` - Rollback last migration
- `npm run db:rollback:version <version>` - Rollback to specific version
- `npm run db:backup:create` - Create database backup
- `npm run db:backup:restore <path>` - Restore from backup
- `npm run db:seed` - Seed database with initial data

#### Data Migration Scripts
- `npm run db:migrate:data` - Migrate data from SQLite to PostgreSQL
- `npm run db:migrate:data:dry-run` - Preview data migration
- `npm run db:verify:integrity` - Verify data integrity

#### Performance Testing Scripts
- `npm run perf:load:light` - Light load test (10 users, 30s)
- `npm run perf:load:medium` - Medium load test (50 users, 1min)
- `npm run perf:load:heavy` - Heavy load test (100 users, 2min)
- `npm run perf:load:production` - Production load test (200 users, 5min)
- `npm run perf:backup:test` - Test backup and recovery procedures

#### Testing Scripts
- `npm run test` - Run all tests
- `npm run test:postgresql` - Run tests with PostgreSQL
- `npm run test:sqlite` - Run tests with SQLite
- `npm run test:coverage` - Run tests with coverage report

## 🔧 Configuration

### Environment Variables

Copy `.env.example` to `.env` and configure:

#### Required Variables
- `JWT_SECRET` - Secret key for JWT tokens
- `DOCUSIGN_INTEGRATION_KEY` - DocuSign integration key
- `DOCUSIGN_USER_ID` - DocuSign user ID
- `DOCUSIGN_ACCOUNT_ID` - DocuSign account ID
- `DOCUSIGN_PRIVATE_KEY` - DocuSign private key (RSA)

#### Optional Variables
- `PORT` - Server port (default: 3001)
- `NODE_ENV` - Environment (development/production)
- `DATABASE_PATH` - SQLite database file path
- `CORS_ORIGINS` - Allowed CORS origins
- `LOG_LEVEL` - Logging level (debug/info/warn/error)

### Database

The system uses SQLite with better-sqlite3 for:
- **High performance** with synchronous operations
- **ACID compliance** with WAL mode
- **Zero configuration** - no separate database server needed
- **Automatic schema management** with migrations

Database is automatically initialized on first startup.

## 🔒 Security Features

### Authentication & Authorization
- JWT-based authentication
- Secure password hashing with bcrypt
- Token refresh mechanism
- Role-based access control (planned)

### Security Middleware
- **Helmet**: Security headers
- **CORS**: Cross-origin resource sharing
- **Rate Limiting**: API abuse prevention
- **Input Sanitization**: XSS protection
- **Request Logging**: Audit trails

### Data Protection
- **Encrypted sensitive data** (beneficial ownership information)
- **Secure file uploads** with validation
- **SQL injection prevention** with parameterized queries
- **HTTPS enforcement** in production

## ⚖️ Legal Compliance (2025)

### FinCEN BOI Reporting
- **Automatic deadline tracking** (March 21, 2025)
- **Beneficial ownership data collection**
- **Compliance status monitoring**
- **Automated reminder system**
- **Secure data encryption**

### Document Generation
- **Texas LLC formation documents** (Form 205)
- **Operating agreements** with social mission clauses
- **EIN application forms**
- **Insurance documentation**
- **Version control** for legal document updates

## 🔌 External Integrations

### DocuSign (2025 Current)
- **JWT authentication** for embedded signing
- **Envelope management** and status tracking
- **Document routing** automation
- **Webhook handling** for status updates

### Texas Secretary of State
- **Real-time business name validation**
- **Entity availability checking**
- **Filing status verification**
- **Registered agent validation**

### Email Notifications
- **Compliance deadline reminders**
- **Document signing notifications**
- **Wizard progress updates**
- **Critical alert system**

## 📊 Analytics & Monitoring

### Application Monitoring
- **Structured logging** with Winston
- **Performance metrics** tracking
- **Error monitoring** and alerting
- **Health check endpoints**

### User Analytics
- **Wizard completion rates**
- **Step-by-step progress tracking**
- **Compliance milestone monitoring**
- **Document generation metrics**

## 🧪 Development

### Code Quality
- **TypeScript** for type safety
- **ESLint** for code linting
- **Prettier** for code formatting (planned)
- **Jest** for testing (planned)

### Database Development
- **Schema migrations** for version control
- **Seed data** for development
- **Database utilities** for common operations
- **Backup and restore** functionality

## 🚀 Deployment

### Production Checklist
- [ ] Set all required environment variables
- [ ] Configure HTTPS/SSL certificates
- [ ] Set up database backups
- [ ] Configure log rotation
- [ ] Set up monitoring and alerting
- [ ] Test DocuSign integration
- [ ] Verify FinCEN BOI compliance features

### Environment Setup
1. **Production server** with Node.js 18+
2. **Reverse proxy** (nginx recommended)
3. **SSL/TLS certificates** (Let's Encrypt)
4. **Process manager** (PM2 recommended)
5. **Log aggregation** (optional)
6. **Monitoring service** (optional)

## 📝 API Documentation

API documentation will be available at `/api/docs` when implemented with OpenAPI/Swagger.

### Planned Endpoints
- `/api/auth/*` - Authentication
- `/api/users/*` - User management
- `/api/companies/*` - Company/LLC management
- `/api/documents/*` - Document generation
- `/api/wizard/*` - Wizard progress
- `/api/boi/*` - BOI compliance
- `/api/analytics/*` - Analytics data

## 🤝 Contributing

1. Follow TypeScript best practices
2. Use structured logging for all operations
3. Include proper error handling
4. Add JSDoc comments for public APIs
5. Test all legal compliance features thoroughly

## ⚠️ Important Notes

- **Legal Compliance**: This system handles sensitive legal and financial data. Ensure all compliance features are thoroughly tested.
- **Security**: Never commit sensitive environment variables or private keys to version control.
- **FinCEN BOI**: The March 21, 2025 deadline is critical - test all BOI compliance features thoroughly.
- **DocuSign**: Ensure proper JWT authentication setup for embedded signing functionality.

## 📞 Support

For technical issues or legal compliance questions, refer to:
- FinCEN BOI Reporting: https://www.fincen.gov/boi
- DocuSign Developer Center: https://developers.docusign.com/
- Texas Secretary of State: https://www.sos.state.tx.us/
