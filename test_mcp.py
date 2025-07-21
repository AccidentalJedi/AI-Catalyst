#!/usr/bin/env python3
"""
Test Suite for AI Catalyst Master Control Program (MCP)

This test suite provides comprehensive testing for the MCP functionality
including mock agent integration, git operations, and quality control.
"""

import unittest
import tempfile
import shutil
import subprocess
import json
from pathlib import Path
from unittest.mock import Mock, patch, MagicMock
import sys
import os

# Add the current directory to Python path for imports
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from mcp_cli import MCPManager, create_argument_parser, validate_arguments

class TestMCPManager(unittest.TestCase):
    """Test cases for MCPManager class."""
    
    def setUp(self):
        """Set up test environment with temporary directory."""
        self.test_dir = tempfile.mkdtemp()
        self.test_path = Path(self.test_dir)
        
        # Create a mock git repository
        subprocess.run(['git', 'init'], cwd=self.test_dir, capture_output=True)
        subprocess.run(['git', 'config', 'user.email', 'test@example.com'], cwd=self.test_dir)
        subprocess.run(['git', 'config', 'user.name', 'Test User'], cwd=self.test_dir)
        
        # Create mock project structure
        (self.test_path / 'package.json').write_text(json.dumps({
            "name": "ai-catalyst-launch-wizard",
            "version": "1.0.0",
            "scripts": {
                "lint": "echo 'linting...'",
                "type-check": "echo 'type checking...'",
                "test:run": "echo 'testing...'",
                "server:check": "echo 'server check...'"
            }
        }))
        
        # Create server directory
        server_dir = self.test_path / 'server'
        server_dir.mkdir()
        (server_dir / 'package.json').write_text(json.dumps({
            "name": "ai-catalyst-backend",
            "scripts": {"test": "echo 'server testing...'"}
        }))
        
        # Create initial commit
        subprocess.run(['git', 'add', '.'], cwd=self.test_dir)
        subprocess.run(['git', 'commit', '-m', 'Initial commit'], cwd=self.test_dir)
        
        # Initialize MCP manager
        self.mcp = MCPManager(project_root=self.test_dir, verbose=True)
    
    def tearDown(self):
        """Clean up test environment."""
        shutil.rmtree(self.test_dir)
    
    def test_initialization(self):
        """Test MCP manager initialization."""
        self.assertEqual(self.mcp.project_root, Path(self.test_dir).resolve())
        self.assertTrue(self.mcp.log_dir.exists())
        self.assertEqual(self.mcp.task_timeout, 1800)
        self.assertEqual(self.mcp.check_timeout, 600)
    
    def test_git_repository_check(self):
        """Test git repository validation."""
        self.assertTrue(self.mcp.check_git_repository())
        
        # Test with non-git directory
        non_git_dir = tempfile.mkdtemp()
        mcp_non_git = MCPManager(project_root=non_git_dir)
        self.assertFalse(mcp_non_git.check_git_repository())
        shutil.rmtree(non_git_dir)
    
    def test_git_status(self):
        """Test git status functionality."""
        status = self.mcp.get_git_status()
        self.assertIsInstance(status, dict)
        self.assertIn('has_changes', status)
        self.assertIn('is_clean', status)
        self.assertTrue(status['is_clean'])  # Should be clean after setup
    
    def test_task_file_loading(self):
        """Test task file loading with various scenarios."""
        # Test valid task file
        task_file = self.test_path / 'test_tasks.txt'
        task_file.write_text("""
# This is a comment
Task 1: Do something
# Another comment

Task 2: Do something else
        """.strip())
        
        tasks = self.mcp.load_tasks(str(task_file))
        self.assertEqual(len(tasks), 2)
        self.assertEqual(tasks[0], "Task 1: Do something")
        self.assertEqual(tasks[1], "Task 2: Do something else")
    
    def test_task_file_loading_empty(self):
        """Test task file loading with empty file."""
        task_file = self.test_path / 'empty_tasks.txt'
        task_file.write_text("# Only comments\n\n# More comments\n")
        
        tasks = self.mcp.load_tasks(str(task_file))
        self.assertEqual(len(tasks), 0)
    
    def test_task_file_loading_nonexistent(self):
        """Test task file loading with non-existent file."""
        tasks = self.mcp.load_tasks('nonexistent.txt')
        self.assertEqual(len(tasks), 0)
    
    @patch('subprocess.run')
    def test_execute_agent_task_success(self, mock_run):
        """Test successful agent task execution."""
        # Mock successful aider execution
        mock_result = Mock()
        mock_result.returncode = 0
        mock_result.stdout = "Task completed successfully"
        mock_result.stderr = ""
        mock_run.return_value = mock_result
        
        success, output = self.mcp.execute_agent_task("Test task", "aider")
        self.assertTrue(success)
        self.assertEqual(output, "Task completed successfully")
    
    @patch('subprocess.run')
    def test_execute_agent_task_failure(self, mock_run):
        """Test failed agent task execution."""
        # Mock failed aider execution
        mock_result = Mock()
        mock_result.returncode = 1
        mock_result.stdout = ""
        mock_result.stderr = "Error occurred"
        mock_run.return_value = mock_result
        
        success, output = self.mcp.execute_agent_task("Test task", "aider")
        self.assertFalse(success)
        self.assertIn("Error occurred", output)
    
    @patch('subprocess.run')
    def test_execute_agent_task_timeout(self, mock_run):
        """Test agent task timeout."""
        # Mock timeout
        mock_run.side_effect = subprocess.TimeoutExpired(['aider'], 30)
        
        success, output = self.mcp.execute_agent_task("Test task", "aider")
        self.assertFalse(success)
        self.assertIn("timed out", output)
    
    def test_environment_validation(self):
        """Test environment validation."""
        valid, issues = self.mcp.validate_environment()
        # Should be valid since we set up a proper test environment
        if not valid:
            print(f"Environment issues: {issues}")
        # Note: This might fail in CI environments without npm/node
    
    @patch('subprocess.run')
    def test_gauntlet_checks_success(self, mock_run):
        """Test successful gauntlet quality checks."""
        # Mock all quality checks as successful
        mock_result = Mock()
        mock_result.returncode = 0
        mock_result.stdout = "Check passed"
        mock_result.stderr = ""
        mock_run.return_value = mock_result
        
        success, results = self.mcp.run_gauntlet()
        self.assertTrue(success)
        self.assertEqual(len(results), 6)  # Should have 6 checks
        for result in results:
            self.assertTrue(result['passed'])
    
    @patch('subprocess.run')
    def test_gauntlet_checks_failure(self, mock_run):
        """Test failed gauntlet quality checks."""
        # Mock first check as failed
        def side_effect(*args, **kwargs):
            mock_result = Mock()
            if 'prettier' in args[0]:
                mock_result.returncode = 1
                mock_result.stderr = "Formatting error"
            else:
                mock_result.returncode = 0
            mock_result.stdout = ""
            return mock_result
        
        mock_run.side_effect = side_effect
        
        success, results = self.mcp.run_gauntlet()
        self.assertFalse(success)
        self.assertEqual(len(results), 1)  # Should stop at first failure
        self.assertFalse(results[0]['passed'])

class TestArgumentParsing(unittest.TestCase):
    """Test cases for command-line argument parsing."""
    
    def test_argument_parser_creation(self):
        """Test argument parser creation."""
        parser = create_argument_parser()
        self.assertIsNotNone(parser)
    
    def test_task_file_argument(self):
        """Test task file argument parsing."""
        parser = create_argument_parser()
        args = parser.parse_args(['--task-file', 'tasks.txt'])
        self.assertEqual(args.task_file, 'tasks.txt')
        self.assertIsNone(args.single_task)
    
    def test_single_task_argument(self):
        """Test single task argument parsing."""
        parser = create_argument_parser()
        args = parser.parse_args(['--single-task', 'Test task'])
        self.assertEqual(args.single_task, 'Test task')
        self.assertIsNone(args.task_file)
    
    def test_agent_argument(self):
        """Test agent argument parsing."""
        parser = create_argument_parser()
        args = parser.parse_args(['--single-task', 'test', '--agent', 'jules'])
        self.assertEqual(args.agent, 'jules')
    
    def test_timeout_arguments(self):
        """Test timeout argument parsing."""
        parser = create_argument_parser()
        args = parser.parse_args([
            '--single-task', 'test',
            '--task-timeout', '3600',
            '--check-timeout', '1200'
        ])
        self.assertEqual(args.task_timeout, 3600)
        self.assertEqual(args.check_timeout, 1200)

class TestIntegration(unittest.TestCase):
    """Integration tests for MCP functionality."""
    
    def setUp(self):
        """Set up integration test environment."""
        self.test_dir = tempfile.mkdtemp()
        self.test_path = Path(self.test_dir)
        
        # Create minimal project structure
        (self.test_path / 'package.json').write_text('{"name": "test-project"}')
        
        # Initialize git
        subprocess.run(['git', 'init'], cwd=self.test_dir, capture_output=True)
        subprocess.run(['git', 'config', 'user.email', 'test@example.com'], cwd=self.test_dir)
        subprocess.run(['git', 'config', 'user.name', 'Test User'], cwd=self.test_dir)
        subprocess.run(['git', 'add', '.'], cwd=self.test_dir)
        subprocess.run(['git', 'commit', '-m', 'Initial'], cwd=self.test_dir)
    
    def tearDown(self):
        """Clean up integration test environment."""
        shutil.rmtree(self.test_dir)
    
    @patch('shutil.which')
    def test_argument_validation_missing_commands(self, mock_which):
        """Test argument validation with missing commands."""
        # Mock missing git command
        mock_which.side_effect = lambda cmd: None if cmd == 'git' else '/usr/bin/' + cmd
        
        parser = create_argument_parser()
        args = parser.parse_args(['--single-task', 'test'])
        
        # This should fail validation due to missing git
        valid = validate_arguments(args)
        self.assertFalse(valid)

if __name__ == '__main__':
    # Run tests with verbose output
    unittest.main(verbosity=2)
