# AI Catalyst Launch Wizard - Setup Guide

This guide provides step-by-step instructions for setting up the AI Catalyst Launch Wizard on your computer, designed for users of all technical levels.

## 🎯 Quick Start (Non-Technical Users)

### For Windows Users

1. **Download the Project**
   - Download the AI Catalyst project files to your computer
   - Extract to a folder like `C:\AI-Catalyst` or your Desktop

2. **Install Everything Automatically**
   - Navigate to the AI Catalyst folder
   - **Double-click `install.bat`**
   - The script will:
     - Check if Node.js is installed (show download link if needed)
     - Install all required dependencies automatically
     - Set up the database and configuration files
     - Create necessary folders

3. **Run the Application**
   - **Double-click `run.bat`**
   - The script will:
     - Start both frontend and backend servers
     - Automatically open your browser to http://localhost:3000
     - Show status messages and instructions

4. **Use the Wizard**
   - The AI Catalyst Launch Wizard will open in your browser
   - Follow the 7-step process to explore the system
   - Your progress is automatically saved as you go

### For macOS/Linux Users

1. **Download the Project**
   - Download or clone the AI Catalyst project to your computer
   - Open Terminal and navigate to the project folder

2. **Install Everything Automatically**
   ```bash
   ./install.sh
   ```
   - The script will check for Node.js and provide installation instructions if needed
   - Automatically installs all dependencies and sets up the environment

3. **Run the Application**
   ```bash
   ./run.sh
   ```
   - Starts both servers and opens your browser automatically
   - Shows status and provides instructions for stopping servers

## 🛠️ Manual Setup (For Developers)

### Prerequisites
- **Node.js 18+** - Download from [nodejs.org](https://nodejs.org/)
- **Git** (optional) - For cloning the repository

### Step-by-Step Manual Installation

1. **Clone or Download**
   ```bash
   git clone <repository-url>
   cd ai-catalyst
   ```

2. **Install Dependencies**
   ```bash
   # Automated installation
   npm run setup
   
   # OR manual installation
   npm install
   cd server && npm install && cd ..
   ```

3. **Start the Application**
   ```bash
   # Start everything with one command
   npm start
   
   # OR start servers separately
   npm run dev:full
   ```

## 🔧 Available Commands

### Automated Scripts
- **Windows**: `install.bat` → `run.bat`
- **macOS/Linux**: `./install.sh` → `./run.sh`

### NPM Scripts
- `npm run setup` - Install all dependencies and configure environment
- `npm start` - Start both frontend and backend servers
- `npm run dev:full` - Start both servers with development logging
- `npm run dev` - Start frontend only (port 3000)
- `npm run server:dev` - Start backend only (port 3001)
- `npm run type-check` - Check TypeScript compilation
- `npm run build` - Build for production

## 🚨 Troubleshooting

### Common Issues and Solutions

#### "Node.js not found" Error
**Problem**: The install script says Node.js is not installed
**Solution**: 
1. Download Node.js 18+ from [nodejs.org](https://nodejs.org/)
2. Install it and restart your computer
3. Run the install script again

#### "Port already in use" Error
**Problem**: Ports 3000 or 3001 are already being used
**Solutions**:
1. Close other applications using these ports
2. Restart your computer to free up ports
3. The run script will detect this and offer options

#### "Permission denied" Error
**Problem**: Script can't create files or install dependencies
**Solutions**:
- **Windows**: Right-click the script and "Run as Administrator"
- **macOS/Linux**: Run `sudo ./install.sh` (use with caution)

#### Dependencies Won't Install
**Problem**: npm install fails with network or permission errors
**Solutions**:
1. Check your internet connection
2. Clear npm cache: `npm cache clean --force`
3. Delete `node_modules` folders and try again
4. Try running as Administrator/sudo

#### Browser Doesn't Open Automatically
**Problem**: The wizard doesn't open in your browser
**Solutions**:
1. Manually navigate to http://localhost:3000
2. Wait 30 seconds and refresh the page
3. Check if your firewall is blocking the ports

#### Servers Won't Start
**Problem**: Backend or frontend servers fail to start
**Solutions**:
1. Check the log files in the `logs/` directory
2. Ensure all dependencies are installed
3. Try running `npm run setup` again
4. Check for TypeScript errors with `npm run type-check`

### Getting Help

1. **Check the logs**: Look in `logs/backend.log` and `logs/frontend.log`
2. **Run the test script**: Use `test-scripts.bat` (Windows) to diagnose issues
3. **Check the README.md**: Contains detailed troubleshooting information
4. **Verify your setup**: Ensure Node.js 18+ is properly installed

## 📁 What Gets Installed

### Directories Created
- `node_modules/` - Frontend dependencies
- `server/node_modules/` - Backend dependencies
- `server/data/` - SQLite database location
- `server/logs/` - Server log files
- `logs/` - Application log files

### Configuration Files
- `server/.env` - Environment configuration (created automatically)
- `server/data/ai-catalyst.db` - SQLite database (created on first run)

### Ports Used
- **3000** - Frontend development server
- **3001** - Backend API server

## 🎯 Success Criteria

You'll know the setup worked when:
1. ✅ Both install and run scripts complete without errors
2. ✅ Your browser opens to http://localhost:3000
3. ✅ You see the "AI Catalyst Launch Wizard" interface
4. ✅ You can navigate through the wizard steps
5. ✅ Form data is saved as you progress through steps

## 🔄 Updating the Application

To update to a newer version:
1. Download the new version
2. Run `install.bat` or `./install.sh` again
3. Your data and configuration will be preserved

## 🛑 Stopping the Application

### Windows
- Close both server command windows that opened
- Or press Ctrl+C in each server window

### macOS/Linux
- Press Ctrl+C in the terminal where you ran `./run.sh`
- Or run: `killall node` (stops all Node.js processes)

---

**Need more help?** Check the main README.md file for detailed technical information and contribution guidelines.
