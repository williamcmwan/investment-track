#!/bin/bash

# Investment Tracker Development Start Script
# Simple shell script to start both client and server in development mode

set -e

echo "🚀 Starting Investment Tracker in development mode..."

# Check if dependencies are installed
if [ ! -d "node_modules" ] || [ ! -d "client/node_modules" ] || [ ! -d "server/node_modules" ]; then
    echo "❌ Dependencies not installed. Please run './deploy.sh' first."
    exit 1
fi

# Start server (which serves both API and static files)
echo "✅ Starting server..."
echo "🌐 Development mode:"
echo "   Application: http://localhost:3002"
echo "   API: http://localhost:3002/api"
echo "   Health: http://localhost:3002/health"
echo ""
npm run dev
