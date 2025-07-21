# AI Catalyst - Automation Setup Guide

## 🚀 Quick Setup for Safe MCP Automation

### Step 1: Get OpenRouter API Key

1. **Visit OpenRouter**
   - Go to [https://openrouter.ai/](https://openrouter.ai/)
   - Sign up for a free account or log in

2. **Create API Key**
   - Navigate to your dashboard
   - Click on "Keys" or "API Keys"
   - Click "Create New Key"
   - Give it a name like "AI-Catalyst-Automation"
   - Copy the key (starts with `sk-or-v1-...`)

3. **Add Credits (Optional)**
   - For cost-effective operation, add $5-10 in credits
   - The automation uses cost-optimized models
   - Estimated cost: $0.10-0.50 per task

### Step 2: Configure GitHub Secrets

1. **Navigate to Repository Settings**
   ```
   https://github.com/AccidentalJedi/AI-Catalyst/settings/secrets/actions
   ```

2. **Add OpenRouter Secret**
   - Click "New repository secret"
   - Name: `OPENROUTER_API_KEY`
   - Value: Paste your OpenRouter API key
   - Click "Add secret"

3. **Verify Existing Secrets**
   - `GITHUB_TOKEN` should be automatically available
   - No other secrets are required for basic operation

### Step 3: Test the Setup

1. **Manual Workflow Trigger**
   - Go to Actions tab: `https://github.com/AccidentalJedi/AI-Catalyst/actions`
   - Select "Safe MCP 24/7 GitHub Copilot Native Automation"
   - Click "Run workflow"
   - Use default settings for first test

2. **Monitor Execution**
   - Watch the workflow progress in real-time
   - Check for green checkmarks ✅
   - Look for any error messages ❌

### Step 4: Verify Task Queue

1. **Check Task Status**
   - Open `task_queue.yaml` in repository
   - Verify tasks have `status: "pending"`
   - Confirm task format is correct

2. **Expected Behavior**
   - Workflow picks up first pending task
   - Creates a new branch for changes
   - Executes the task using AI
   - Creates a PR for review

### Step 5: Review and Merge

1. **Check Pull Requests**
   - Automated PRs will appear for completed tasks
   - Review changes carefully
   - Merge approved changes

2. **Monitor Task Progress**
   - Task status updates to "completed" in `task_queue.yaml`
   - Next task automatically picked up in 30 minutes

## 🔧 Advanced Configuration

### Model Selection Override

Force specific models for testing:
```yaml
# In workflow dispatch inputs
force_model: "openrouter/deepseek/deepseek-chat"  # Most cost-effective
force_model: "openrouter/google/gemini-2.5-pro"   # Best for complex tasks
force_model: "openrouter/anthropic/claude-sonnet-4" # Premium option
```

### Continuous Mode

Enable continuous processing:
```yaml
continuous_mode: true  # Processes all pending tasks
max_tasks: 5          # Limit number of tasks per run
```

### Task Filtering

Process specific task types:
```yaml
task_filter: "VVS"        # Only VVS enhancement tasks
task_filter: "T1-VVS-001" # Specific task ID
```

## 💰 Cost Management

### Expected Costs (per task)
- **Simple UI tasks**: $0.01-0.05 (GitHub Copilot free + minimal API)
- **Medium complexity**: $0.05-0.15 (Kimi K2 model)
- **Complex tasks**: $0.15-0.50 (Gemini Pro or Claude)

### Cost Optimization Features
- Automatic model selection based on task complexity
- Fallback to cheaper models if primary fails
- GitHub Copilot native features used when possible
- Smart caching and prompt optimization

### Budget Monitoring
- Check OpenRouter dashboard for usage
- Set up billing alerts at $10, $25, $50
- Monitor cost per task in workflow logs

## 🛡️ Security Best Practices

### API Key Security
- Never commit API keys to repository
- Use GitHub Secrets for all sensitive data
- Rotate API keys monthly
- Monitor for unauthorized usage

### Workflow Permissions
- Workflows run with minimal required permissions
- All changes go through PR review process
- Automated safety limits prevent destructive changes
- Audit logs track all automation activity

### Code Safety
- Maximum files changed per task: 1-4
- Maximum lines deleted per task: 25-60
- Forbidden file patterns prevent critical changes
- TypeScript compilation required before merge

## 📊 Monitoring Dashboard

### Key Metrics to Watch
1. **Success Rate**: % of tasks completed successfully
2. **Cost per Task**: Average API cost per completed task
3. **Processing Time**: Time from task start to PR creation
4. **Review Time**: Time from PR creation to merge

### Health Indicators
- ✅ Green workflows in Actions tab
- 📈 Steady task completion rate
- 💰 Costs within expected range
- 🔄 Regular PR creation and merging

## 🚨 Troubleshooting Quick Fixes

### Common Issues
1. **"No OpenRouter API key"** → Add `OPENROUTER_API_KEY` secret
2. **"No pending tasks"** → Check `task_queue.yaml` status values
3. **"Aider installation failed"** → Workflow continues with GitHub Copilot
4. **"npm audit failures"** → Run `npm audit fix` locally and commit

### Emergency Stop
```bash
# Disable all workflows temporarily
gh workflow disable safe-mcp-automation.yml
gh workflow disable security-scan.yml

# Re-enable when ready
gh workflow enable safe-mcp-automation.yml
gh workflow enable security-scan.yml
```

## ✅ Setup Checklist

- [ ] OpenRouter account created
- [ ] API key generated and copied
- [ ] `OPENROUTER_API_KEY` added to GitHub Secrets
- [ ] Test workflow run completed successfully
- [ ] Task queue verified and formatted correctly
- [ ] First automated PR created and reviewed
- [ ] Cost monitoring set up in OpenRouter dashboard
- [ ] Team notified of automation activation

## 🎯 Next Steps

1. **Monitor First Week**: Watch automation closely for any issues
2. **Optimize Task Queue**: Add more tasks as confidence builds
3. **Review Costs**: Analyze cost per task and optimize model selection
4. **Scale Up**: Increase task complexity and frequency
5. **Team Training**: Ensure team knows how to review automated PRs

---

**Setup Time**: ~15 minutes
**First Task Completion**: ~30-45 minutes
**Full Automation**: 24/7 operation with 30-minute intervals

For detailed troubleshooting, see `docs/WORKFLOW_TROUBLESHOOTING.md`
