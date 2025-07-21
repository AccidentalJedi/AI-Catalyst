#!/bin/bash

# AI Catalyst Launch Wizard - Automated Installation Script (macOS/Linux)
# This script sets up the complete development environment for non-technical users

set -e  # Exit on any error

echo ""
echo "========================================"
echo " AI Catalyst Launch Wizard Installer"
echo "========================================"
echo ""
echo "This script will automatically set up the AI Catalyst Launch Wizard"
echo "development environment on your computer."
echo ""

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to get Node.js major version
get_node_major_version() {
    node --version | sed 's/v//' | cut -d. -f1
}

# Check if Node.js is installed
echo "[1/6] Checking Node.js installation..."

if ! command_exists node; then
    echo ""
    echo "❌ ERROR: Node.js is not installed"
    echo ""
    echo "Please install Node.js 18 or higher:"
    echo ""
    echo "macOS:"
    echo "  - Download from: https://nodejs.org/en/download/"
    echo "  - Or use Homebrew: brew install node"
    echo ""
    echo "Linux (Ubuntu/Debian):"
    echo "  sudo apt update"
    echo "  sudo apt install nodejs npm"
    echo ""
    echo "Linux (CentOS/RHEL):"
    echo "  sudo yum install nodejs npm"
    echo ""
    echo "After installation, restart your terminal and run this script again."
    echo ""
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(get_node_major_version)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo ""
    echo "❌ ERROR: Node.js version $NODE_VERSION is too old"
    echo ""
    echo "AI Catalyst requires Node.js 18 or higher."
    echo "Please update Node.js from: https://nodejs.org/en/download/"
    echo ""
    exit 1
fi

echo "✅ Node.js version found: $(node --version)"
echo ""

# Check if npm is available
echo "[2/6] Checking npm installation..."

if ! command_exists npm; then
    echo "❌ ERROR: npm is not available"
    echo "npm should be installed with Node.js. Please reinstall Node.js."
    exit 1
fi

echo "✅ npm version found: $(npm --version)"
echo ""

# Install frontend dependencies
echo "[3/6] Installing frontend dependencies..."
echo "This may take a few minutes..."
echo ""

if ! npm install; then
    echo ""
    echo "❌ ERROR: Failed to install frontend dependencies"
    echo ""
    echo "Common solutions:"
    echo "1. Check your internet connection"
    echo "2. Try running with sudo (if permission issues)"
    echo "3. Clear npm cache: npm cache clean --force"
    echo ""
    exit 1
fi

echo "✅ Frontend dependencies installed successfully"
echo ""

# Install backend dependencies
echo "[4/6] Installing backend dependencies..."
echo ""

if [ ! -f "server/package.json" ]; then
    echo "❌ ERROR: server/package.json not found"
    echo "Please ensure you're running this script from the AI Catalyst root directory"
    exit 1
fi

cd server

if ! npm install; then
    echo ""
    echo "❌ ERROR: Failed to install backend dependencies"
    echo ""
    echo "Try checking your internet connection or clearing npm cache."
    echo ""
    exit 1
fi

echo "✅ Backend dependencies installed successfully"
echo ""

cd ..

# Set up environment file
echo "[5/6] Setting up environment configuration..."

if [ ! -f "server/.env" ]; then
    if [ -f "server/.env.example" ]; then
        cp "server/.env.example" "server/.env"
        echo "✅ Created server/.env from template"
    else
        cat > "server/.env" << EOF
# AI Catalyst Environment Configuration
# This file contains development defaults

JWT_SECRET=dev-secret-key-change-in-production
PORT=3001
NODE_ENV=development
DATABASE_PATH=./data/ai-catalyst.db
EOF
        echo "✅ Created basic server/.env file"
    fi
else
    echo "✅ server/.env already exists"
fi
echo ""

# Create necessary directories
echo "[6/6] Creating directory structure..."

mkdir -p "server/data"
mkdir -p "server/logs"
mkdir -p "server/uploads"

echo "✅ Directory structure created"
echo ""

# Make run script executable
if [ -f "run.sh" ]; then
    chmod +x run.sh
    echo "✅ Made run.sh executable"
fi

# Installation complete
echo "========================================"
echo " 🎉 Installation Complete!"
echo "========================================"
echo ""
echo "The AI Catalyst Launch Wizard has been successfully installed."
echo ""
echo "Next steps:"
echo "1. Run './run.sh' to start the application"
echo "2. Your browser will automatically open to http://localhost:3000"
echo "3. Follow the wizard to explore the AI Catalyst system"
echo ""
echo "Alternative startup methods:"
echo "- npm run dev:full"
echo "- Start servers separately: npm run dev & npm run server:dev"
echo ""
echo "If you encounter any issues:"
echo "- Check the troubleshooting section in README.md"
echo "- Ensure no other applications are using ports 3000 or 3001"
echo "- Try running with sudo if you get permission errors"
echo ""
echo "Press Enter to exit..."
read
