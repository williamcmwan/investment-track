# Investment Tracker Application Management

## Overview
The `scripts/app.sh` is a unified application management tool that combines and enhances the functionality of the previous separate start scripts into a single, comprehensive solution. This document covers the complete implementation, usage, and migration details.

## 🚀 Key Features

### ✅ Comprehensive Command Structure
```bash
./scripts/app.sh COMMAND [OPTIONS]

Commands:
- start [server|client|all]    # Start components [default: all]
- stop [server|client|all]     # Stop components [default: all]
- force-stop                   # Emergency force stop all processes
- restart [server|client|all]  # Restart components [default: all]
- status                       # Show current application status
- logs [server|client|all] [lines]  # View logs [default: all, 50 lines]
- help                         # Show usage information
```

### ✅ Automatic Environment Detection
- **Development Mode**: Auto-detected when built files don't exist
- **Production Mode**: Auto-detected when built files are present
- Uses appropriate startup commands for each environment

### ✅ Process Management
- **PID Tracking**: Stores process IDs in `pids/` directory for proper management
- **Graceful Shutdown**: Attempts graceful shutdown before force killing
- **Status Monitoring**: Real-time status of all components
- **Component Control**: Start/stop server, client, or both independently

### ✅ Centralized Logging System
- **Structured Logs**: All logs stored in `logs/` directory
- **Component-Specific**: Separate logs for server and client
- **Configurable Output**: View last N lines of logs
- **Colored Output**: Easy-to-read colored console output

### ✅ Enhanced Error Handling
- **Dependency Validation**: Checks required files before starting
- **Clear Error Messages**: Descriptive error messages with solutions
- **Graceful Failure Handling**: Proper cleanup on failures
- **Health Check Integration**: Built-in health check endpoint monitoring

## 📁 File Structure

### Current Organization
```
project-root/
├── scripts/
│   ├── app.sh              # Unified application management script
│   └── deploy.sh           # Deployment script
├── logs/                   # Application logs (auto-created)
│   ├── server.log          # Server logs
│   └── client.log          # Client logs (dev mode)
├── pids/                   # Process ID files (auto-created)
│   ├── server.pid          # Server PID
│   └── client.pid          # Client PID (dev mode)
└── package.json            # Updated with npm scripts
```

### Script Reorganization Changes
- **Moved**: `./app.sh` → `./scripts/app.sh` (better organization)
- **Removed**: `scripts/start-dev.sh` (functionality replaced)
- **Removed**: `scripts/start-production.sh` (functionality replaced)
- **Updated**: All package.json script references
- **Enhanced**: All functionality preserved and improved

## 🛠️ Usage Examples

### Direct Script Usage
```bash
# Start everything (auto-detects environment)
./scripts/app.sh start

# Start only server
./scripts/app.sh start server

# Start only client (development mode only)
./scripts/app.sh start client

# Stop everything
./scripts/app.sh stop

# Emergency stop (force kill all processes)
./scripts/app.sh force-stop

# Restart everything
./scripts/app.sh restart

# Check status
./scripts/app.sh status

# View last 50 lines of all logs
./scripts/app.sh logs

# View last 100 lines of server logs
./scripts/app.sh logs server 100

# View client logs (development mode)
./scripts/app.sh logs client

# View all logs with custom line count
./scripts/app.sh logs all 200
```

### NPM Script Integration
```bash
# Start application
npm run app:start

# Stop application
npm run app:stop

# Restart application
npm run app:restart

# Check status
npm run app:status

# View logs
npm run app:logs

# Direct access to script
npm run app
```

## 🌍 Environment Modes

### Development Mode
- **Detection**: No built files present in `server/dist/` and `client/dist/`
- **Server**: Runs `npm run dev` with hot reloading
- **Client**: Runs `npm run dev` on port 5173
- **Process Management**: Separate processes for server and client
- **URLs**: 
  - Client: http://localhost:5173
  - Server: http://localhost:3002
  - API: http://localhost:3002/api

### Production Mode
- **Detection**: Built files present in `server/dist/` and `client/dist/`
- **Server**: Runs built Node.js application (`node dist/index.js`)
- **Client**: Served as static files by server
- **Process Management**: Single process serving everything
- **URLs**:
  - Application: http://localhost:3002
  - API: http://localhost:3002/api

## ⚙️ Prerequisites

### For Development Mode
- Node.js dependencies installed (`npm run setup`)
- Server and client `node_modules` present
- No built files required

### For Production Mode
- Built application files (`npm run build`)
- Database migrated (`npm run db:migrate`)
- All dependencies installed
- Production environment variables configured

## 🔧 Advanced Features

### Process Monitoring
- Tracks actual process status, not just PID files
- Validates process health before reporting status
- Automatic cleanup of stale PID files

### Log Management
- Centralized logging for easy log management
- Log rotation ready structure
- Component-specific log separation
- Configurable log viewing with line limits

### Health Checks
- Built-in health check endpoint monitoring
- Process validation before status reporting
- Dependency validation before starting

### Flexible Component Control
- Start/stop individual components
- Component-specific restart capabilities
- Emergency force-stop for all processes

## 🚨 Error Handling & Troubleshooting

### Common Issues and Solutions

1. **"Dependencies not installed"**
   - **Solution**: Run `npm run setup`
   - **Cause**: Missing node_modules directories

2. **"Production build not found"**
   - **Solution**: Run `npm run build`
   - **Cause**: Attempting production mode without built files

3. **"Database not found"**
   - **Solution**: Run `npm run db:migrate`
   - **Cause**: Database not initialized

4. **Process won't stop**
   - **Solution**: Use `./scripts/app.sh force-stop`
   - **Cause**: Process not responding to graceful shutdown

### Debug Information
```bash
# Check what's running
./scripts/app.sh status

# View recent logs for troubleshooting
./scripts/app.sh logs all 100

# Force clean restart
./scripts/app.sh force-stop
./scripts/app.sh start

# Check specific component logs
./scripts/app.sh logs server 200
```

## 📋 Migration Guide

### From Old Scripts to New Unified Script

#### For Direct Script Users
- **Old**: `./scripts/start-dev.sh` → **New**: `./scripts/app.sh start`
- **Old**: `./scripts/start-production.sh` → **New**: `./scripts/app.sh start`

#### For NPM Script Users
- **Old**: `npm run start:dev` → **New**: `npm run app:start`
- **Old**: `npm run start:prod` → **New**: `npm run app:start`

#### Migration Benefits
- **No Action Required**: Environment detection is automatic
- **Enhanced Functionality**: All original features preserved and improved
- **Better Control**: Individual component management
- **Improved Logging**: Centralized, viewable logs
- **Status Monitoring**: Real-time application status

## 🎯 Benefits Over Previous Scripts

### Organizational Benefits
1. **Cleaner Project Root**: No scripts cluttering the main directory
2. **Consistent Organization**: All scripts in `scripts/` directory
3. **Reduced Complexity**: Single unified script instead of multiple
4. **Better Maintainability**: One script to maintain instead of three

### Functional Benefits
1. **Single Script**: One script handles both dev and production
2. **Better Process Control**: Proper PID tracking and management
3. **Enhanced Logging**: Centralized, viewable logs
4. **Status Monitoring**: Real-time status of all components
5. **Flexible Control**: Start/stop individual components
6. **Error Recovery**: Force-stop for emergency situations
7. **User-Friendly**: Colored output and clear help messages

### Technical Benefits
1. **Automatic Environment Detection**: No manual mode switching
2. **Graceful Shutdown**: Proper process termination
3. **Health Check Integration**: Built-in monitoring
4. **Dependency Validation**: Pre-flight checks
5. **Log Rotation Ready**: Structured logging system

## 🔄 Implementation Summary

### What Was Created
- **Unified Script**: `scripts/app.sh` with comprehensive functionality
- **Process Management**: PID tracking and graceful shutdown
- **Logging System**: Centralized logs with configurable viewing
- **Status Monitoring**: Real-time application status
- **NPM Integration**: Convenient npm script shortcuts

### What Was Removed
- **Old Scripts**: `start-dev.sh` and `start-production.sh` (obsolete)
- **Redundant NPM Scripts**: `start:dev` and `start:prod` (replaced)

### What Was Enhanced
- **Environment Detection**: Automatic dev/production mode detection
- **Error Handling**: Comprehensive validation and clear messages
- **User Experience**: Colored output and intuitive commands
- **Maintainability**: Single script with modular functions

The unified application management script provides a professional, production-ready solution that significantly improves upon the previous separate scripts while maintaining full backward compatibility through automatic environment detection.