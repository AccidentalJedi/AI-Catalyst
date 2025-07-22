#!/usr/bin/env python3
"""
AI Catalyst - Safe MCP (Master Control Program) Script
The Foreman for AI Workforce Management.
"""

import subprocess
import sys
import argparse
import os
import json
from datetime import datetime

# --- Configuration ---
# Define the sequence of validation commands that form "The Gauntlet".
THE_GAUNTLET = [
    {"name": "Formatting Check", "command": "npm run format"},
    {"name": "Linting Check", "command": "npm run lint"},
    {"name": "Unit Tests", "command": "npm run test"},
]

# Define the AI agent command structure.
# The {task} placeholder will be replaced with the actual task description.
AGENT_COMMAND = 'aider --message "{task}"'
MAIN_BRANCH = "main"
LOG_FILE = "mcp_log.jsonl"

def run_command(name, command, project_root):
    """Runs a command in the shell and checks for errors, capturing output."""
    print(f"--- Running: {name} ---")
    try:
        process = subprocess.run(
            command,
            shell=True,
            check=True,
            cwd=project_root,
            text=True,
            capture_output=True
        )
        print(process.stdout)
        print(f"--- SUCCESS: {name} completed. ---")
        return True, process.stdout, ""
    except subprocess.CalledProcessError as e:
        print(f"--- FAILED: {name} ---")
        print(f"Error running command: {command}")
        print(f"Return Code: {e.returncode}")
        print("\n--- STDOUT ---")
        print(e.stdout)
        print("\n--- STDERR ---")
        print(e.stderr)
        return False, e.stdout, e.stderr

def generate_branch_name(task):
    """Generates a git-friendly branch name from the task description."""
    safe_task = "".join(c if c.isalnum() or c in " -" else "" for c in task).strip()
    branch_name = safe_task.lower().replace(" ", "-")[:50]  # Limit length
    return f"mcp/{branch_name}"

def log_event(log_data, project_root):
    """Appends a JSON object to the log file."""
    logs_dir = os.path.join(project_root, "logs")
    os.makedirs(logs_dir, exist_ok=True)
    log_path = os.path.join(logs_dir, "mcp_log.jsonl")
    with open(log_path, "a") as f:
        f.write(json.dumps(log_data) + "\n")

def cleanup_branch(branch_name, project_root):
    """Switches back to the main branch and deletes the feature branch."""
    print(f"\n--- CLEANUP: Returning to '{MAIN_BRANCH}' and deleting branch '{branch_name}'. ---")
    run_command(f"Switch to {MAIN_BRANCH}", f"git checkout {MAIN_BRANCH}", project_root)
    run_command(f"Delete branch {branch_name}", f"git branch -D {branch_name}", project_root)



def main():
    """Main execution function"""
    parser = argparse.ArgumentParser(
        description="Safe Master Control Program for dispatching AI agents."
    )
    parser.add_argument(
        "--task",
        required=True,
        help="The detailed task description to be given to the AI agent."
    )
    
    args = parser.parse_args()
    # Assume the script is in a 'scripts' directory, so project root is one level up.
    project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
    
    start_time = datetime.utcnow().isoformat() + "Z"
    log_entry = {
        "run_id": f"mcp-{start_time}",
        "task": args.task,
        "start_time": start_time,
        "status": "STARTED",
        "steps": []
    }

    print(f"Operating in project root: {project_root}")

    # 1. Create a new feature branch for the task
    branch_name = generate_branch_name(args.task)
    print(f"\n--- Creating new branch: {branch_name} ---")
    success, out, err = run_command("Create Branch", f"git checkout -b {branch_name}", project_root)
    log_entry["steps"].append({"name": "Create Branch", "success": success, "stdout": out, "stderr": err})
    if not success:
        print("\nFailed to create new branch. Aborting.")
        log_entry.update({"status": "FAILED", "end_time": datetime.utcnow().isoformat() + "Z"})
        log_event(log_entry, project_root)
        sys.exit(1)

    # 2. Dispatch the task to the AI agent
    task_command = AGENT_COMMAND.format(task=args.task)
    success, out, err = run_command("AI Agent Execution", task_command, project_root)
    log_entry["steps"].append({"name": "AI Agent Execution", "success": success, "stdout": out, "stderr": err})
    if not success:
        print("\nAI agent failed to complete the task. Aborting.")
        cleanup_branch(branch_name, project_root)
        log_entry.update({"status": "FAILED", "end_time": datetime.utcnow().isoformat() + "Z"})
        log_event(log_entry, project_root)
        sys.exit(1)

    # 3. Run "The Gauntlet" of validation checks
    print("\n--- Entering The Gauntlet: Validating AI agent's work... ---")
    for step in THE_GAUNTLET:
        success, out, err = run_command(step["name"], step["command"], project_root)
        log_entry["steps"].append({"name": step["name"], "success": success, "stdout": out, "stderr": err})
        if not success:
            print("\nValidation failed. Mission aborted. Branch will be deleted.")
            cleanup_branch(branch_name, project_root)
            log_entry.update({"status": "FAILED", "end_time": datetime.utcnow().isoformat() + "Z"})
            log_event(log_entry, project_root)
            sys.exit(1)

    # 4. If all checks pass, commit the changes to the feature branch
    print("\n--- All checks passed! Committing changes. ---")
    commit_message = f"feat: MCP task completed - {args.task}"
    commit_command = f'git commit -a -m "{commit_message}"'
    success, out, err = run_command("Git Commit", commit_command, project_root)
    log_entry["steps"].append({"name": "Git Commit", "success": success, "stdout": out, "stderr": err})
    if not success:
        print("\nCommit failed. Please check git status manually.")
        cleanup_branch(branch_name, project_root)
        log_entry.update({"status": "FAILED", "end_time": datetime.utcnow().isoformat() + "Z"})
        log_event(log_entry, project_root)
        sys.exit(1)

    # 5. Switch back to the main branch and merge the feature branch
    print(f"\n--- Merging '{branch_name}' into '{MAIN_BRANCH}'. ---")
    run_command(f"Switch to {MAIN_BRANCH}", f"git checkout {MAIN_BRANCH}", project_root)
    success, out, err = run_command(f"Merge {branch_name}", f"git merge --no-ff {branch_name}", project_root)
    log_entry["steps"].append({"name": f"Merge {branch_name}", "success": success, "stdout": out, "stderr": err})
    if not success:
        print(f"\nMerge failed. Please resolve conflicts manually. The feature branch '{branch_name}' has been kept for review.")
        log_entry.update({"status": "FAILED_NEEDS_MANUAL_MERGE", "end_time": datetime.utcnow().isoformat() + "Z"})
        log_event(log_entry, project_root)
        sys.exit(1)

    # 6. Cleanup: Delete the feature branch
    success, out, err = run_command(f"Delete branch {branch_name}", f"git branch -d {branch_name}", project_root)
    log_entry["steps"].append({"name": f"Delete branch {branch_name}", "success": success, "stdout": out, "stderr": err})

    print("\n🎉 MISSION ACCOMPLISHED: Task completed, validated, and committed successfully. 🎉")
    log_entry.update({"status": "SUCCESS", "end_time": datetime.utcnow().isoformat() + "Z"})
    log_event(log_entry, project_root)

if __name__ == "__main__":
    main()
