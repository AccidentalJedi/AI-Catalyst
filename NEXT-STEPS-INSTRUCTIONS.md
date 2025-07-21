# AI Catalyst Development Workflow - Next Steps Instructions

## 🛡️ **Critical Safety Protocol**

**NEVER use AI tools directly again without the Safe MCP protection system.**

### Jules Incident Summary:
- **Claimed**: "Add tier and veteran_status to users table"  
- **Actually Did**: Deleted 1,100+ lines of detailed service implementations
- **Result**: Complete trust breakdown, required emergency revert to commit cc1bce6f

### Safe MCP Usage:
```bash
# ALWAYS use this instead of direct AI tool calls:
python safe_mcp.py "specific task description"

# NEVER use this again:
aider --yes --message "task"  # ❌ DANGEROUS
```

## 📋 **Prioritized Task List (Based on README Analysis)**

### **TIER 1: Foundation Tasks (Safe for Junior Devs)**
These tasks are isolated and cannot break core functionality:

#### T1.1: Frontend Error Handling Enhancement
- **File**: `src/components/Steps/UserProfileStep.tsx`
- **Task**: "Add comprehensive error handling and user feedback for form validation failures"
- **Expected Changes**: Only this one file
- **Forbidden**: Any service files, database files
- **Safe MCP Command**: 
  ```bash
  python safe_mcp.py "Add error handling to UserProfileStep.tsx form validation"
  ```

#### T1.2: TypeScript Error Resolution
- **Files**: `src/components/Steps/*.tsx`
- **Task**: "Fix TypeScript compilation errors in wizard step components"
- **Expected Changes**: Only frontend component files
- **Forbidden**: Backend services, database schema
- **Safe MCP Command**:
  ```bash
  python safe_mcp.py "Fix TypeScript errors in wizard step components"
  ```

#### T1.3: Form Validation Enhancement
- **File**: `src/components/Steps/BusinessNameStep.tsx`
- **Task**: "Add real-time validation for business name availability checking"
- **Expected Changes**: Single component file
- **Forbidden**: Backend API changes
- **Safe MCP Command**:
  ```bash
  python safe_mcp.py "Add real-time validation to BusinessNameStep.tsx"
  ```

### **TIER 2: Integration Tasks (Require Senior Oversight)**
These tasks touch multiple systems and need careful validation:

#### T2.1: DocuSign API Connection
- **Files**: `server/src/services/docusignService.ts`, `server/src/routes/docusign.ts`
- **Task**: "Connect DocuSign service to actual API endpoints with error handling"
- **Risk Level**: HIGH - External API integration
- **Validation Required**: Manual testing of API calls

#### T2.2: Database Operations Enhancement  
- **Files**: `server/src/services/businessService.ts`, `server/src/utils/database.ts`
- **Task**: "Implement real database operations beyond basic CRUD"
- **Risk Level**: HIGH - Core data operations
- **Validation Required**: Database integrity checks

#### T2.3: Document Generation Pipeline
- **Files**: `server/src/services/documentGenerationService.ts`, `server/src/templates/*.hbs`
- **Task**: "Complete document generation from templates to actual PDF creation"
- **Risk Level**: MEDIUM - File system operations
- **Validation Required**: Generated document verification

### **TIER 3: Critical Infrastructure (Senior Only)**
These tasks affect core system functionality:

#### T3.1: FinCEN BOI Compliance Automation
- **Files**: `server/src/services/boiComplianceService.ts`
- **Task**: "Implement actual FinCEN BOI reporting with March 2025 deadline tracking"
- **Risk Level**: CRITICAL - Legal compliance
- **Validation Required**: Legal review + compliance testing

#### T3.2: Texas Secretary of State Integration
- **Files**: `server/src/services/businessFormationService.ts`
- **Task**: "Connect to Texas SOS API for real business name checking and LLC filing"
- **Risk Level**: CRITICAL - Government API integration
- **Validation Required**: Legal entity verification

## 🔧 **Safe MCP Validation Criteria**

### For Each Task Completion:
1. **File Count Check**: ≤ 3 files changed (unless explicitly documented)
2. **Deletion Check**: ≤ 50 lines deleted (prevents Jules-style destruction)
3. **Forbidden File Check**: No changes to protected service files
4. **Quality Gates**: TypeScript compilation + linting must pass
5. **Functionality Test**: Core features must still work

### Escalation Procedures:
- **Safe MCP Rejects Changes**: STOP, review manually, do not override
- **Quality Checks Fail**: Automatic revert, investigate root cause
- **Unexpected File Changes**: Emergency revert, full audit required
- **Large Deletions Detected**: Immediate halt, manual review

## 🎯 **Recommended Starting Point**

**Start with T1.1 (UserProfileStep error handling)** because:
- ✅ Single file scope
- ✅ Frontend only (no backend risk)
- ✅ Visible improvement
- ✅ Cannot break core functionality
- ✅ Good test of Safe MCP system

### Command to Execute:
```bash
python safe_mcp.py "Add comprehensive error handling and user feedback for form validation failures in UserProfileStep.tsx"
```

### Expected Outcome:
- Enhanced error messages in the user profile form
- Better user experience for validation failures
- No changes to any other files
- All quality checks pass

## 📊 **Progress Tracking**

Create a `DEVELOPMENT-PROGRESS.md` file to track:
- ✅ Completed tasks with commit hashes
- 🔄 In-progress tasks with assigned developers
- ❌ Failed tasks with failure reasons
- 🛡️ Safe MCP protection events

## 🚨 **Emergency Procedures**

If ANY AI tool behaves like Jules:
1. **Immediate**: `git reset --hard HEAD~1`
2. **Verify**: Check that destructive changes are reverted
3. **Document**: Record the incident in project logs
4. **Analyze**: Determine why Safe MCP didn't prevent it
5. **Enhance**: Update Safe MCP protection rules

**Remember: The Safe MCP system exists because AI tools cannot be trusted to self-regulate.**
