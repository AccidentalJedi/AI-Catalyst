#!/usr/bin/env python3
"""
AI Catalyst - Setup Validation Script
Validates that automation setup is correct before first run
"""

import yaml
import json
import os
import sys
import subprocess
from pathlib import Path

def check_task_queue():
    """Validate task_queue.yaml format and content"""
    print("🔍 Checking task_queue.yaml...")
    
    if not os.path.exists('task_queue.yaml'):
        print("❌ task_queue.yaml not found")
        return False
    
    try:
        with open('task_queue.yaml', 'r') as f:
            data = yaml.safe_load(f)
        
        # Check required fields
        required_fields = ['version', 'tasks', 'execution_rules', 'safety_config']
        for field in required_fields:
            if field not in data:
                print(f"❌ Missing required field: {field}")
                return False
        
        # Check tasks format
        tasks = data.get('tasks', [])
        pending_tasks = [t for t in tasks if t.get('status') == 'pending']
        
        print(f"✅ Found {len(tasks)} total tasks")
        print(f"✅ Found {len(pending_tasks)} pending tasks")
        
        # Validate first pending task
        if pending_tasks:
            task = pending_tasks[0]
            required_task_fields = ['taskId', 'description', 'status', 'priority', 'files_to_modify', 'acceptance_criteria']
            for field in required_task_fields:
                if field not in task:
                    print(f"❌ Task {task.get('taskId', 'unknown')} missing field: {field}")
                    return False
            print(f"✅ Next task ready: {task['taskId']}")
        else:
            print("⚠️ No pending tasks found")
        
        return True
        
    except yaml.YAMLError as e:
        print(f"❌ YAML parsing error: {e}")
        return False
    except Exception as e:
        print(f"❌ Error reading task_queue.yaml: {e}")
        return False

def check_workflows():
    """Validate GitHub Actions workflows"""
    print("\n🔍 Checking GitHub Actions workflows...")
    
    workflow_files = [
        '.github/workflows/safe-mcp-automation.yml',
        '.github/workflows/dependabot-auto-merge.yml',
        '.github/workflows/vvs-task-queue.yml',
        '.github/workflows/security-scan.yml'
    ]
    
    for workflow_file in workflow_files:
        if not os.path.exists(workflow_file):
            print(f"❌ Missing workflow: {workflow_file}")
            return False
        
        try:
            with open(workflow_file, 'r') as f:
                content = f.read()
            
            # Check for required elements
            if 'OPENROUTER_API_KEY' in content:
                print(f"✅ {workflow_file} configured for OpenRouter")
            else:
                print(f"⚠️ {workflow_file} may not have OpenRouter configuration")
            
        except Exception as e:
            print(f"❌ Error reading {workflow_file}: {e}")
            return False
    
    return True

def check_dependencies():
    """Check if required dependencies are available"""
    print("\n🔍 Checking dependencies...")
    
    # Check Node.js
    try:
        result = subprocess.run(['node', '--version'], capture_output=True, text=True)
        if result.returncode == 0:
            print(f"✅ Node.js: {result.stdout.strip()}")
        else:
            print("❌ Node.js not found")
            return False
    except FileNotFoundError:
        print("❌ Node.js not found")
        return False
    
    # Check npm
    try:
        result = subprocess.run(['npm', '--version'], capture_output=True, text=True)
        if result.returncode == 0:
            print(f"✅ npm: {result.stdout.strip()}")
        else:
            print("❌ npm not found")
            return False
    except FileNotFoundError:
        print("❌ npm not found")
        return False
    
    # Check package.json files
    package_files = ['package.json', 'server/package.json']
    for package_file in package_files:
        if os.path.exists(package_file):
            print(f"✅ Found {package_file}")
        else:
            print(f"❌ Missing {package_file}")
            return False
    
    return True

def check_git_setup():
    """Check Git configuration"""
    print("\n🔍 Checking Git setup...")
    
    try:
        # Check if we're in a git repository
        result = subprocess.run(['git', 'status'], capture_output=True, text=True)
        if result.returncode != 0:
            print("❌ Not in a Git repository")
            return False
        
        # Check remote origin
        result = subprocess.run(['git', 'remote', 'get-url', 'origin'], capture_output=True, text=True)
        if result.returncode == 0:
            origin = result.stdout.strip()
            if 'AI-Catalyst' in origin:
                print(f"✅ Git remote: {origin}")
            else:
                print(f"⚠️ Unexpected remote: {origin}")
        else:
            print("❌ No Git remote configured")
            return False
        
        # Check current branch
        result = subprocess.run(['git', 'branch', '--show-current'], capture_output=True, text=True)
        if result.returncode == 0:
            branch = result.stdout.strip()
            print(f"✅ Current branch: {branch}")
        
        return True
        
    except FileNotFoundError:
        print("❌ Git not found")
        return False
    except Exception as e:
        print(f"❌ Git error: {e}")
        return False

def check_secrets_reminder():
    """Remind about GitHub Secrets configuration"""
    print("\n🔑 GitHub Secrets Checklist:")
    print("   □ OPENROUTER_API_KEY added to repository secrets")
    print("   □ GITHUB_TOKEN (automatically provided)")
    print("\n📝 To add secrets:")
    print("   1. Go to: https://github.com/AccidentalJedi/AI-Catalyst/settings/secrets/actions")
    print("   2. Click 'New repository secret'")
    print("   3. Name: OPENROUTER_API_KEY")
    print("   4. Value: Your OpenRouter API key (sk-or-v1-...)")

def main():
    """Main validation function"""
    print("🚀 AI Catalyst - Setup Validation")
    print("=" * 50)
    
    checks = [
        ("Task Queue", check_task_queue),
        ("Workflows", check_workflows),
        ("Dependencies", check_dependencies),
        ("Git Setup", check_git_setup),
    ]
    
    all_passed = True
    
    for check_name, check_func in checks:
        try:
            if not check_func():
                all_passed = False
        except Exception as e:
            print(f"❌ {check_name} check failed: {e}")
            all_passed = False
    
    # Always show secrets reminder
    check_secrets_reminder()
    
    print("\n" + "=" * 50)
    if all_passed:
        print("✅ All validation checks passed!")
        print("🚀 Ready to run automation workflows")
        print("\n📋 Next steps:")
        print("   1. Add OPENROUTER_API_KEY to GitHub Secrets")
        print("   2. Go to Actions tab and run 'Safe MCP 24/7 GitHub Copilot Native Automation'")
        print("   3. Monitor the first run for any issues")
        return 0
    else:
        print("❌ Some validation checks failed")
        print("🔧 Please fix the issues above before running automation")
        return 1

if __name__ == "__main__":
    sys.exit(main())
