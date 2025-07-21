#!/usr/bin/env python3
"""
Safe Nightly Automation for AI Catalyst
Integrates Safe MCP protection with existing MCP system
"""

import sys
import subprocess
import argparse
from pathlib import Path

def main():
    """Safe wrapper for nightly automation."""
    parser = argparse.ArgumentParser(description="AI Catalyst Safe Nightly Automation")
    parser.add_argument("--task", help="Single task to execute safely")
    parser.add_argument("--task-file", default="tasks.txt", help="File containing tasks")
    parser.add_argument("--dry-run", action="store_true", help="Show what would be done")
    
    args = parser.parse_args()
    
    print("🛡️ AI Catalyst Safe Nightly Automation")
    print("   Protection against destructive AI behavior (Jules incident prevention)")
    print()
    
    if args.dry_run:
        print("🔍 DRY RUN MODE")
        if args.task:
            print(f"Would execute: {args.task}")
        else:
            print(f"Would process tasks from: {args.task_file}")
        return
    
    if args.task:
        # Execute single task with Safe MCP
        print(f"🤖 Executing single task with Safe MCP protection:")
        print(f"   Task: {args.task}")
        
        result = subprocess.run([
            "python", "safe_mcp.py", args.task
        ])
        
        if result.returncode == 0:
            print("✅ Task completed successfully!")
        else:
            print("❌ Task failed or was reverted by Safe MCP")
        
        sys.exit(result.returncode)
    
    else:
        # Process task file - execute one task at a time with Safe MCP
        task_file = Path(args.task_file)
        
        if not task_file.exists():
            print(f"❌ Task file not found: {args.task_file}")
            sys.exit(1)
        
        # Read tasks from file
        with open(task_file, 'r') as f:
            tasks = [line.strip() for line in f if line.strip() and not line.startswith('#')]
        
        if not tasks:
            print(f"❌ No valid tasks found in {args.task_file}")
            sys.exit(1)
        
        print(f"📋 Found {len(tasks)} tasks in {args.task_file}")
        print("   Executing one task with Safe MCP protection...")
        print()
        
        # Execute first task only (safe approach)
        task = tasks[0]
        print(f"🤖 Executing: {task}")
        
        result = subprocess.run([
            "python", "safe_mcp.py", task
        ])
        
        if result.returncode == 0:
            print("✅ Task completed successfully!")
            print()
            print("📝 To continue with next task:")
            print(f"   Remove completed task from {args.task_file}")
            print(f"   Run: python safe-nightly.py --task-file {args.task_file}")
        else:
            print("❌ Task failed or was reverted by Safe MCP")
            print("   Check logs and fix issues before continuing")
        
        sys.exit(result.returncode)

if __name__ == "__main__":
    main()
