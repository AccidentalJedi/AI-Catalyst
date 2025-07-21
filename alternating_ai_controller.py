#!/usr/bin/env python3
"""
Alternating AI Controller for AI Catalyst Development
Manages task distribution between GitHub Copilot and Aider

This controller alternates between AI agents for Tier 1 tasks while
maintaining strict safety controls and progress monitoring.
"""

import subprocess
import sys
import json
import time
import threading
import yaml
from pathlib import Path
from datetime import datetime
from typing import List, Dict, Optional, Tuple
from dataclasses import dataclass, asdict
from enum import Enum

class TaskStatus(Enum):
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    FAILED = "failed"
    SKIPPED = "skipped"

class AgentType(Enum):
    AIDER = "aider"
    COPILOT = "copilot"

@dataclass
class Task:
    taskId: str
    description: str
    files_to_modify: List[str]
    forbidden_files: List[str]
    acceptance_criteria: List[str]
    validation_commands: List[str]
    agent_preference: str
    priority: str
    estimated_duration: str
    safety_limits: Dict
    status: TaskStatus = TaskStatus.PENDING
    assigned_agent: Optional[AgentType] = None
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    error_message: Optional[str] = None
    branch_name: Optional[str] = None
    semantic_validation_passed: bool = False

class AlternatingAIController:
    def __init__(self, project_root: str = "."):
        self.project_root = Path(project_root).resolve()
        self.current_agent = AgentType.AIDER  # Start with Aider
        self.task_queue: List[Task] = []
        self.completed_tasks: List[Task] = []
        self.failed_tasks: List[Task] = []
        self.is_running = False
        self.progress_file = self.project_root / "ai_agent_progress.json"
        self.log_file = self.project_root / "ai_agent_log.txt"
        
        # Load existing progress if available
        self.load_progress()

    def create_task_branch(self, task: Task) -> bool:
        """Create isolated Git branch for task execution."""
        try:
            # Ensure we're on main branch and up to date
            subprocess.run(["git", "checkout", "main"], cwd=self.project_root, check=True)
            subprocess.run(["git", "pull", "origin", "main"], cwd=self.project_root, check=True)

            # Create new branch for this task
            branch_name = f"task/{task.taskId.lower()}"
            task.branch_name = branch_name

            subprocess.run(["git", "checkout", "-b", branch_name], cwd=self.project_root, check=True)

            self.log(f"✅ Created task branch: {branch_name}")
            return True

        except subprocess.CalledProcessError as e:
            self.log(f"❌ Failed to create task branch: {str(e)}")
            return False

    def merge_task_branch(self, task: Task) -> bool:
        """Merge completed task branch back to main."""
        try:
            if not task.branch_name:
                self.log("❌ No branch name for task")
                return False

            # Switch to main and merge
            subprocess.run(["git", "checkout", "main"], cwd=self.project_root, check=True)
            subprocess.run(["git", "merge", task.branch_name, "--no-ff"], cwd=self.project_root, check=True)

            # Delete the task branch
            subprocess.run(["git", "branch", "-d", task.branch_name], cwd=self.project_root, check=True)

            self.log(f"✅ Merged and deleted task branch: {task.branch_name}")
            return True

        except subprocess.CalledProcessError as e:
            self.log(f"❌ Failed to merge task branch: {str(e)}")
            return False

    def cleanup_task_branch(self, task: Task) -> None:
        """Clean up task branch on failure."""
        try:
            if task.branch_name:
                subprocess.run(["git", "checkout", "main"], cwd=self.project_root)
                subprocess.run(["git", "branch", "-D", task.branch_name], cwd=self.project_root)
                self.log(f"🧹 Cleaned up failed task branch: {task.branch_name}")
        except Exception as e:
            self.log(f"⚠️ Could not clean up branch: {str(e)}")

    def run_semantic_validation(self, task: Task) -> Tuple[bool, str]:
        """Run AI-powered semantic validation of task completion."""
        try:
            # Get the changes made
            diff_result = subprocess.run(
                ["git", "diff", "main", "--name-only"],
                cwd=self.project_root, capture_output=True, text=True
            )

            if diff_result.returncode != 0:
                return False, "Could not get diff for semantic validation"

            changed_files = diff_result.stdout.strip().split('\n')

            # Basic heuristic checks for now (replace with actual AI call)
            semantic_result = self._simulate_semantic_check(task, changed_files)

            return semantic_result, "Semantic validation completed"

        except Exception as e:
            return False, f"Semantic validation error: {str(e)}"

    def _simulate_semantic_check(self, task: Task, changed_files: List[str]) -> bool:
        """Simulate semantic validation (replace with actual AI call)."""
        # Check if expected files were modified
        for expected_file in task.files_to_modify:
            if expected_file.endswith('*'):
                pattern = expected_file.replace('*', '')
                if not any(f.startswith(pattern) for f in changed_files):
                    self.log(f"❌ Expected file pattern not found: {expected_file}")
                    return False
            else:
                if expected_file not in changed_files:
                    self.log(f"❌ Expected file not modified: {expected_file}")
                    return False

        # Check if forbidden files were modified
        for changed_file in changed_files:
            for forbidden_pattern in task.forbidden_files:
                if forbidden_pattern.replace('*', '') in changed_file:
                    self.log(f"❌ Forbidden file modified: {changed_file}")
                    return False

        self.log("✅ Semantic validation passed")
        return True

    def load_tier1_tasks(self) -> None:
        """Load Tier 1 tasks from task_queue.yaml"""
        try:
            task_file = self.project_root / "task_queue.yaml"
            if not task_file.exists():
                self.log("❌ task_queue.yaml not found, falling back to empty task queue")
                return

            with open(task_file, 'r') as f:
                task_data = yaml.safe_load(f)

            if not task_data or 'tasks' not in task_data:
                self.log("❌ Invalid YAML structure: missing 'tasks' section")
                return

            loaded_tasks = []
            for task_dict in task_data.get('tasks', []):
                try:
                    # Validate and map task from YAML to Task dataclass
                    task = self._validate_and_map_task(task_dict)
                    loaded_tasks.append(task)
                    self.log(f"✅ Loaded task: {task.taskId} - {task.description[:50]}...")

                except Exception as e:
                    self.log(f"❌ Failed to load task {task_dict.get('taskId', 'unknown')}: {str(e)}")
                    continue

            # Add loaded tasks to queue, filtering out already completed ones
            for task in loaded_tasks:
                if not any(t.taskId == task.taskId and t.status == TaskStatus.COMPLETED for t in self.completed_tasks):
                    self.task_queue.append(task)

            self.log(f"✅ Successfully loaded {len(self.task_queue)} tasks from YAML")

        except yaml.YAMLError as e:
            self.log(f"❌ YAML parsing error: {str(e)}")
        except Exception as e:
            self.log(f"❌ Error loading tasks from YAML: {str(e)}")

    def _validate_and_map_task(self, task_dict: Dict) -> Task:
        """Validate and map YAML task dictionary to Task dataclass with comprehensive field validation."""
        # Define required fields with their expected types
        required_fields = {
            'taskId': str,
            'description': str,
            'files_to_modify': list,
            'forbidden_files': list,
            'acceptance_criteria': list,
            'validation_commands': list,
            'agent_preference': str,
            'priority': str,
            'estimated_duration': str,
            'safety_limits': dict
        }

        # Validate required fields exist and have correct types
        for field, expected_type in required_fields.items():
            if field not in task_dict:
                raise ValueError(f"Missing required field: {field}")

            if not isinstance(task_dict[field], expected_type):
                raise ValueError(f"Field '{field}' must be of type {expected_type.__name__}, got {type(task_dict[field]).__name__}")

        # Validate specific field constraints
        self._validate_task_constraints(task_dict)

        # Map YAML status to TaskStatus enum (optional field)
        task_status = TaskStatus.PENDING  # Default
        if 'status' in task_dict:
            status_mapping = {
                'pending': TaskStatus.PENDING,
                'in_progress': TaskStatus.IN_PROGRESS,
                'completed': TaskStatus.COMPLETED,
                'failed': TaskStatus.FAILED,
                'skipped': TaskStatus.SKIPPED
            }
            yaml_status = task_dict['status'].lower()
            if yaml_status in status_mapping:
                task_status = status_mapping[yaml_status]
            else:
                self.log(f"⚠️ Unknown status '{task_dict['status']}' for task {task_dict['taskId']}, using 'pending'")

        # Create and return Task instance
        return Task(
            taskId=task_dict['taskId'],
            description=task_dict['description'],
            files_to_modify=task_dict['files_to_modify'],
            forbidden_files=task_dict['forbidden_files'],
            acceptance_criteria=task_dict['acceptance_criteria'],
            validation_commands=task_dict['validation_commands'],
            agent_preference=task_dict['agent_preference'],
            priority=task_dict['priority'],
            estimated_duration=task_dict['estimated_duration'],
            safety_limits=task_dict['safety_limits'],
            status=task_status
        )

    def _validate_task_constraints(self, task_dict: Dict) -> None:
        """Validate specific constraints for task fields."""
        # Validate taskId format
        task_id = task_dict['taskId']
        if not task_id or len(task_id.strip()) == 0:
            raise ValueError("taskId cannot be empty")

        # Validate priority values
        valid_priorities = ['high', 'medium', 'low']
        if task_dict['priority'].lower() not in valid_priorities:
            raise ValueError(f"priority must be one of {valid_priorities}, got '{task_dict['priority']}'")

        # Validate agent preference
        valid_agents = ['aider', 'copilot']
        if task_dict['agent_preference'].lower() not in valid_agents:
            raise ValueError(f"agent_preference must be one of {valid_agents}, got '{task_dict['agent_preference']}'")

        # Validate safety_limits structure
        safety_limits = task_dict['safety_limits']
        if 'max_files_changed' not in safety_limits:
            raise ValueError("safety_limits must contain 'max_files_changed'")
        if 'max_lines_deleted' not in safety_limits:
            raise ValueError("safety_limits must contain 'max_lines_deleted'")

        # Validate safety_limits values are positive integers
        try:
            max_files = int(safety_limits['max_files_changed'])
            max_deletions = int(safety_limits['max_lines_deleted'])
            if max_files <= 0 or max_deletions < 0:
                raise ValueError("safety_limits values must be positive integers")
        except (ValueError, TypeError):
            raise ValueError("safety_limits values must be valid integers")

        # Validate lists are not empty
        if not task_dict['files_to_modify']:
            raise ValueError("files_to_modify cannot be empty")
        if not task_dict['acceptance_criteria']:
            raise ValueError("acceptance_criteria cannot be empty")
        if not task_dict['validation_commands']:
            raise ValueError("validation_commands cannot be empty")

    def get_next_agent(self) -> AgentType:
        """Alternate between agents for task distribution."""
        if self.current_agent == AgentType.AIDER:
            self.current_agent = AgentType.COPILOT
        else:
            self.current_agent = AgentType.AIDER
        return self.current_agent
    
    def execute_task_with_safe_mcp(self, task: Task, agent: AgentType) -> Tuple[bool, str]:
        """Execute task using Safe MCP Multi-Agent system."""
        try:
            cmd = [
                "python", "safe_mcp_multi_agent.py",
                agent.value,
                task.description
            ]
            
            self.log(f"Executing {task.id} with {agent.value.upper()}: {task.description}")
            
            result = subprocess.run(
                cmd, cwd=self.project_root,
                capture_output=True, text=True,
                timeout=1800  # 30 minute timeout
            )
            
            if result.returncode == 0:
                self.log(f"✅ {task.id} completed successfully with {agent.value.upper()}")
                return True, result.stdout
            else:
                error_msg = f"Task failed: {result.stderr}"
                self.log(f"❌ {task.id} failed with {agent.value.upper()}: {error_msg}")
                return False, error_msg
                
        except subprocess.TimeoutExpired:
            error_msg = "Task timed out after 30 minutes"
            self.log(f"⏰ {task.id} timed out with {agent.value.upper()}")
            return False, error_msg
        except Exception as e:
            error_msg = f"Execution error: {str(e)}"
            self.log(f"💥 {task.id} error with {agent.value.upper()}: {error_msg}")
            return False, error_msg
    
    def process_next_task(self) -> bool:
        """Process the next task in the queue with Git branch isolation."""
        if not self.task_queue:
            return False

        task = self.task_queue.pop(0)

        # Use agent preference from task definition, or alternate
        if task.agent_preference == "aider":
            agent = AgentType.AIDER
        elif task.agent_preference == "copilot":
            agent = AgentType.COPILOT
        else:
            agent = self.get_next_agent()

        # Update task status
        task.assigned_agent = agent
        task.status = TaskStatus.IN_PROGRESS
        task.start_time = datetime.now()

        self.log(f"🚀 Starting task {task.taskId} with {agent.value.upper()}")

        try:
            # Step 1: Create isolated Git branch
            if not self.create_task_branch(task):
                raise Exception("Failed to create task branch")

            self.save_progress()

            # Step 2: Execute task with Safe MCP
            success, output = self.execute_task_with_safe_mcp(task, agent)

            if not success:
                raise Exception(f"Task execution failed: {output}")

            # Step 3: Run semantic validation
            semantic_passed, semantic_msg = self.run_semantic_validation(task)
            task.semantic_validation_passed = semantic_passed

            if not semantic_passed:
                raise Exception(f"Semantic validation failed: {semantic_msg}")

            # Step 4: Merge branch back to main
            if not self.merge_task_branch(task):
                raise Exception("Failed to merge task branch")

            # Task completed successfully
            task.end_time = datetime.now()
            task.status = TaskStatus.COMPLETED
            self.completed_tasks.append(task)
            self.log(f"🎉 Task {task.taskId} completed successfully!")

        except Exception as e:
            # Handle failure
            task.end_time = datetime.now()
            task.status = TaskStatus.FAILED
            task.error_message = str(e)
            self.failed_tasks.append(task)
            self.log(f"💥 Task {task.taskId} failed: {str(e)}")

            # Clean up failed branch
            self.cleanup_task_branch(task)

        self.save_progress()
        return True
    
    def run_continuous(self, max_tasks: int = None, delay_minutes: int = 5) -> None:
        """Run continuous task processing in background."""
        self.is_running = True
        tasks_processed = 0
        
        self.log("🚀 Starting continuous AI agent processing...")
        
        while self.is_running and self.task_queue:
            if max_tasks and tasks_processed >= max_tasks:
                break
            
            try:
                if self.process_next_task():
                    tasks_processed += 1
                    
                    # Wait between tasks to avoid overwhelming the system
                    if self.task_queue and delay_minutes > 0:
                        self.log(f"⏳ Waiting {delay_minutes} minutes before next task...")
                        time.sleep(delay_minutes * 60)
                else:
                    break
                    
            except KeyboardInterrupt:
                self.log("🛑 Continuous processing interrupted by user")
                break
            except Exception as e:
                self.log(f"💥 Error in continuous processing: {str(e)}")
                time.sleep(60)  # Wait 1 minute before retrying
        
        self.is_running = False
        self.log("🏁 Continuous processing completed")
    
    def stop_continuous(self) -> None:
        """Stop continuous processing."""
        self.is_running = False
        self.log("🛑 Stop signal sent to continuous processing")
    
    def get_progress_summary(self) -> Dict:
        """Get current progress summary."""
        return {
            "timestamp": datetime.now().isoformat(),
            "pending_tasks": len(self.task_queue),
            "completed_tasks": len(self.completed_tasks),
            "failed_tasks": len(self.failed_tasks),
            "current_agent": self.current_agent.value,
            "is_running": self.is_running,
            "tasks": {
                "pending": [{"id": t.id, "description": t.description} for t in self.task_queue],
                "completed": [{"id": t.id, "agent": t.assigned_agent.value if t.assigned_agent else None, 
                             "duration": str(t.end_time - t.start_time) if t.start_time and t.end_time else None} 
                             for t in self.completed_tasks],
                "failed": [{"id": t.id, "agent": t.assigned_agent.value if t.assigned_agent else None,
                          "error": t.error_message} for t in self.failed_tasks]
            }
        }
    
    def save_progress(self) -> None:
        """Save current progress to file."""
        progress = self.get_progress_summary()
        with open(self.progress_file, "w") as f:
            json.dump(progress, f, indent=2)
    
    def load_progress(self) -> None:
        """Load progress from file if it exists."""
        if self.progress_file.exists():
            try:
                with open(self.progress_file, "r") as f:
                    data = json.load(f)
                    # Restore state from saved progress
                    # This is a simplified version - full implementation would restore all task states
                    self.log("📂 Loaded previous progress")
            except Exception as e:
                self.log(f"⚠️ Could not load progress: {str(e)}")
    
    def log(self, message: str) -> None:
        """Log message to both console and file."""
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        log_entry = f"[{timestamp}] {message}"
        
        print(log_entry)
        
        with open(self.log_file, "a", encoding="utf-8") as f:
            f.write(log_entry + "\n")

def main():
    if len(sys.argv) < 2:
        print("Usage: python alternating_ai_controller.py <command> [options]")
        print("Commands:")
        print("  start [max_tasks] [delay_minutes] - Start continuous processing")
        print("  next - Process next single task")
        print("  status - Show current status")
        print("  stop - Stop continuous processing")
        sys.exit(1)
    
    controller = AlternatingAIController()
    command = sys.argv[1].lower()
    
    if command == "start":
        controller.load_tier1_tasks()
        max_tasks = int(sys.argv[2]) if len(sys.argv) > 2 else None
        delay_minutes = int(sys.argv[3]) if len(sys.argv) > 3 else 5
        controller.run_continuous(max_tasks, delay_minutes)
    
    elif command == "next":
        controller.load_tier1_tasks()
        if controller.process_next_task():
            print("✅ Task processed successfully")
        else:
            print("❌ No tasks available or processing failed")
    
    elif command == "status":
        progress = controller.get_progress_summary()
        print(json.dumps(progress, indent=2))
    
    elif command == "stop":
        controller.stop_continuous()
        print("🛑 Stop signal sent")
    
    else:
        print(f"Unknown command: {command}")
        sys.exit(1)

if __name__ == "__main__":
    main()
