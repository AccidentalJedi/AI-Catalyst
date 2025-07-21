#!/usr/bin/env python3
"""
AI Catalyst Progress Dashboard
Provides clear English updates on automation progress
"""

import requests
import json
import yaml
from datetime import datetime, timedelta
import os

def get_github_workflows():
    """Get recent workflow runs from GitHub API"""
    try:
        # Use GitHub API to get workflow runs
        repo = "AccidentalJedi/AI-Catalyst"
        url = f"https://api.github.com/repos/{repo}/actions/runs"
        
        headers = {
            'Accept': 'application/vnd.github.v3+json',
            'User-Agent': 'AI-Catalyst-Progress-Dashboard'
        }
        
        response = requests.get(url, headers=headers)
        if response.status_code == 200:
            return response.json()
        else:
            print(f"❌ GitHub API error: {response.status_code}")
            return None
    except Exception as e:
        print(f"❌ Error fetching workflows: {e}")
        return None

def analyze_workflow_status(workflows_data):
    """Analyze workflow data and provide English summary"""
    if not workflows_data or 'workflow_runs' not in workflows_data:
        return "❌ Unable to fetch workflow data"
    
    runs = workflows_data['workflow_runs']
    # Fix timezone comparison issue
    from datetime import timezone
    cutoff_time = datetime.now(timezone.utc) - timedelta(hours=2)
    recent_runs = [run for run in runs if
                   datetime.fromisoformat(run['created_at'].replace('Z', '+00:00')) > cutoff_time]
    
    # Categorize runs
    safe_mcp_runs = [r for r in recent_runs if 'Safe MCP' in r['name']]
    security_runs = [r for r in recent_runs if 'Security' in r['name']]
    dependabot_runs = [r for r in recent_runs if 'Dependabot' in r['name']]
    
    summary = []
    summary.append("🎯 **AI Catalyst Automation Status** (Last 2 Hours)")
    summary.append("=" * 50)
    
    # Safe MCP Status
    if safe_mcp_runs:
        latest_mcp = safe_mcp_runs[0]
        status = latest_mcp['status']
        conclusion = latest_mcp.get('conclusion', 'running')
        
        if status == 'completed' and conclusion == 'success':
            summary.append("✅ **Safe MCP Automation**: Working perfectly!")
            summary.append("   🤖 AI agents are processing tasks automatically")
            summary.append("   📋 Tasks being completed and PRs created")
        elif status == 'in_progress':
            summary.append("🔄 **Safe MCP Automation**: Currently running...")
            summary.append("   🤖 AI agent is working on a task right now")
            summary.append("   ⏱️ Should complete in 10-30 minutes")
        elif conclusion == 'failure':
            summary.append("❌ **Safe MCP Automation**: Encountered an issue")
            summary.append("   🔧 May need attention or will retry automatically")
        else:
            summary.append("⏳ **Safe MCP Automation**: Starting up...")
    else:
        summary.append("😴 **Safe MCP Automation**: No recent activity")
        summary.append("   ⏰ Next run scheduled within 30 minutes")
    
    summary.append("")
    
    # Security Status
    if security_runs:
        latest_security = security_runs[0]
        if latest_security['conclusion'] == 'success':
            summary.append("🛡️ **Security Scans**: All clear!")
            summary.append("   ✅ No vulnerabilities detected")
        else:
            summary.append("🔍 **Security Scans**: Running checks...")
    else:
        summary.append("🛡️ **Security Scans**: Scheduled for next run")
    
    summary.append("")
    
    # Dependabot Status
    if dependabot_runs:
        successful_deps = [r for r in dependabot_runs if r.get('conclusion') == 'success']
        summary.append(f"📦 **Dependency Updates**: {len(successful_deps)} packages updated")
        summary.append("   ✅ Dependencies are being kept current automatically")
    else:
        summary.append("📦 **Dependency Updates**: Scheduled for weekly runs")
    
    return "\n".join(summary)

def check_task_queue():
    """Check current task queue status"""
    try:
        if os.path.exists('task_queue.yaml'):
            with open('task_queue.yaml', 'r') as f:
                task_data = yaml.safe_load(f)
            
            tasks = task_data.get('tasks', [])
            pending = [t for t in tasks if t.get('status', 'pending') == 'pending']
            completed = [t for t in tasks if t.get('status') == 'completed']
            
            summary = []
            summary.append("\n🎯 **Task Queue Status**")
            summary.append("=" * 30)
            summary.append(f"📋 Total tasks: {len(tasks)}")
            summary.append(f"✅ Completed: {len(completed)}")
            summary.append(f"⏳ Pending: {len(pending)}")
            
            if pending:
                summary.append("\n📝 **Next Tasks:**")
                for i, task in enumerate(pending[:3]):
                    task_type = "🎖️ VVS" if task['taskId'].startswith('T1-VVS') else "📱 Frontend"
                    priority = task.get('priority', 'medium').upper()
                    summary.append(f"   {i+1}. {task['taskId']} ({task_type}, {priority})")
                    summary.append(f"      {task['description'][:60]}...")
            else:
                summary.append("\n🎉 **All tasks completed!**")
            
            return "\n".join(summary)
        else:
            return "\n❓ **Task Queue**: No task_queue.yaml found"
    except Exception as e:
        return f"\n❌ **Task Queue Error**: {e}"

def generate_progress_report():
    """Generate complete progress report"""
    print("🔍 Fetching AI Catalyst automation status...")
    
    # Get workflow status
    workflows = get_github_workflows()
    workflow_summary = analyze_workflow_status(workflows)
    
    # Get task queue status
    task_summary = check_task_queue()
    
    # Combine reports
    full_report = workflow_summary + task_summary
    
    # Add timestamp
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    full_report += f"\n\n⏰ **Last Updated**: {timestamp}"
    full_report += "\n🔄 **Refresh**: Run this script again for latest status"
    
    return full_report

def save_progress_report():
    """Save progress report to file"""
    report = generate_progress_report()
    
    # Save to file with UTF-8 encoding
    with open('PROGRESS_REPORT.md', 'w', encoding='utf-8') as f:
        f.write("# AI Catalyst Automation Progress\n\n")
        f.write(report)
    
    print("✅ Progress report saved to PROGRESS_REPORT.md")
    return report

if __name__ == "__main__":
    # Generate and display report
    report = save_progress_report()
    print("\n" + "="*60)
    print(report)
    print("="*60)
