# AI Catalyst MCP - Quick Reference

## Essential Commands

```bash
# Execute single task
python mcp_cli.py --single-task "Your task description"

# Execute tasks from file
python mcp_cli.py --task-file tasks.txt

# Dry run (preview only)
python mcp_cli.py --task-file tasks.txt --dry-run

# Verbose output for debugging
python mcp_cli.py --single-task "Debug task" --verbose

# Skip quality checks (NOT RECOMMENDED)
python mcp_cli.py --single-task "Quick test" --skip-gauntlet
```

## Task File Format

```
# This is a comment
Add user authentication to login component
Fix TypeScript compilation errors
# Another comment
Implement error handling for file uploads
```

## The Gauntlet Quality Checks

1. **Code Formatting**: `npx prettier --write .`
2. **TypeScript Compilation**: `npm run type-check`
3. **Frontend Linting**: `npm run lint`
4. **Backend Linting**: `npm run server:check`
5. **Frontend Tests**: `npm run test:run`
6. **Backend Tests**: `cd server && npm test`

## Common Options

| Option | Description | Example |
|--------|-------------|---------|
| `--agent` | Choose AI agent (aider/jules) | `--agent aider` |
| `--task-timeout` | Task timeout in seconds | `--task-timeout 3600` |
| `--check-timeout` | Quality check timeout | `--check-timeout 1200` |
| `--verbose` | Enable debug logging | `--verbose` |
| `--quiet` | Suppress output | `--quiet` |
| `--log-file` | Custom log file | `--log-file custom.log` |

## Troubleshooting

### "Aider not found"
```bash
pip install aider-chat
```

### "Not in git repository"
```bash
git init
git add .
git commit -m "Initial commit"
```

### "Quality checks failed"
- Check specific failed check in logs
- Fix the issue manually
- Re-run MCP

### "Task timeout"
```bash
# Increase timeout
python mcp_cli.py --single-task "Long task" --task-timeout 3600

# Or break into smaller tasks
```

## File Locations

- **Logs**: `logs/mcp_build_TIMESTAMP.log`
- **Reports**: `logs/nightly_build_report_TIMESTAMP.md`
- **Tasks**: `tasks.txt` (create your own)

## Git Workflow

- Each task = One commit
- Format: `feat: [task description] (Task #[number])`
- Failed quality checks = Automatic revert
- All changes staged automatically

## Best Practices

1. **Start Small**: Test with simple tasks first
2. **Use Dry Run**: Preview execution with `--dry-run`
3. **Monitor Logs**: Check logs for detailed information
4. **Quality First**: Don't skip gauntlet checks in production
5. **Clear Tasks**: Write specific, actionable task descriptions

## Emergency Recovery

```bash
# Check git status
git status

# Revert uncommitted changes
git reset --hard HEAD
git clean -fd

# Check MCP logs
cat logs/mcp_build_*.log
```

## Integration with AI Catalyst

MCP is specifically designed for the AI Catalyst Launch Wizard:
- Understands frontend/backend separation
- Knows npm scripts and build processes
- Integrates with existing testing infrastructure
- Respects project conventions

## Quick Start Checklist

- [ ] Python 3.7+ installed
- [ ] Git repository initialized
- [ ] Node.js and npm available
- [ ] Aider installed (`pip install aider-chat`)
- [ ] AI Catalyst project structure present
- [ ] Test with `--dry-run` first

## Support

For issues:
1. Check logs for detailed errors
2. Verify all prerequisites
3. Test with simple tasks
4. Use `--verbose` for debugging

---

**Remember**: MCP prevents cascade failures and maintains code quality. Trust the process!
