#!/bin/bash

# Investment Tracker Production Start Script
# Simple shell script to start the production server

set -e

echo "🚀 Starting Investment Tracker in production mode..."

# Check if server source exists
if [ ! -d "server/src" ]; then
    echo "❌ Server source not found. Please run './deploy.sh' first."
    exit 1
fi

# Check if database exists
if [ ! -f "server/data/investment_tracker.db" ]; then
    echo "❌ Database not found. Please run './deploy.sh' first to set up the database."
    exit 1
fi

# Start the server with tsx
echo "✅ Starting server with tsx..."
echo "🌐 Application will be available at: http://localhost:3002"
echo "🔗 API endpoints: http://localhost:3002/api"
echo "📊 Health check: http://localhost:3002/health"
echo ""
cd server
npx tsx src/index.ts
