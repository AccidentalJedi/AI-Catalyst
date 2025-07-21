#!/usr/bin/env python3
"""
Safe Master Control Program (Safe MCP)
Anti-Jules Protection System

This wrapper around MCP adds comprehensive validation to prevent
destructive changes like Jules made.
"""

import subprocess
import sys
import json
import time
import os
from pathlib import Path
from datetime import datetime
from typing import List, Dict, Optional

class SafeMCP:
    def __init__(self, project_root: str = "."):
        self.project_root = Path(project_root).resolve()
        self.snapshot_id = None
        self.task_intent = {}
        
    def create_safety_snapshot(self, task_description: str) -> str:
        """Create a safety snapshot before any task execution."""
        timestamp = int(time.time())
        snapshot_id = f"SAFE-SNAPSHOT-{timestamp}"
        
        # Create git stash with descriptive message
        result = subprocess.run([
            "git", "stash", "push", "-m", f"{snapshot_id}: {task_description}"
        ], cwd=self.project_root, capture_output=True, text=True)
        
        if result.returncode != 0:
            print(f"⚠️ Warning: Could not create git stash: {result.stderr}")
        
        self.snapshot_id = snapshot_id
        return snapshot_id
    
    def document_task_intent(self, task: str, expected_files: List[str], 
                           forbidden_files: List[str] = None) -> None:
        """Document what we expect this task to do."""
        self.task_intent = {
            "task": task,
            "timestamp": datetime.now().isoformat(),
            "expected_files": expected_files,
            "forbidden_files": forbidden_files or [],
            "snapshot_id": self.snapshot_id
        }
        
        # Write intent file
        intent_file = self.project_root / ".task-intent.json"
        with open(intent_file, 'w') as f:
            json.dump(self.task_intent, f, indent=2)
        
        print(f"📋 Task Intent Documented:")
        print(f"   Task: {task}")
        print(f"   Expected files: {', '.join(expected_files)}")
        if forbidden_files:
            print(f"   Forbidden files: {', '.join(forbidden_files)}")
    
    def validate_changes(self) -> bool:
        """Validate that changes match our expectations."""
        print("\n🔍 Validating changes...")
        
        # Get list of changed files
        result = subprocess.run([
            "git", "diff", "--name-only", "HEAD~1"
        ], cwd=self.project_root, capture_output=True, text=True)
        
        if result.returncode != 0:
            print("❌ Could not get changed files")
            return False
        
        changed_files = [f.strip() for f in result.stdout.split('\n') if f.strip()]
        
        # Check if too many files changed
        if len(changed_files) > 5:
            print(f"❌ DANGER: Too many files changed ({len(changed_files)})")
            print(f"   Changed: {', '.join(changed_files)}")
            return False
        
        # Check forbidden files
        forbidden = self.task_intent.get("forbidden_files", [])
        for changed_file in changed_files:
            for forbidden_pattern in forbidden:
                if forbidden_pattern in changed_file:
                    print(f"❌ DANGER: Forbidden file changed: {changed_file}")
                    return False
        
        # Check for large deletions
        result = subprocess.run([
            "git", "diff", "HEAD~1", "--numstat"
        ], cwd=self.project_root, capture_output=True, text=True)
        
        for line in result.stdout.split('\n'):
            if line.strip():
                parts = line.split('\t')
                if len(parts) >= 2:
                    additions = parts[0]
                    deletions = parts[1]
                    if deletions.isdigit() and int(deletions) > 100:
                        print(f"❌ DANGER: Large deletion detected: {deletions} lines in {parts[2]}")
                        return False
        
        print("✅ Changes look safe")
        return True
    
    def emergency_revert(self) -> None:
        """Emergency revert to safety snapshot."""
        print("🚨 EMERGENCY REVERT ACTIVATED")
        
        # Reset to previous commit
        subprocess.run([
            "git", "reset", "--hard", "HEAD~1"
        ], cwd=self.project_root)
        
        # Clean any untracked files
        subprocess.run([
            "git", "clean", "-fd"
        ], cwd=self.project_root)
        
        print("✅ Reverted to safe state")
    
    def run_safe_task(self, task: str, expected_files: List[str], 
                     forbidden_files: List[str] = None, agent: str = "aider") -> bool:
        """Run a task with full safety validation."""
        print(f"\n🛡️ SAFE MCP: Starting task with protection")
        print(f"Task: {task}")
        
        # Step 1: Create safety snapshot
        self.create_safety_snapshot(task)
        
        # Step 2: Document intent
        self.document_task_intent(task, expected_files, forbidden_files)
        
        # Step 3: Execute task
        print(f"\n🤖 Executing task with {agent}...")
        if agent == "aider":
            cmd = ["aider", "--yes", "--message", task]
        else:
            print(f"❌ Unknown agent: {agent}")
            return False
        
        try:
            result = subprocess.run(
                cmd, cwd=self.project_root, 
                capture_output=True, text=True, timeout=1800
            )
            
            if result.returncode != 0:
                print(f"❌ Task execution failed: {result.stderr}")
                return False
                
        except subprocess.TimeoutExpired:
            print("❌ Task timed out")
            return False
        
        # Step 4: Validate changes
        if not self.validate_changes():
            self.emergency_revert()
            return False
        
        # Step 5: Run quality checks
        print("\n🔍 Running quality checks...")
        quality_passed = self.run_quality_checks()
        
        if not quality_passed:
            print("❌ Quality checks failed")
            self.emergency_revert()
            return False
        
        print("✅ Task completed safely!")
        return True
    
    def run_quality_checks(self) -> bool:
        """Run basic quality checks."""
        checks = [
            ("TypeScript Check", ["npm", "run", "type-check"]),
            ("Linting", ["npm", "run", "lint"]),
        ]
        
        for check_name, cmd in checks:
            print(f"   Running {check_name}...")
            result = subprocess.run(
                cmd, cwd=self.project_root, 
                capture_output=True, text=True, timeout=300
            )
            
            if result.returncode != 0:
                print(f"   ❌ {check_name} failed")
                return False
            else:
                print(f"   ✅ {check_name} passed")
        
        return True

def main():
    if len(sys.argv) < 2:
        print("Usage: python safe_mcp.py 'task description'")
        print("Example: python safe_mcp.py 'Fix TypeScript errors in UserProfileStep.tsx'")
        sys.exit(1)
    
    task = sys.argv[1]
    
    # Define expected files based on task
    if "UserProfileStep" in task:
        expected_files = ["src/components/Steps/UserProfileStep.tsx"]
        forbidden_files = ["server/src/services/", "server/src/utils/database.ts"]
    elif "TypeScript" in task:
        expected_files = ["src/", "*.ts", "*.tsx"]
        forbidden_files = ["server/src/services/", "package.json"]
    else:
        expected_files = ["src/"]
        forbidden_files = ["server/src/services/", "server/src/utils/database.ts"]
    
    safe_mcp = SafeMCP()
    success = safe_mcp.run_safe_task(task, expected_files, forbidden_files)
    
    if success:
        print("\n🎉 Task completed successfully with all safety checks!")
        sys.exit(0)
    else:
        print("\n💥 Task failed safety validation and was reverted")
        sys.exit(1)

if __name__ == "__main__":
    main()
