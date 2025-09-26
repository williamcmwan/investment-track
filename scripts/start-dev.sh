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

# Start both client and server concurrently
echo "✅ Starting client and server..."
echo "🌐 Development mode:"
echo "   Frontend: http://localhost:5173 (Vite dev server)"
echo "   Backend: http://localhost:3002 (Express server)"
echo "   API: http://localhost:3002/api"
echo ""
npm run dev
