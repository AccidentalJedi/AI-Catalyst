# AI Catalyst Nightly Automation Setup

## 🛡️ **Critical Safety First**

**NEVER run AI tools without Safe MCP protection after the Jules incident.**

### Jules Incident Reminder:
- **Claimed**: "Add tier and veteran_status to users table"
- **Actually**: Deleted 1,100+ lines of service implementations
- **Prevention**: Always use `safe_mcp.py` wrapper

## 🔧 **Setup Instructions**

### 1. **Verify Safe MCP is Ready**
```bash
# Check that safe_mcp.py exists
ls -la safe_mcp.py

# Test it works
python safe_mcp.py --help
```

### 2. **Configure Aider for Your GitHub Copilot**
Since you have GitHub Copilot Pro, let's use that instead of expensive OpenRouter:

```bash
# Install GitHub Copilot CLI (if not already installed)
npm install -g @githubnext/github-copilot-cli

# Configure Aider to use GitHub Copilot
export GITHUB_TOKEN="your_github_token"
aider --model github-copilot
```

**Alternative: Use Free Local Model**
```bash
# Install Ollama (free, local)
winget install Ollama.Ollama

# Pull a good coding model
ollama pull deepseek-coder:6.7b

# Configure Aider to use local model
aider --model ollama/deepseek-coder:6.7b
```

### 3. **Create Nightly Task Queue**
Edit `tasks.txt` with safe, incremental tasks:

```bash
# Edit the task file
notepad tasks.txt
```

**Add these safe tasks (one per line):**
```
Add error handling to UserProfileStep.tsx form validation
Fix TypeScript compilation errors in wizard step components  
Add loading states to BusinessNameStep.tsx form submission
Improve error messages in LegalDocumentsStep.tsx
Add input validation to VeteranStatusStep.tsx fields
Fix linting warnings in wizardStore.ts
Add proper TypeScript types to businessFormationApi.ts
Enhance form validation in RegisteredAgentStep.tsx
```

### 4. **Setup Nightly Automation Script**

Create `nightly-automation.bat`:
```batch
@echo off
echo Starting AI Catalyst Nightly Automation...
echo Time: %date% %time%

cd /d "C:\Users\gerry\Documents\augment-projects\AI Catalyst"

echo.
echo ========================================
echo Running Safe MCP Nightly Build
echo ========================================

python safe_mcp.py --task-file tasks.txt --agent aider

echo.
echo ========================================
echo Nightly Automation Complete
echo Check logs/ directory for results
echo ========================================

pause
```

### 5. **Manual Nightly Workflow (Recommended)**

Instead of full automation, use this controlled approach:

#### **Evening Setup (5 minutes):**
```bash
# 1. Review what needs to be done
cat tasks.txt

# 2. Pick ONE safe task for tonight
echo "Add error handling to UserProfileStep.tsx form validation" > tonight-task.txt

# 3. Run the safe task
python safe_mcp.py "Add error handling to UserProfileStep.tsx form validation"
```

#### **Morning Review (2 minutes):**
```bash
# 1. Check what happened
git log --oneline -3

# 2. Review the changes
git show HEAD

# 3. Check the safety log
cat .task-intent.json

# 4. If good, move to next task
# If bad, investigate and improve Safe MCP
```

## 📋 **Safe Task Templates**

### **Frontend Error Handling Tasks:**
```bash
python safe_mcp.py "Add comprehensive error handling to UserProfileStep.tsx form validation"
python safe_mcp.py "Improve error messages and user feedback in BusinessNameStep.tsx"
python safe_mcp.py "Add loading states and error handling to LegalDocumentsStep.tsx"
```

### **TypeScript Improvement Tasks:**
```bash
python safe_mcp.py "Fix TypeScript compilation errors in wizard step components"
python safe_mcp.py "Add proper TypeScript types to businessFormationApi.ts"
python safe_mcp.py "Fix TypeScript warnings in wizardStore.ts"
```

### **Form Validation Tasks:**
```bash
python safe_mcp.py "Add real-time validation to business name field in BusinessNameStep.tsx"
python safe_mcp.py "Enhance form validation in VeteranStatusStep.tsx"
python safe_mcp.py "Add input validation helpers to RegisteredAgentStep.tsx"
```

## 🔍 **Daily Validation Checklist**

After each nightly run, check:

- [ ] **Git History Clean**: Only expected files changed
- [ ] **No Large Deletions**: No files lost significant content
- [ ] **Quality Checks Pass**: TypeScript and linting still work
- [ ] **Functionality Intact**: Core features still work
- [ ] **Safe MCP Logs**: Review `.task-intent.json` for any warnings

## 🚨 **Emergency Procedures**

### If Safe MCP Detects Problems:
```bash
# Safe MCP will automatically revert, but verify:
git status
git log --oneline -3

# If anything looks wrong:
git reset --hard HEAD~1
git clean -fd
```

### If You Find Issues Later:
```bash
# Revert to last known good state
git reset --hard [last-good-commit-hash]

# Update Safe MCP rules to prevent similar issues
# Edit safe_mcp.py to add more protection
```

## 📊 **Progress Tracking**

Create `DAILY-PROGRESS.md` to track:

```markdown
# Daily Progress Log

## 2025-07-21
- ✅ Task: Add error handling to UserProfileStep.tsx
- ✅ Commit: abc123f
- ✅ Safe MCP: No issues detected
- ✅ Quality: All checks passed

## 2025-07-22
- 🔄 Task: Fix TypeScript errors in wizard components
- ⏳ Status: In progress
```

## 🎯 **Recommended Nightly Schedule**

### **Week 1: Frontend Safety**
- Mon: `python safe_mcp.py "Add error handling to UserProfileStep.tsx form validation"`
- Tue: `python safe_mcp.py "Add real-time validation to BusinessNameStep.tsx"`
- Wed: `python safe_mcp.py "Improve error messages in LegalDocumentsStep.tsx"`
- Thu: `python safe_mcp.py "Add loading states to VeteranStatusStep.tsx"`
- Fri: `python safe_mcp.py "Fix TypeScript compilation errors in wizard components"`

### **Week 2: Form Validation**
- Mon: `python safe_mcp.py "Add input validation helpers to RegisteredAgentStep.tsx"`
- Tue: `python safe_mcp.py "Enhance form submission error handling in BusinessVisionStep.tsx"`
- Wed: `python safe_mcp.py "Add loading states to PreferencesStep.tsx form"`
- Thu: `python safe_mcp.py "Improve validation messages in all wizard steps"`
- Fri: `python safe_mcp.py "Add form reset functionality to wizard components"`

### **Week 3: Code Quality**
- Mon: `python safe_mcp.py "Fix linting warnings in wizardStore.ts"`
- Tue: `python safe_mcp.py "Add proper TypeScript types to businessFormationApi.ts"`
- Wed: `python safe_mcp.py "Improve error handling in docusignApi.ts"`
- Thu: `python safe_mcp.py "Add JSDoc comments to wizard components"`
- Fri: `python safe_mcp.py "Clean up unused imports in React components"`

## 🚀 **Quick Start Commands**

### **For Next Thread - Copy These Exact Commands:**

```bash
# 1. Verify Safe MCP is working
python safe_mcp.py --help

# 2. Start with safest task
python safe_mcp.py "Add comprehensive error handling to UserProfileStep.tsx form validation"

# 3. If successful, continue with next safe task
python safe_mcp.py "Fix TypeScript compilation errors in wizard step components"

# 4. Alternative: Use the safe nightly wrapper
python safe-nightly.py --task "Add error handling to UserProfileStep.tsx"
```

## 🔧 **Troubleshooting**

### **Aider Not Working:**
```bash
# Check Aider installation
aider --version

# Reinstall if needed
pip install aider-chat

# Test with simple task
aider --message "Add a comment to README.md"
```

### **Safe MCP Issues:**
```bash
# Test Safe MCP
python safe_mcp.py "Add a comment to README.md"

# Check Python dependencies
python --version  # Should be 3.7+
```

### **Git Issues:**
```bash
# Ensure clean git state
git status
git stash  # If needed
```

## 🎉 **Success Metrics**

Track these weekly:
- ✅ **Tasks Completed**: Number of safe tasks finished
- ✅ **Zero Incidents**: No destructive changes like Jules
- ✅ **Quality Maintained**: All checks still passing
- ✅ **Progress Made**: Visible improvements to the project

**Remember: Slow and safe progress is better than fast and destructive changes.**
