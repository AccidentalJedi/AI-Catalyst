#!/usr/bin/env python3
"""
AI Catalyst Master Control Program (MCP)
Automated Nightly Build Manager

This script implements the "Command and Control Architecture" for managing
AI agent tasks with proper governance and quality control.

Based on PROJECT_GOVERNANCE.md principles:
- Every task runs through "The Gauntlet" (automated quality checks)
- Single task execution with immediate validation
- Cascade failure prevention through early termination
- Comprehensive logging and error reporting

Usage:
    python mcp_cli.py --task-file tasks.txt --agent aider
    python mcp_cli.py --single-task "Add user authentication to login component"
    python mcp_cli.py --help
"""

import argparse
import subprocess
import sys
import json
import time
import logging
from pathlib import Path
from datetime import datetime
from typing import List, Dict, Optional, Tuple
import os
import shutil

class MCPManager:
    """Master Control Program for AI Catalyst development automation."""

    def __init__(self, project_root: str = ".", task_timeout: int = 1800,
                 check_timeout: int = 600, verbose: bool = False,
                 quiet: bool = False, log_file: Optional[str] = None,
                 skip_gauntlet: bool = False):
        self.project_root = Path(project_root).resolve()
        self.log_dir = self.project_root / "logs"
        self.log_dir.mkdir(exist_ok=True)

        # Configuration
        self.task_timeout = task_timeout
        self.check_timeout = check_timeout
        self.verbose = verbose
        self.quiet = quiet
        self.skip_gauntlet = skip_gauntlet
        self.custom_log_file = log_file

        # Setup logging
        self.setup_logging()
        
        # Quality control commands (The Gauntlet)
        self.gauntlet_checks = [
            {
                "name": "Code Formatting",
                "command": ["npx", "prettier", "--write", "."],
                "description": "Format all code with Prettier"
            },
            {
                "name": "TypeScript Compilation", 
                "command": ["npm", "run", "type-check"],
                "description": "Check TypeScript compilation"
            },
            {
                "name": "Frontend Linting",
                "command": ["npm", "run", "lint"],
                "description": "Run ESLint on frontend code"
            },
            {
                "name": "Backend Linting",
                "command": ["npm", "run", "server:check"],
                "description": "Run backend code checks",
                "cwd": "server"
            },
            {
                "name": "Frontend Tests",
                "command": ["npm", "run", "test:run"],
                "description": "Run frontend test suite"
            },
            {
                "name": "Backend Tests", 
                "command": ["npm", "test"],
                "description": "Run backend test suite",
                "cwd": "server"
            }
        ]
        
    def setup_logging(self):
        """Configure comprehensive logging for MCP operations."""
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")

        # Use custom log file if provided, otherwise generate default
        if self.custom_log_file:
            log_file = Path(self.custom_log_file)
            log_file.parent.mkdir(parents=True, exist_ok=True)
        else:
            log_file = self.log_dir / f"mcp_build_{timestamp}.log"

        # Configure logging level based on verbosity
        if self.verbose:
            log_level = logging.DEBUG
        elif self.quiet:
            log_level = logging.WARNING
        else:
            log_level = logging.INFO

        # Setup handlers
        handlers = [logging.FileHandler(log_file)]
        if not self.quiet:
            handlers.append(logging.StreamHandler(sys.stdout))

        # Enhanced logging format with more context
        formatter = logging.Formatter(
            '%(asctime)s - %(name)s - %(levelname)s - [%(funcName)s:%(lineno)d] - %(message)s',
            datefmt='%Y-%m-%d %H:%M:%S'
        )

        # Configure handlers with custom formatter
        for handler in handlers:
            handler.setFormatter(formatter)
            handler.setLevel(log_level)

        # Configure root logger
        logging.basicConfig(
            level=log_level,
            handlers=handlers,
            force=True  # Override any existing configuration
        )

        self.logger = logging.getLogger(__name__)

        # Log startup information
        self.logger.info("=" * 80)
        self.logger.info("AI CATALYST MASTER CONTROL PROGRAM INITIALIZED")
        self.logger.info("=" * 80)
        self.logger.info(f"Project Root: {self.project_root}")
        self.logger.info(f"Log File: {log_file}")
        self.logger.info(f"Log Level: {logging.getLevelName(log_level)}")
        self.logger.info(f"Configuration:")
        self.logger.info(f"  - Task Timeout: {self.task_timeout}s")
        self.logger.info(f"  - Check Timeout: {self.check_timeout}s")
        self.logger.info(f"  - Skip Gauntlet: {self.skip_gauntlet}")
        self.logger.info(f"  - Verbose Mode: {self.verbose}")
        self.logger.info(f"  - Quiet Mode: {self.quiet}")
        self.logger.info("-" * 80)

    def handle_critical_error(self, error_type: str, error_msg: str,
                             recovery_actions: List[str] = None) -> None:
        """Handle critical errors with structured logging and recovery guidance."""
        self.logger.critical(f"CRITICAL ERROR - {error_type}: {error_msg}")

        if recovery_actions:
            self.logger.critical("Recommended recovery actions:")
            for i, action in enumerate(recovery_actions, 1):
                self.logger.critical(f"  {i}. {action}")

        # Attempt automatic cleanup if in a git repository
        if self.check_git_repository():
            status = self.get_git_status()
            if not status['is_clean']:
                self.logger.critical("Repository has uncommitted changes - consider running git reset --hard HEAD")

    def validate_environment(self) -> Tuple[bool, List[str]]:
        """Validate the environment and dependencies before execution."""
        issues = []

        # Check git repository
        if not self.check_git_repository():
            issues.append("Not in a valid git repository")

        # Check required commands
        required_commands = ['git', 'npm', 'node']
        for cmd in required_commands:
            if not shutil.which(cmd):
                issues.append(f"Required command not found: {cmd}")

        # Check project structure
        package_json = self.project_root / "package.json"
        if not package_json.exists():
            issues.append("package.json not found in project root")

        server_dir = self.project_root / "server"
        if not server_dir.exists():
            issues.append("server directory not found")

        server_package_json = server_dir / "package.json"
        if not server_package_json.exists():
            issues.append("server/package.json not found")

        # Check node_modules
        node_modules = self.project_root / "node_modules"
        if not node_modules.exists():
            issues.append("node_modules not found - run 'npm install'")

        server_node_modules = server_dir / "node_modules"
        if not server_node_modules.exists():
            issues.append("server/node_modules not found - run 'cd server && npm install'")

        return len(issues) == 0, issues
        
    def load_tasks(self, task_file: str) -> List[str]:
        """Load tasks from file with comprehensive validation and error handling."""
        task_path = Path(task_file)

        # Validate file existence and accessibility
        if not task_path.exists():
            self.logger.error(f"Task file not found: {task_file}")
            return []

        if not task_path.is_file():
            self.logger.error(f"Task file path is not a file: {task_file}")
            return []

        try:
            with open(task_path, 'r', encoding='utf-8') as f:
                lines = f.readlines()
        except PermissionError:
            self.logger.error(f"Permission denied reading task file: {task_file}")
            return []
        except UnicodeDecodeError as e:
            self.logger.error(f"Invalid UTF-8 encoding in task file: {task_file} - {e}")
            return []
        except Exception as e:
            self.logger.error(f"Error reading task file: {task_file} - {e}")
            return []

        # Parse tasks with detailed validation
        tasks = []
        skipped_lines = []

        for line_num, line in enumerate(lines, 1):
            original_line = line
            line = line.strip()

            # Skip empty lines
            if not line:
                continue

            # Skip comment lines (starting with #)
            if line.startswith('#'):
                skipped_lines.append(f"Line {line_num}: Comment")
                continue

            # Skip lines that are only whitespace or special characters
            if not line.replace(' ', '').replace('\t', ''):
                skipped_lines.append(f"Line {line_num}: Empty/whitespace only")
                continue

            # Validate task length
            if len(line) > 500:
                self.logger.warning(f"Task on line {line_num} is very long ({len(line)} chars): {line[:50]}...")

            # Add valid task
            tasks.append(line)

        # Log parsing results
        self.logger.info(f"Task file parsing complete: {task_file}")
        self.logger.info(f"  - Total lines: {len(lines)}")
        self.logger.info(f"  - Valid tasks: {len(tasks)}")
        self.logger.info(f"  - Skipped lines: {len(skipped_lines)}")

        if self.verbose and skipped_lines:
            self.logger.debug("Skipped lines details:")
            for skip_info in skipped_lines:
                self.logger.debug(f"  - {skip_info}")

        if not tasks:
            self.logger.error("No valid tasks found in task file")
            return []

        # Log first few tasks for verification
        self.logger.info("Loaded tasks:")
        for i, task in enumerate(tasks[:3], 1):
            self.logger.info(f"  {i}. {task}")
        if len(tasks) > 3:
            self.logger.info(f"  ... and {len(tasks) - 3} more tasks")

        return tasks
        
    def execute_agent_task(self, task: str, agent: str = "aider") -> Tuple[bool, str]:
        """Execute a single task using the specified AI agent with comprehensive error handling."""
        self.logger.info(f"Executing task with {agent}: {task}")

        # Validate agent availability
        if agent == "aider":
            if not shutil.which("aider"):
                error_msg = "Aider not found in PATH. Install with: pip install aider-chat"
                self.handle_critical_error("Agent Not Found", error_msg, [
                    "Install aider: pip install aider-chat",
                    "Ensure aider is in your PATH",
                    "Try using --agent jules if available"
                ])
                return False, error_msg
            cmd = ["aider", "--yes", "--message", task]
        elif agent == "jules":
            # Placeholder for Jules integration
            jules_script = self.project_root / "jules_cli.py"
            if not jules_script.exists():
                error_msg = "Jules CLI script not found: jules_cli.py"
                self.handle_critical_error("Agent Not Found", error_msg, [
                    "Create jules_cli.py script",
                    "Use --agent aider instead",
                    "Check agent documentation"
                ])
                return False, error_msg
            cmd = ["python", "jules_cli.py", "--task", task]
        else:
            error_msg = f"Unknown agent: {agent}. Available agents: aider, jules"
            self.logger.error(error_msg)
            return False, error_msg

        # Pre-execution validation
        initial_status = self.get_git_status()
        self.logger.debug(f"Pre-execution git status: {initial_status}")

        try:
            self.logger.info(f"Starting agent execution: {' '.join(cmd[:3])}...")
            start_time = time.time()

            result = subprocess.run(
                cmd,
                cwd=self.project_root,
                capture_output=True,
                text=True,
                timeout=self.task_timeout
            )

            execution_time = time.time() - start_time
            self.logger.info(f"Agent execution completed in {execution_time:.1f} seconds")

            if result.returncode == 0:
                self.logger.info(f"[SUCCESS] Agent task completed successfully")

                # Log changes made by agent
                final_status = self.get_git_status()
                if final_status['has_changes']:
                    self.logger.info(f"Agent made changes to {len(final_status['staged_files']) + len(final_status['unstaged_files'])} files")
                else:
                    self.logger.warning("Agent completed but made no file changes")

                return True, result.stdout
            else:
                error_msg = f"Agent failed with exit code {result.returncode}"
                if result.stderr:
                    error_msg += f": {result.stderr}"

                self.handle_critical_error("Agent Execution Failed", error_msg, [
                    "Check agent logs for detailed error information",
                    "Verify task description is clear and actionable",
                    "Ensure all required dependencies are installed",
                    "Try running the task manually to debug"
                ])
                return False, error_msg

        except subprocess.TimeoutExpired:
            error_msg = f"Agent task timed out after {self.task_timeout} seconds"
            self.handle_critical_error("Agent Timeout", error_msg, [
                f"Increase timeout with --task-timeout (current: {self.task_timeout}s)",
                "Break down complex tasks into smaller parts",
                "Check if agent is stuck waiting for input",
                "Monitor system resources during execution"
            ])
            return False, error_msg
        except FileNotFoundError as e:
            error_msg = f"Agent command not found: {e}"
            self.handle_critical_error("Command Not Found", error_msg, [
                f"Install {agent} agent",
                "Check PATH environment variable",
                "Verify agent installation"
            ])
            return False, error_msg
        except Exception as e:
            error_msg = f"Unexpected agent execution error: {str(e)}"
            self.handle_critical_error("Unexpected Error", error_msg, [
                "Check system logs for more details",
                "Verify system resources (disk space, memory)",
                "Try restarting the MCP process",
                "Report this error if it persists"
            ])
            return False, error_msg
            
    def run_gauntlet(self) -> Tuple[bool, List[Dict]]:
        """Run all quality control checks (The Gauntlet)."""
        self.logger.info("Running The Gauntlet - Quality Control Checks")
        results = []
        
        for check in self.gauntlet_checks:
            self.logger.info(f"Running: {check['name']}")
            
            cwd = self.project_root
            if 'cwd' in check:
                cwd = self.project_root / check['cwd']
                
            try:
                result = subprocess.run(
                    check['command'],
                    cwd=cwd,
                    capture_output=True,
                    text=True,
                    timeout=self.check_timeout
                )
                
                check_result = {
                    'name': check['name'],
                    'passed': result.returncode == 0,
                    'output': result.stdout,
                    'error': result.stderr,
                    'description': check['description']
                }
                
                results.append(check_result)
                
                if result.returncode == 0:
                    self.logger.info(f"[PASS] {check['name']} - PASSED")
                else:
                    self.logger.error(f"[FAIL] {check['name']} - FAILED")
                    self.logger.error(f"Error: {result.stderr}")
                    return False, results
                    
            except subprocess.TimeoutExpired:
                self.logger.error(f"❌ {check['name']} - TIMEOUT")
                results.append({
                    'name': check['name'],
                    'passed': False,
                    'error': f'Timeout after {self.check_timeout} seconds',
                    'description': check['description']
                })
                return False, results
            except Exception as e:
                self.logger.error(f"❌ {check['name']} - ERROR: {str(e)}")
                results.append({
                    'name': check['name'],
                    'passed': False,
                    'error': str(e),
                    'description': check['description']
                })
                return False, results
                
        self.logger.info("[SUCCESS] All Gauntlet checks passed!")
        return True, results

    def check_git_repository(self) -> bool:
        """Verify that we're in a valid git repository."""
        try:
            result = subprocess.run(
                ["git", "rev-parse", "--git-dir"],
                cwd=self.project_root,
                capture_output=True,
                text=True,
                timeout=10
            )
            return result.returncode == 0
        except Exception as e:
            self.logger.error(f"Git repository check failed: {e}")
            return False

    def get_git_status(self) -> Dict[str, any]:
        """Get detailed git repository status."""
        status_info = {
            'has_changes': False,
            'staged_files': [],
            'unstaged_files': [],
            'untracked_files': [],
            'current_branch': None,
            'is_clean': True
        }

        try:
            # Get current branch
            result = subprocess.run(
                ["git", "branch", "--show-current"],
                cwd=self.project_root,
                capture_output=True,
                text=True,
                timeout=10
            )
            if result.returncode == 0:
                status_info['current_branch'] = result.stdout.strip()

            # Get status information
            result = subprocess.run(
                ["git", "status", "--porcelain"],
                cwd=self.project_root,
                capture_output=True,
                text=True,
                timeout=10
            )

            if result.returncode == 0:
                lines = result.stdout.strip().split('\n') if result.stdout.strip() else []
                for line in lines:
                    if len(line) >= 2:
                        status_code = line[:2]
                        filename = line[3:]

                        if status_code[0] != ' ':  # Staged changes
                            status_info['staged_files'].append(filename)
                        if status_code[1] != ' ':  # Unstaged changes
                            status_info['unstaged_files'].append(filename)
                        if status_code == '??':  # Untracked files
                            status_info['untracked_files'].append(filename)

                status_info['has_changes'] = bool(lines)
                status_info['is_clean'] = not bool(lines)

        except Exception as e:
            self.logger.error(f"Failed to get git status: {e}")

        return status_info

    def create_commit(self, task: str, task_number: int) -> bool:
        """Create a standardized git commit with comprehensive error handling."""
        if not self.check_git_repository():
            self.logger.error("Not in a valid git repository")
            return False

        commit_message = f"feat: {task} (Task #{task_number})"

        # Truncate commit message if too long (git has limits)
        if len(commit_message) > 72:
            truncated_task = task[:50] + "..." if len(task) > 50 else task
            commit_message = f"feat: {truncated_task} (Task #{task_number})"

        try:
            # Get initial status
            initial_status = self.get_git_status()
            self.logger.debug(f"Initial git status: {initial_status}")

            # Stage all changes
            self.logger.info("Staging all changes...")
            result = subprocess.run(
                ["git", "add", "."],
                cwd=self.project_root,
                capture_output=True,
                text=True,
                timeout=30
            )

            if result.returncode != 0:
                self.logger.error(f"Failed to stage changes: {result.stderr}")
                return False

            # Check if there are changes to commit
            result = subprocess.run(
                ["git", "diff", "--cached", "--quiet"],
                cwd=self.project_root,
                capture_output=True,
                timeout=10
            )

            if result.returncode == 0:
                self.logger.info("No changes to commit")
                return True

            # Get list of staged files for logging
            result = subprocess.run(
                ["git", "diff", "--cached", "--name-only"],
                cwd=self.project_root,
                capture_output=True,
                text=True,
                timeout=10
            )

            if result.returncode == 0:
                staged_files = result.stdout.strip().split('\n') if result.stdout.strip() else []
                self.logger.info(f"Staged files ({len(staged_files)}): {', '.join(staged_files[:5])}")
                if len(staged_files) > 5:
                    self.logger.info(f"... and {len(staged_files) - 5} more files")

            # Create commit
            self.logger.info(f"Creating commit: {commit_message}")
            result = subprocess.run(
                ["git", "commit", "-m", commit_message],
                cwd=self.project_root,
                capture_output=True,
                text=True,
                timeout=30
            )

            if result.returncode != 0:
                self.logger.error(f"Failed to create commit: {result.stderr}")
                return False

            self.logger.info(f"[SUCCESS] Created commit: {commit_message}")

            # Get commit hash for verification
            result = subprocess.run(
                ["git", "rev-parse", "HEAD"],
                cwd=self.project_root,
                capture_output=True,
                text=True,
                timeout=10
            )

            if result.returncode == 0:
                commit_hash = result.stdout.strip()[:8]
                self.logger.info(f"Commit hash: {commit_hash}")

            return True

        except subprocess.TimeoutExpired:
            self.logger.error("Git operation timed out")
            return False
        except subprocess.CalledProcessError as e:
            self.logger.error(f"Git command failed: {e}")
            return False
        except Exception as e:
            self.logger.error(f"Unexpected error during commit: {e}")
            return False

    def revert_changes(self) -> bool:
        """Revert all uncommitted changes with comprehensive cleanup."""
        if not self.check_git_repository():
            self.logger.error("Not in a valid git repository - cannot revert changes")
            return False

        try:
            # Get status before revert for logging
            status = self.get_git_status()
            if status['is_clean']:
                self.logger.info("Repository is already clean - no changes to revert")
                return True

            self.logger.warning("⚠️ Reverting all uncommitted changes...")

            # Log what will be reverted
            if status['staged_files']:
                self.logger.warning(f"Reverting staged files: {', '.join(status['staged_files'][:5])}")
            if status['unstaged_files']:
                self.logger.warning(f"Reverting unstaged files: {', '.join(status['unstaged_files'][:5])}")
            if status['untracked_files']:
                self.logger.warning(f"Removing untracked files: {', '.join(status['untracked_files'][:5])}")

            # Reset staged and unstaged changes
            result = subprocess.run(
                ["git", "reset", "--hard", "HEAD"],
                cwd=self.project_root,
                capture_output=True,
                text=True,
                timeout=30
            )

            if result.returncode != 0:
                self.logger.error(f"Failed to reset changes: {result.stderr}")
                return False

            # Clean untracked files and directories
            result = subprocess.run(
                ["git", "clean", "-fd"],
                cwd=self.project_root,
                capture_output=True,
                text=True,
                timeout=30
            )

            if result.returncode != 0:
                self.logger.error(f"Failed to clean untracked files: {result.stderr}")
                return False

            # Verify the revert was successful
            final_status = self.get_git_status()
            if final_status['is_clean']:
                self.logger.info("[SUCCESS] Successfully reverted all changes")
                return True
            else:
                self.logger.error("[FAIL] Repository still has changes after revert attempt")
                return False

        except subprocess.TimeoutExpired:
            self.logger.error("Git revert operation timed out")
            return False
        except subprocess.CalledProcessError as e:
            self.logger.error(f"Git revert command failed: {e}")
            return False
        except Exception as e:
            self.logger.error(f"Unexpected error during revert: {e}")
            return False

    def generate_report(self, completed_tasks: List[Dict], failed_task: Optional[Dict] = None) -> str:
        """Generate a comprehensive build report."""
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        report_file = self.log_dir / f"nightly_build_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.md"

        report_content = f"""# AI Catalyst Nightly Build Report
Generated: {timestamp}

## Summary
- **Completed Tasks**: {len(completed_tasks)}
- **Status**: {'❌ FAILED' if failed_task else '✅ SUCCESS'}

## Completed Tasks
"""

        for i, task in enumerate(completed_tasks, 1):
            report_content += f"{i}. ✅ {task['task']} (Commit: {task['commit_hash']})\n"

        if failed_task:
            report_content += f"""
## Failed Task
**Task**: {failed_task['task']}
**Error**: {failed_task['error']}
**Failed Check**: {failed_task.get('failed_check', 'Agent execution')}

### Gauntlet Results
"""
            for check in failed_task.get('gauntlet_results', []):
                status = "✅ PASSED" if check['passed'] else "❌ FAILED"
                report_content += f"- {check['name']}: {status}\n"
                if not check['passed'] and check.get('error'):
                    report_content += f"  Error: {check['error']}\n"

        report_content += f"""
## Next Steps
{'Fix the failed task and re-run MCP' if failed_task else 'All tasks completed successfully!'}

---
Generated by AI Catalyst Master Control Program
"""

        with open(report_file, 'w', encoding='utf-8') as f:
            f.write(report_content)

        self.logger.info(f"📊 Report generated: {report_file}")
        return str(report_file)

    def run_nightly_build(self, tasks: List[str], agent: str = "aider") -> bool:
        """Execute the complete nightly build process with comprehensive validation."""
        self.logger.info(f"🚀 Starting nightly build with {len(tasks)} tasks")

        # Pre-flight checks
        self.logger.info("Running pre-flight checks...")
        env_valid, env_issues = self.validate_environment()

        if not env_valid:
            self.handle_critical_error("Environment Validation Failed",
                                     "Pre-flight checks failed", env_issues)
            return False

        self.logger.info("[SUCCESS] Pre-flight checks passed")
        completed_tasks = []

        for i, task in enumerate(tasks, 1):
            self.logger.info(f"📋 Task {i}/{len(tasks)}: {task}")

            # Step 1: Execute agent task
            success, output = self.execute_agent_task(task, agent)
            if not success:
                failed_task = {
                    'task': task,
                    'error': output,
                    'task_number': i
                }
                self.generate_report(completed_tasks, failed_task)
                return False

            # Step 2: Run The Gauntlet (unless skipped)
            if not self.skip_gauntlet:
                gauntlet_passed, gauntlet_results = self.run_gauntlet()
                if not gauntlet_passed:
                    self.revert_changes()
                    failed_task = {
                        'task': task,
                        'error': 'Quality control checks failed',
                        'failed_check': next(r['name'] for r in gauntlet_results if not r['passed']),
                        'gauntlet_results': gauntlet_results,
                        'task_number': i
                    }
                    self.generate_report(completed_tasks, failed_task)
                    return False
            else:
                self.logger.warning("⚠️ Skipping quality control checks (--skip-gauntlet enabled)")
                gauntlet_results = []

            # Step 3: Create commit
            if not self.create_commit(task, i):
                self.revert_changes()
                failed_task = {
                    'task': task,
                    'error': 'Failed to create git commit',
                    'task_number': i
                }
                self.generate_report(completed_tasks, failed_task)
                return False

            # Get commit hash for reporting
            result = subprocess.run(
                ["git", "rev-parse", "HEAD"],
                cwd=self.project_root,
                capture_output=True,
                text=True
            )
            commit_hash = result.stdout.strip()[:8] if result.returncode == 0 else "unknown"

            completed_tasks.append({
                'task': task,
                'commit_hash': commit_hash,
                'task_number': i
            })

            self.logger.info(f"[SUCCESS] Task {i} completed successfully")

        # Generate success report
        self.generate_report(completed_tasks)
        self.logger.info(f"[SUCCESS] Nightly build completed successfully! {len(tasks)} tasks completed.")
        return True

def create_argument_parser() -> argparse.ArgumentParser:
    """Create and configure the command-line argument parser."""
    parser = argparse.ArgumentParser(
        prog='mcp_cli.py',
        description='AI Catalyst Master Control Program - Automated Nightly Build Manager',
        epilog='''
Examples:
  %(prog)s --task-file tasks.txt --agent aider
  %(prog)s --single-task "Add user authentication to login component"
  %(prog)s --task-file my_tasks.txt --agent jules --project-root /path/to/project
  %(prog)s --single-task "Fix bug in payment processing" --verbose
        ''',
        formatter_class=argparse.RawDescriptionHelpFormatter
    )

    # Task input options (mutually exclusive)
    task_group = parser.add_mutually_exclusive_group(required=True)
    task_group.add_argument(
        '--task-file', '-f',
        type=str,
        help='Path to file containing tasks (one per line). Comments start with #.'
    )
    task_group.add_argument(
        '--single-task', '-t',
        type=str,
        help='Execute a single task directly from command line'
    )

    # Agent selection
    parser.add_argument(
        '--agent', '-a',
        type=str,
        choices=['aider', 'jules'],
        default='aider',
        help='AI agent to use for task execution (default: aider)'
    )

    # Project configuration
    parser.add_argument(
        '--project-root', '-p',
        type=str,
        default='.',
        help='Root directory of the project (default: current directory)'
    )

    # Execution options
    parser.add_argument(
        '--skip-gauntlet',
        action='store_true',
        help='Skip quality control checks (NOT RECOMMENDED for production)'
    )
    parser.add_argument(
        '--dry-run',
        action='store_true',
        help='Show what would be executed without actually running tasks'
    )

    # Logging and output
    parser.add_argument(
        '--verbose', '-v',
        action='store_true',
        help='Enable verbose logging output'
    )
    parser.add_argument(
        '--quiet', '-q',
        action='store_true',
        help='Suppress non-essential output'
    )
    parser.add_argument(
        '--log-file',
        type=str,
        help='Custom log file path (default: logs/mcp_build_TIMESTAMP.log)'
    )

    # Timeout configuration
    parser.add_argument(
        '--task-timeout',
        type=int,
        default=1800,
        help='Timeout for individual tasks in seconds (default: 1800 = 30 minutes)'
    )
    parser.add_argument(
        '--check-timeout',
        type=int,
        default=600,
        help='Timeout for quality checks in seconds (default: 600 = 10 minutes)'
    )

    # Version information
    parser.add_argument(
        '--version',
        action='version',
        version='AI Catalyst MCP v1.0.0'
    )

    return parser

def check_system_requirements() -> Tuple[bool, List[str]]:
    """Check system requirements and provide detailed diagnostics."""
    issues = []

    # Check Python version
    python_version = sys.version_info
    if python_version < (3, 7):
        issues.append(f"Python 3.7+ required, found {python_version.major}.{python_version.minor}")

    # Check available disk space
    try:
        import shutil
        total, used, free = shutil.disk_usage(Path.cwd())
        free_gb = free // (1024**3)
        if free_gb < 1:
            issues.append(f"Low disk space: {free_gb}GB free (recommend 1GB+)")
    except Exception:
        pass  # Non-critical check

    return len(issues) == 0, issues

def validate_arguments(args: argparse.Namespace) -> bool:
    """Validate command-line arguments and check dependencies with enhanced diagnostics."""
    errors = []
    warnings = []

    # System requirements check
    sys_ok, sys_issues = check_system_requirements()
    if not sys_ok:
        errors.extend(sys_issues)

    # Validate project root
    project_root = Path(args.project_root).resolve()
    if not project_root.exists():
        errors.append(f"Project root does not exist: {project_root}")
    elif not project_root.is_dir():
        errors.append(f"Project root is not a directory: {project_root}")
    else:
        # Check if it looks like an AI Catalyst project
        package_json = project_root / "package.json"
        if package_json.exists():
            try:
                with open(package_json) as f:
                    pkg_data = json.load(f)
                    if pkg_data.get("name") != "ai-catalyst-launch-wizard":
                        warnings.append("Project may not be AI Catalyst Launch Wizard")
            except Exception:
                warnings.append("Could not read package.json")
        else:
            warnings.append("No package.json found in project root")

    # Validate task file if provided
    if args.task_file:
        task_file = Path(args.task_file)
        if not task_file.exists():
            errors.append(f"Task file does not exist: {task_file}")
        elif not task_file.is_file():
            errors.append(f"Task file is not a file: {task_file}")
        else:
            # Check if task file is readable and has content
            try:
                with open(task_file, 'r') as f:
                    content = f.read().strip()
                    if not content:
                        warnings.append("Task file appears to be empty")
                    elif len(content.split('\n')) > 100:
                        warnings.append(f"Task file has {len(content.split())} lines - consider breaking into smaller batches")
            except Exception as e:
                errors.append(f"Cannot read task file: {e}")

    # Validate mutually exclusive options
    if args.verbose and args.quiet:
        errors.append("Cannot use both --verbose and --quiet options")

    # Validate timeout values
    if args.task_timeout <= 0:
        errors.append("Task timeout must be positive")
    elif args.task_timeout < 300:
        warnings.append(f"Task timeout is very short ({args.task_timeout}s) - consider 1800s+")
    elif args.task_timeout > 7200:
        warnings.append(f"Task timeout is very long ({args.task_timeout}s) - consider shorter timeouts")

    if args.check_timeout <= 0:
        errors.append("Check timeout must be positive")
    elif args.check_timeout < 60:
        warnings.append(f"Check timeout is very short ({args.check_timeout}s) - consider 600s+")

    # Check for required dependencies with detailed diagnostics
    required_commands = ['git', 'npm', 'node']
    if args.agent == 'aider' and not args.skip_gauntlet:
        required_commands.append('aider')

    for cmd in required_commands:
        cmd_path = shutil.which(cmd)
        if not cmd_path:
            errors.append(f"Required command not found in PATH: {cmd}")
        else:
            # Try to get version information
            try:
                if cmd == 'node':
                    result = subprocess.run([cmd, '--version'], capture_output=True, text=True, timeout=5)
                    if result.returncode == 0:
                        version = result.stdout.strip()
                        print(f"✓ {cmd}: {version} ({cmd_path})")
                elif cmd == 'npm':
                    result = subprocess.run([cmd, '--version'], capture_output=True, text=True, timeout=5)
                    if result.returncode == 0:
                        version = result.stdout.strip()
                        print(f"✓ {cmd}: v{version} ({cmd_path})")
                elif cmd == 'git':
                    result = subprocess.run([cmd, '--version'], capture_output=True, text=True, timeout=5)
                    if result.returncode == 0:
                        version = result.stdout.strip()
                        print(f"✓ {cmd}: {version} ({cmd_path})")
                elif cmd == 'aider':
                    result = subprocess.run([cmd, '--version'], capture_output=True, text=True, timeout=5)
                    if result.returncode == 0:
                        version = result.stdout.strip()
                        print(f"✓ {cmd}: {version} ({cmd_path})")
            except Exception:
                print(f"✓ {cmd}: found at {cmd_path}")

    # Display warnings
    if warnings:
        print("⚠️ Warnings:", file=sys.stderr)
        for warning in warnings:
            print(f"  - {warning}", file=sys.stderr)

    # Display errors
    if errors:
        print("❌ Validation errors:", file=sys.stderr)
        for error in errors:
            print(f"  - {error}", file=sys.stderr)
        return False

    return True

def main():
    """Main entry point for the MCP CLI."""
    parser = create_argument_parser()
    args = parser.parse_args()

    # Validate arguments and dependencies
    if not validate_arguments(args):
        sys.exit(1)

    try:
        # Initialize MCP Manager with configuration
        mcp = MCPManager(
            project_root=args.project_root,
            task_timeout=args.task_timeout,
            check_timeout=args.check_timeout,
            verbose=args.verbose,
            quiet=args.quiet,
            log_file=args.log_file,
            skip_gauntlet=args.skip_gauntlet
        )

        # Determine tasks to execute
        if args.task_file:
            tasks = mcp.load_tasks(args.task_file)
            if not tasks:
                print("❌ No valid tasks found in task file", file=sys.stderr)
                sys.exit(1)
        else:
            tasks = [args.single_task]

        # Handle dry run mode
        if args.dry_run:
            print("🔍 DRY RUN MODE - Tasks that would be executed:")
            for i, task in enumerate(tasks, 1):
                print(f"  {i}. {task}")
            print(f"\nAgent: {args.agent}")
            print(f"Project Root: {Path(args.project_root).resolve()}")
            print(f"Skip Gauntlet: {args.skip_gauntlet}")
            return

        # Execute the nightly build process
        success = mcp.run_nightly_build(tasks, args.agent)

        if success:
            print("[SUCCESS] MCP execution completed successfully!")
            sys.exit(0)
        else:
            print("[FAIL] MCP execution failed. Check logs for details.")
            sys.exit(1)

    except KeyboardInterrupt:
        print("\n⚠️ MCP execution interrupted by user")
        sys.exit(130)  # Standard exit code for SIGINT
    except Exception as e:
        print(f"💥 Unexpected error: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()
