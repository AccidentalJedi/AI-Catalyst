# AI Catalyst - Safe MCP System Documentation

## 🤖 **Complete AI Workforce Management System**

The Safe MCP (Model Context Protocol) system provides comprehensive automation for the AI Catalyst project with built-in safety mechanisms, quality validation, and intelligent task management.

## 🏗️ **System Architecture**

### **Core Components**

1. **`safe_mcp.py`** - The Foreman
   - Central safety engine for all AI operations
   - Implements "The Gauntlet" validation pipeline
   - Provides snapshot/rollback capabilities
   - Structured JSON logging for performance analysis

2. **Three GitHub Actions Workflows**
   - `safe-mcp-automation.yml` - Manual task dispatch
   - `dependabot-auto-merge.yml` - Automated dependency management
   - `vvs-task-queue.yml` - Systematic task queue processing

3. **Supporting Infrastructure**
   - `requirements.txt` - Python dependencies
   - `vvs_task_queue.txt` - VVS enhancement tasks
   - `.aider.conf.yml` - AI agent configuration
   - `.aider.model.settings.yml` - 3-tier model strategy

## 🛡️ **The Gauntlet - Quality Validation Pipeline**

Every AI-generated change must pass through "The Gauntlet":

1. **Formatting Check** - `npm run format`
2. **Linting Check** - `npm run lint` 
3. **Unit Tests** - `npm run test`

**Failure at any stage = Automatic rollback**

## 🔄 **Workflow Details**

### **1. Manual Dispatch Workflow** (`safe-mcp-automation.yml`)

**Purpose**: Direct command interface for specific tasks

**Trigger**: Manual workflow dispatch with task description

**Process**:
1. Checkout repository with full history
2. Setup Node.js 20 and Python 3.11
3. Install all dependencies
4. Configure git user for commits
5. Execute `safe_mcp.py` with task
6. Push changes if successful

**Usage**:
```bash
# Via GitHub UI: Actions → Safe MCP Manual Task Dispatch
# Input: "Implement user authentication for veteran profiles"
```

### **2. Dependabot Auto-Merge Workflow** (`dependabot-auto-merge.yml`)

**Purpose**: Automated dependency updates with safety validation

**Trigger**: Dependabot pull requests

**Process**:
1. Only runs on Dependabot PRs targeting main branch
2. Checkout PR code
3. Install dependencies
4. Run The Gauntlet (format, lint, test)
5. Auto-merge if all checks pass

**Safety**: Treats dependency updates like intern work - allowed but validated

### **3. VVS Task Queue Processor** (`vvs-task-queue.yml`)

**Purpose**: Systematic processing of enhancement backlog

**Trigger**: 
- Manual dispatch
- Scheduled: Every Monday at 4 AM UTC

**Process**:
1. Check if `vvs_task_queue.txt` has tasks
2. Setup environment if tasks exist
3. Process first task from queue
4. Remove completed task from queue
5. Commit progress

**Queue Management**: First-in-first-out processing with automatic queue updates

## 📋 **Current VVS Task Queue**

The system includes 15 enhancement tasks:

1. Enhanced veteran verification with fraud detection
2. Advanced grant discovery with friction scoring
3. Two-stage grant matching (rule-based + LLM)
4. Document processing with OCR and NLP
5. Comprehensive audit logging
6. Real-time grant monitoring
7. Analytics dashboard
8. Secure API endpoints
9. FinCEN BOI compliance automation
10. Intelligent document categorization
11. Comprehensive testing suite
12. Advanced search and filtering
13. Grant application status tracking
14. Enhanced security measures
15. Error handling and recovery

## 🔧 **Setup Requirements**

### **GitHub Secrets**
- `WORKFLOW_PAT` - Personal Access Token for workflow operations
- `OPENROUTER_API_KEY` - API key for AI model access

### **Local Dependencies**
- Node.js 20+
- Python 3.11+
- Git configured
- Aider installed (`pip install aider-chat`)

## 📊 **Monitoring and Logging**

### **Structured Logging**
All executions logged to `logs/mcp_log.jsonl`:
```json
{
  "timestamp": "2025-01-22T10:30:00",
  "task_id": "20250122_103000",
  "task_description": "Implement feature X",
  "ai_execution": {...},
  "gauntlet_passed": true,
  "overall_success": true,
  "execution_time_seconds": 45.2
}
```

### **Performance Analysis**
- Track AI agent performance over time
- Identify patterns in successful vs failed tasks
- Optimize model selection based on task complexity

## 🚀 **Usage Examples**

### **Manual Task Execution**
```bash
# Local testing
python scripts/safe_mcp.py --task "Add user authentication to veteran profiles"

# Via GitHub Actions
# Go to Actions → Safe MCP Manual Task Dispatch → Run workflow
```

### **Queue Management**
```bash
# Add task to queue
echo "New enhancement task" >> vvs_task_queue.txt

# Check queue status
head -5 vvs_task_queue.txt

# Manual queue processing
# Go to Actions → VVS Task Queue Processor → Run workflow
```

## 🔒 **Safety Features**

1. **Pre-execution Snapshots**: Git stash before each task
2. **Automatic Rollback**: Restore on any failure
3. **Repository Protection**: Only runs on correct repository
4. **Quality Gates**: The Gauntlet prevents bad code
5. **Structured Logging**: Full audit trail
6. **Anti-regression**: Protects against Jules AI incidents

## 🎯 **Benefits**

- **24/7 Automation**: Continuous development without human oversight
- **Quality Assurance**: Every change validated before commit
- **Cost Optimization**: 3-tier model strategy for efficiency
- **Scalability**: Independent workflow management
- **Transparency**: Complete audit trail and logging
- **Safety**: Multiple layers of protection against failures

## 🔄 **Continuous Improvement**

The system learns from each execution:
- Performance metrics guide model selection
- Failed tasks inform safety improvements
- Success patterns optimize workflow efficiency
- Structured logs enable data-driven decisions

This creates a self-improving AI workforce management system that gets better over time while maintaining strict safety standards.
