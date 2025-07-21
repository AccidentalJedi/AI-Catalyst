# AI Catalyst Master Control Program (MCP)

## Overview

The Master Control Program (MCP) is an automated nightly build manager for the AI Catalyst Launch Wizard project. It provides a robust, quality-controlled pipeline for executing AI agent tasks with comprehensive error handling and recovery mechanisms.

## Key Features

- **Sequential Task Processing**: Execute tasks one at a time to prevent cascade failures
- **The Gauntlet Integration**: Comprehensive quality control pipeline with automatic rollback
- **Agent Integration**: Support for Aider and Jules AI coding assistants
- **Git Workflow Management**: Atomic commits with standardized messages
- **Comprehensive Logging**: Detailed logs and markdown reports for debugging
- **Error Recovery**: Automatic cleanup and detailed failure analysis

## Quick Start

### Basic Usage

```bash
# Execute tasks from a file
python mcp_cli.py --task-file tasks.txt --agent aider

# Execute a single task
python mcp_cli.py --single-task "Add user authentication to login component"

# Dry run to preview execution
python mcp_cli.py --task-file tasks.txt --dry-run
```

### Prerequisites

- Python 3.7+
- Git (for version control)
- Node.js and npm (for project builds)
- Aider AI assistant (`pip install aider-chat`)

## Command Line Options

### Required Options (choose one)
- `--task-file, -f`: Path to file containing tasks (one per line)
- `--single-task, -t`: Execute a single task directly

### Optional Configuration
- `--agent, -a`: AI agent to use (`aider` or `jules`, default: `aider`)
- `--project-root, -p`: Project root directory (default: current directory)
- `--skip-gauntlet`: Skip quality control checks (NOT RECOMMENDED)
- `--dry-run`: Show what would be executed without running

### Logging and Output
- `--verbose, -v`: Enable verbose logging
- `--quiet, -q`: Suppress non-essential output
- `--log-file`: Custom log file path

### Timeout Configuration
- `--task-timeout`: Timeout for individual tasks in seconds (default: 1800)
- `--check-timeout`: Timeout for quality checks in seconds (default: 600)

## The Gauntlet Quality Pipeline

Every task execution goes through comprehensive quality checks:

1. **Code Formatting**: `npx prettier --write .`
2. **TypeScript Compilation**: `npm run type-check`
3. **Frontend Linting**: `npm run lint`
4. **Backend Linting**: `npm run server:check`
5. **Frontend Tests**: `npm run test:run`
6. **Backend Tests**: `cd server && npm test`

If any check fails, all changes are automatically reverted.

## Task File Format

Create a `tasks.txt` file with one task per line:

```
# This is a comment
Add user authentication to the login component
Fix TypeScript compilation errors
# Another comment
Implement error handling for file uploads
```

### Task Writing Best Practices

- **Be Specific**: "Add user authentication to login component" vs "improve login"
- **One Objective**: Each task should have a single, clear goal
- **Actionable**: Tasks should be something an AI agent can execute
- **Testable**: Tasks should produce verifiable changes
- **Atomic**: Keep tasks small and focused

## Git Workflow

MCP manages git operations automatically:

- **Standardized Commits**: `feat: [task description] (Task #[number])`
- **Atomic Operations**: Each task gets its own commit
- **Automatic Staging**: All changes are staged before commit
- **Failure Recovery**: Failed quality checks trigger automatic revert

## Error Handling and Recovery

### Automatic Recovery
- Failed quality checks → Automatic git revert
- Agent timeouts → Process termination with cleanup
- Missing dependencies → Clear error messages with solutions

### Manual Recovery
If MCP fails unexpectedly:

```bash
# Check git status
git status

# Revert uncommitted changes if needed
git reset --hard HEAD
git clean -fd

# Check logs for details
cat logs/mcp_build_*.log
```

## Logging and Reports

### Log Files
- Location: `logs/mcp_build_TIMESTAMP.log`
- Contains: Detailed execution logs, error messages, timing information
- Retention: Manual cleanup required

### Build Reports
- Location: `logs/nightly_build_report_TIMESTAMP.md`
- Contains: Summary, completed tasks, failure analysis, next steps
- Format: Markdown for easy reading

## Advanced Usage

### Environment Validation
MCP performs comprehensive pre-flight checks:
- Git repository validation
- Required command availability
- Project structure verification
- Node.js dependencies check

### Custom Configuration
```bash
# Long-running tasks
python mcp_cli.py --task-file tasks.txt --task-timeout 3600

# Verbose debugging
python mcp_cli.py --single-task "Debug payment issue" --verbose

# Custom log location
python mcp_cli.py --task-file tasks.txt --log-file /path/to/custom.log
```

## Troubleshooting

### Common Issues

**"Aider not found in PATH"**
```bash
pip install aider-chat
```

**"Not in a valid git repository"**
```bash
git init
git add .
git commit -m "Initial commit"
```

**"Quality checks failed"**
- Check the specific failed check in logs
- Fix the issue manually
- Re-run MCP

**"Task timeout"**
- Increase timeout with `--task-timeout`
- Break complex tasks into smaller parts
- Check if agent is waiting for input

### Debug Mode
```bash
# Maximum verbosity
python mcp_cli.py --single-task "test task" --verbose

# Skip quality checks for debugging
python mcp_cli.py --single-task "test task" --skip-gauntlet
```

## Integration with AI Catalyst

MCP is specifically designed for the AI Catalyst Launch Wizard project:

- Understands the frontend/backend separation
- Knows about npm scripts and build processes
- Integrates with existing testing infrastructure
- Respects project conventions and structure

## Safety and Best Practices

### Production Use
- Always use quality checks (avoid `--skip-gauntlet`)
- Test tasks individually before batch execution
- Monitor logs during execution
- Keep task files under version control

### Development Use
- Use `--dry-run` to preview execution
- Start with simple tasks to verify setup
- Use verbose logging for debugging
- Keep backups of important work

## Support and Contributing

For issues, questions, or contributions:
1. Check logs for detailed error information
2. Verify all prerequisites are installed
3. Test with simple tasks first
4. Report issues with full log output

---

**Remember**: MCP is designed to prevent cascade failures and maintain code quality. Trust the process, and let the quality checks protect your codebase.
