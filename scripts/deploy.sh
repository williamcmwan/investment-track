#!/bin/bash

# Investment Tracker Deployment Script
# Simple shell script for deployment without Docker

set -e

echo "🚀 Starting Investment Tracker deployment..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js first."
    exit 1
fi

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed. Please install npm first."
    exit 1
fi

echo "✅ Node.js and npm are installed"

# Create environment files if they don't exist
if [ ! -f "client/.env" ]; then
    echo "📝 Creating client/.env file..."
    echo "VITE_API_URL=http://localhost:3002/api" > client/.env
fi

if [ ! -f "server/.env" ]; then
    echo "📝 Creating server/.env file..."
    cat > server/.env << EOF
PORT=3002
NODE_ENV=production
DATABASE_PATH=./data/investment_tracker.db
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
JWT_EXPIRES_IN=7d
CORS_ORIGIN=http://localhost:3002
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
EOF
    echo "⚠️  Please update CORS_ORIGIN in server/.env for production deployment"
else
    echo "📝 Preserving existing server/.env file"
    echo "⚠️  Ensure CORS_ORIGIN in server/.env is set to your production domain"
fi

# Create data directory
if [ ! -d "server/data" ]; then
    echo "📁 Creating data directory..."
    mkdir -p server/data
fi

echo "📦 Installing dependencies..."

# Install root dependencies
echo "📦 Installing root dependencies..."
npm install

# Install client dependencies
echo "📦 Installing client dependencies..."
cd client
npm install
cd ..

# Install server dependencies
echo "📦 Installing server dependencies..."
cd server
npm install
cd ..

echo "🔨 Building applications..."

# Build client
echo "🔨 Building client..."
cd client
npm run build
cd ..

# Skip server build for now - we'll run with tsx directly
echo "🔨 Skipping server build - will run with tsx directly"

echo "🗄️ Setting up database..."

# Run database migrations
echo "🗄️ Running database migrations..."
cd server
npm run db:migrate
cd ..

# Seed database
echo "🌱 Seeding database..."
cd server
npm run db:seed
cd ..

echo "✅ Deployment completed successfully!"
echo ""
echo "🌐 Application is now ready:"
echo "   Application: http://localhost:3002"
echo "   API: http://localhost:3002/api"
echo "   Health Check: http://localhost:3002/health"
echo "   Database: SQLite database created"
echo ""
echo "🚀 To start the application:"
echo "   Production: ./scripts/start-production.sh"
echo ""
echo "📊 Demo credentials:"
echo "   Email: demo@example.com"
echo "   Password: demo123"
echo ""
echo "⚠️  Remember to:"
echo "   1. Update JWT_SECRET in server/.env"
echo "   2. Configure proper CORS_ORIGIN for production"
echo "   3. Configure proper database backups"