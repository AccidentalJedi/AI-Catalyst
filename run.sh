#!/bin/bash

# AI Catalyst Launch Wizard - Execution Script (macOS/Linux)
# This script starts both frontend and backend servers and opens the browser

echo ""
echo "========================================"
echo " AI Catalyst Launch Wizard"
echo "========================================"
echo ""
echo "Starting the AI Catalyst Launch Wizard..."
echo ""

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to check if port is in use
port_in_use() {
    if command_exists lsof; then
        lsof -i :$1 >/dev/null 2>&1
    elif command_exists netstat; then
        netstat -an | grep ":$1 " >/dev/null 2>&1
    else
        # Fallback: try to connect to the port
        timeout 1 bash -c "</dev/tcp/localhost/$1" >/dev/null 2>&1
    fi
}

# Function to open URL in browser
open_browser() {
    if command_exists xdg-open; then
        xdg-open "$1"  # Linux
    elif command_exists open; then
        open "$1"      # macOS
    else
        echo "Please manually open: $1"
    fi
}

# Check if Node.js is available
if ! command_exists node; then
    echo "❌ ERROR: Node.js not found"
    echo ""
    echo "Please run ./install.sh first to set up the environment."
    echo ""
    exit 1
fi

# Check if dependencies are installed
if [ ! -d "node_modules" ]; then
    echo "❌ ERROR: Frontend dependencies not installed"
    echo ""
    echo "Please run ./install.sh first to install dependencies."
    echo ""
    exit 1
fi

if [ ! -d "server/node_modules" ]; then
    echo "❌ ERROR: Backend dependencies not installed"
    echo ""
    echo "Please run ./install.sh first to install dependencies."
    echo ""
    exit 1
fi

# Check for port conflicts
echo "[1/4] Checking for port conflicts..."

if port_in_use 3000; then
    echo "⚠️  WARNING: Port 3000 is already in use"
    echo "Another application may be running on this port."
    echo ""
    echo "Options:"
    echo "1. Close other applications using port 3000"
    echo "2. Continue anyway (may cause conflicts)"
    echo ""
    read -p "Continue anyway? (y/n): " choice
    if [[ ! "$choice" =~ ^[Yy]$ ]]; then
        echo ""
        echo "Startup cancelled. Please close applications using port 3000 and try again."
        exit 1
    fi
fi

if port_in_use 3001; then
    echo "⚠️  WARNING: Port 3001 is already in use"
    echo "Another application may be running on this port."
    echo ""
    echo "Options:"
    echo "1. Close other applications using port 3001"
    echo "2. Continue anyway (may cause conflicts)"
    echo ""
    read -p "Continue anyway? (y/n): " choice
    if [[ ! "$choice" =~ ^[Yy]$ ]]; then
        echo ""
        echo "Startup cancelled. Please close applications using port 3001 and try again."
        exit 1
    fi
fi

echo "✅ Port check complete"
echo ""

# Create log directory if it doesn't exist
mkdir -p logs

# Function to cleanup background processes
cleanup() {
    echo ""
    echo "Stopping servers..."
    if [ ! -z "$BACKEND_PID" ]; then
        kill $BACKEND_PID 2>/dev/null
    fi
    if [ ! -z "$FRONTEND_PID" ]; then
        kill $FRONTEND_PID 2>/dev/null
    fi
    exit 0
}

# Set up signal handlers
trap cleanup SIGINT SIGTERM

# Start backend server
echo "[2/4] Starting backend server (port 3001)..."
echo ""

cd server
npm run dev > ../logs/backend.log 2>&1 &
BACKEND_PID=$!
cd ..

# Wait a moment for backend to start
sleep 3

# Start frontend server
echo "[3/4] Starting frontend server (port 3000)..."
echo ""

npm run dev > logs/frontend.log 2>&1 &
FRONTEND_PID=$!

# Wait for servers to start
echo "[4/4] Waiting for servers to start..."
echo ""

# Wait up to 30 seconds for frontend to be ready
counter=0
while [ $counter -lt 30 ]; do
    sleep 2
    counter=$((counter + 2))
    
    # Check if frontend is responding
    if command_exists curl; then
        if curl -s http://localhost:3000 >/dev/null 2>&1; then
            break
        fi
    elif command_exists wget; then
        if wget -q --spider http://localhost:3000 >/dev/null 2>&1; then
            break
        fi
    else
        # Fallback: assume it's ready after reasonable time
        if [ $counter -ge 10 ]; then
            break
        fi
    fi
    
    if [ $counter -ge 30 ]; then
        echo "⚠️  Servers are taking longer than expected to start..."
        echo ""
        echo "You can:"
        echo "1. Wait a bit longer and manually open http://localhost:3000"
        echo "2. Check logs/backend.log and logs/frontend.log for errors"
        echo "3. Try running ./install.sh again if there are dependency issues"
        echo ""
        break
    fi
done

if [ $counter -lt 30 ]; then
    echo "✅ Servers are ready!"
    echo ""
fi

# Open browser automatically
echo "Opening AI Catalyst Launch Wizard in your default browser..."
echo ""

open_browser "http://localhost:3000"

echo "========================================"
echo " 🚀 AI Catalyst Launch Wizard Running"
echo "========================================"
echo ""
echo "Frontend: http://localhost:3000"
echo "Backend:  http://localhost:3001"
echo ""
echo "The wizard should open automatically in your browser."
echo "If not, manually navigate to: http://localhost:3000"
echo ""
echo "Server Status:"
echo "- Backend PID: $BACKEND_PID"
echo "- Frontend PID: $FRONTEND_PID"
echo "- Logs: logs/backend.log and logs/frontend.log"
echo ""
echo "To stop the servers:"
echo "- Press Ctrl+C in this terminal"
echo "- Or run: kill $BACKEND_PID $FRONTEND_PID"
echo ""
echo "Troubleshooting:"
echo "- If the page doesn't load, wait 30 seconds and refresh"
echo "- Check log files for error messages"
echo "- Ensure ports 3000 and 3001 are not blocked by firewall"
echo ""
echo "Press Ctrl+C to stop all servers..."

# Wait for user to stop servers
wait
