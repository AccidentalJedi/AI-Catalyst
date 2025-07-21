# AI Catalyst - Workflow Troubleshooting Guide

## 🚨 Common Issues and Solutions

### 1. Safe MCP Automation Failures

#### Issue: "Process completed with exit code 1"
**Symptoms:** Red X in GitHub Actions, workflow fails immediately

**Solutions:**

1. **Check OpenRouter API Key Configuration**
   ```bash
   # Go to GitHub repository → Settings → Secrets and variables → Actions
   # Verify OPENROUTER_API_KEY is properly set
   ```

2. **Verify GitHub CLI Authentication**
   ```bash
   # The workflow should show: "✅ GITHUB_TOKEN available"
   # If not, check repository permissions
   ```

3. **Python Dependencies Issues**
   ```bash
   # Look for: "⚠️ aider-chat installation failed"
   # This is handled gracefully - workflow should continue
   ```

#### Issue: "No pending tasks found"
**Symptoms:** Workflow runs but shows "✅ No pending tasks found"

**Solutions:**
1. Check `task_queue.yaml` - ensure tasks have `status: "pending"`
2. Verify task format matches the expected schema
3. Check if all tasks are already completed

### 2. Security Scan Failures

#### Issue: npm audit failures
**Symptoms:** Security scan fails with "npm audit" errors

**Solutions:**
1. **Update Dependencies**
   ```bash
   npm audit fix
   cd server && npm audit fix
   ```

2. **Review Vulnerability Reports**
   - Check for `frontend-audit.json` and `backend-audit.json` files
   - Review specific vulnerabilities and update packages

3. **Temporary Workaround**
   ```bash
   # For non-critical vulnerabilities, use:
   npm audit --audit-level=high
   ```

### 3. Configuration Issues

#### Missing Secrets
Required secrets in GitHub repository:
- `GITHUB_TOKEN` (automatically provided)
- `OPENROUTER_API_KEY` (must be manually added)

#### Adding OpenRouter API Key
1. Get API key from [OpenRouter.ai](https://openrouter.ai/)
2. Go to GitHub repository → Settings
3. Navigate to "Secrets and variables" → "Actions"
4. Click "New repository secret"
5. Name: `OPENROUTER_API_KEY`
6. Value: Your API key (starts with `sk-or-v1-...`)

### 4. Workflow Permissions

Ensure the workflow has proper permissions:
```yaml
permissions:
  contents: write
  pull-requests: write
  issues: write
```

### 5. Debugging Steps

#### Enable Debug Logging
Add to workflow environment:
```yaml
env:
  ACTIONS_STEP_DEBUG: true
  ACTIONS_RUNNER_DEBUG: true
```

#### Manual Workflow Trigger
1. Go to Actions tab in GitHub
2. Select "Safe MCP 24/7 GitHub Copilot Native Automation"
3. Click "Run workflow"
4. Set parameters for testing

### 6. Model Selection and Costs

#### Cost Optimization
The workflow automatically selects models based on task complexity:
- **Simple tasks**: GitHub Copilot (free)
- **Medium tasks**: Kimi K2 (cost-effective)
- **Complex tasks**: Gemini 2.5 Pro or Claude Sonnet 4

#### Fallback Strategy
1. Primary model selection based on task analysis
2. Fallback to Kimi K2 if primary fails
3. Final fallback to GitHub Copilot native features

### 7. Task Queue Management

#### Task Status Values
- `pending`: Ready for execution
- `in_progress`: Currently being processed
- `completed`: Successfully finished
- `failed`: Execution failed

#### Task Priority
- `high`: VVS tasks, critical features
- `medium`: Standard enhancements
- `low`: Nice-to-have improvements

### 8. Emergency Procedures

#### Stop All Automation
1. Go to repository Settings → Actions → General
2. Disable "Allow all actions and reusable workflows"
3. Or disable specific workflows in Actions tab

#### Rollback Changes
1. Check recent commits for automated changes
2. Use `git revert` for problematic commits
3. Review and merge rollback PR

### 9. Monitoring and Alerts

#### Success Indicators
- ✅ Green checkmarks in Actions tab
- Automated PRs created for completed tasks
- Task status updated to "completed" in task_queue.yaml

#### Failure Indicators
- ❌ Red X marks in Actions tab
- Error messages in workflow logs
- Tasks stuck in "pending" status

### 10. Support and Escalation

#### Self-Service Debugging
1. Check workflow logs in Actions tab
2. Review this troubleshooting guide
3. Verify secrets and permissions
4. Test with manual workflow trigger

#### When to Escalate
- Persistent failures after following this guide
- Security vulnerabilities requiring immediate attention
- Workflow modifications needed for new requirements

## 📞 Quick Reference

### Essential Commands
```bash
# Check workflow status
gh workflow list

# View recent runs
gh run list --workflow="safe-mcp-automation.yml"

# Trigger manual run
gh workflow run safe-mcp-automation.yml

# Check secrets (won't show values)
gh secret list
```

### Important Files
- `.github/workflows/safe-mcp-automation.yml` - Main automation workflow
- `.github/workflows/security-scan.yml` - Security scanning
- `task_queue.yaml` - Task definitions and queue
- `docs/WORKFLOW_TROUBLESHOOTING.md` - This guide

### Status Monitoring
- GitHub Actions tab: Real-time workflow status
- Security tab: Vulnerability reports
- Pull Requests: Automated changes for review

---

**Last Updated:** 2025-07-21
**Version:** 1.0
**Maintainer:** AI Catalyst Team
