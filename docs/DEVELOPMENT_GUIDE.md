# Development Guide

**Version:** 1.1  
**Last Updated:** November 20, 2025

Comprehensive guide for developers working on the Investment Tracker application.

---

## Table of Contents

1. [Development Setup](#development-setup)
2. [Project Structure](#project-structure)
3. [Coding Standards](#coding-standards)
4. [Data Refresh System](#data-refresh-system)
5. [Testing Guidelines](#testing-guidelines)
6. [Deployment](#deployment)

---

## Development Setup

### Prerequisites

- **Node.js**: v18+ (LTS recommended)
- **npm**: v8+
- **Git**: Latest version
- **VS Code**: Recommended IDE

### Initial Setup

```bash
# Clone repository
git clone https://github.com/williamcmwan/investment-track.git
cd investment-track

# Install dependencies
npm run install:all

# Setup environment
cp server/.env.example server/.env
cp client/.env.example client/.env

# Initialize database
npm run db:init

# Start development servers
npm run dev
```

### Environment Configuration

#### Server (.env)
```bash
# Database
DATABASE_URL=./investment_tracker.db

# Authentication
JWT_SECRET=your-super-secret-jwt-key-here
JWT_EXPIRES_IN=7d

# Logging
LOG_LEVEL=1  # 0=DEBUG, 1=INFO, 2=WARN, 3=ERROR

# CORS
CORS_ORIGIN=http://localhost:3002

# Charles Schwab Integration
SCHWAB_APP_KEY=your_schwab_app_key
SCHWAB_APP_SECRET=your_schwab_app_secret
SCHWAB_REDIRECT_URI=http://localhost:3002/api/schwab/callback

# External APIs
YAHOO_FINANCE_TIMEOUT=10000
EXCHANGE_RATE_TIMEOUT=5000
```

#### Client (.env)
```bash
# API Configuration
REACT_APP_API_URL=http://localhost:3002/api

# Feature Flags
REACT_APP_ENABLE_2FA=true
REACT_APP_ENABLE_SCHWAB=true
```

### Development Scripts

```bash
# Development
npm run dev              # Start both client and server
npm run dev:client       # Client only
npm run dev:server       # Server only

# Building
npm run build            # Build both
npm run build:client     # Client only
npm run build:server     # Server only

# Database
npm run db:init          # Initialize database
npm run db:migrate       # Run migrations
npm run db:seed          # Seed test data
npm run db:reset         # Reset database

# Testing
npm run test             # Run all tests
npm run test:client      # Client tests
npm run test:server      # Server tests

# Linting
npm run lint             # Lint all code
npm run lint:fix         # Fix linting issues

# Production
npm run start            # Start production server
npm run pm2:start        # Start with PM2
npm run pm2:stop         # Stop PM2
```

---

## Project Structure

```
investment-track/
├── client/                 # React frontend
│   ├── public/
│   ├── src/
│   │   ├── components/     # React components
│   │   ├── contexts/       # React contexts
│   │   ├── hooks/          # Custom hooks
│   │   ├── services/       # API services
│   │   ├── types/          # TypeScript types
│   │   └── utils/          # Utility functions
│   ├── package.json
│   └── tsconfig.json
├── server/                 # Node.js backend
│   ├── src/
│   │   ├── database/       # Database connection & migrations
│   │   ├── middleware/     # Express middleware
│   │   ├── models/         # Data models
│   │   ├── routes/         # API routes
│   │   ├── services/       # Business logic
│   │   ├── types/          # TypeScript types
│   │   └── utils/          # Utility functions
│   ├── package.json
│   └── tsconfig.json
├── docs/                   # Documentation
├── scripts/                # Build & deployment scripts
├── package.json            # Root package.json
└── README.md
```

### Key Directories

#### Client Structure
```
client/src/
├── components/
│   ├── ui/                 # Reusable UI components
│   ├── Dashboard.tsx       # Main dashboard
│   ├── AccountsView.tsx    # Account management
│   ├── CurrencyView.tsx    # Currency exchange
│   └── PortfolioView.tsx   # Portfolio analytics
├── contexts/
│   ├── AuthContext.tsx     # Authentication state
│   └── ThemeContext.tsx    # Theme management
├── services/
│   ├── api.ts              # API client
│   └── auth.ts             # Authentication service
└── hooks/
    ├── useAuth.ts          # Authentication hook
    ├── useToast.ts         # Toast notifications
    └── useLocalStorage.ts  # Local storage hook
```

#### Server Structure
```
server/src/
├── routes/
│   ├── auth.ts             # Authentication endpoints
│   ├── accounts.ts         # Account management
│   ├── ib.ts               # Interactive Brokers
│   ├── schwab.ts           # Charles Schwab
│   └── performance.ts      # Performance tracking
├── services/
│   ├── ibServiceOptimized.ts      # IB integration
│   ├── schwabService.ts           # Schwab integration
│   ├── schedulerService.ts        # Scheduled jobs
│   ├── exchangeRateService.ts     # Exchange rates
│   └── performanceHistoryService.ts # Performance tracking
├── database/
│   ├── connection.ts       # Database connection
│   ├── migrations/         # Database migrations
│   └── seeds/              # Test data
└── utils/
    ├── logger.ts           # Logging utility
    ├── auth.ts             # JWT utilities
    └── validation.ts       # Input validation
```

---

## Coding Standards

### TypeScript Guidelines

#### Interfaces and Types
```typescript
// Use interfaces for object shapes
interface User {
  id: number;
  email: string;
  name?: string;
  createdAt: Date;
}

// Use types for unions and computed types
type AccountType = 'INVESTMENT' | 'BANK';
type UserWithAccounts = User & { accounts: Account[] };

// Use enums for constants
enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3
}
```

#### Function Declarations
```typescript
// Use async/await for asynchronous operations
async function fetchUserData(userId: number): Promise<User | null> {
  try {
    const response = await apiClient.get(`/users/${userId}`);
    return response.data;
  } catch (error) {
    Logger.error('Failed to fetch user data:', error);
    return null;
  }
}

// Use arrow functions for callbacks
const users = await Promise.all(
  userIds.map(async (id) => await fetchUserData(id))
);
```

### React Guidelines

#### Component Structure
```typescript
import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';

interface DashboardProps {
  userId: number;
  onRefresh?: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ 
  userId, 
  onRefresh 
}) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<DashboardData | null>(null);

  // Memoize callbacks
  const handleRefresh = useCallback(async () => {
    setLoading(true);
    try {
      const newData = await fetchDashboardData(userId);
      setData(newData);
      onRefresh?.();
    } catch (error) {
      console.error('Refresh failed:', error);
    } finally {
      setLoading(false);
    }
  }, [userId, onRefresh]);

  // Use effects properly
  useEffect(() => {
    handleRefresh();
  }, [handleRefresh]);

  if (!user) {
    return <div>Please log in</div>;
  }

  return (
    <div className="dashboard">
      <h1>Dashboard</h1>
      {loading ? (
        <div>Loading...</div>
      ) : (
        <div>{/* Dashboard content */}</div>
      )}
      <Button onClick={handleRefresh} disabled={loading}>
        Refresh
      </Button>
    </div>
  );
};

export default Dashboard;
```

### API Guidelines

#### Route Structure
```typescript
import { Router } from 'express';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth.js';
import { Logger } from '../utils/logger.js';

const router = Router();

// Apply authentication middleware
router.use(authenticateToken);

// GET endpoint
router.get('/accounts', async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.id;
    const accounts = await getAccountsByUserId(userId);
    
    res.json({
      success: true,
      data: accounts
    });
  } catch (error) {
    Logger.error('Failed to fetch accounts:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch accounts'
    });
  }
});

// POST endpoint with validation
router.post('/accounts', async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.id;
    const { name, currency, accountType } = req.body;
    
    // Validate input
    if (!name || !currency) {
      return res.status(400).json({
        success: false,
        error: 'Name and currency are required'
      });
    }
    
    const account = await createAccount({
      userId,
      name,
      currency,
      accountType: accountType || 'INVESTMENT'
    });
    
    res.status(201).json({
      success: true,
      data: account
    });
  } catch (error) {
    Logger.error('Failed to create account:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create account'
    });
  }
});

export default router;
```

---

## Data Refresh System

### Overview

The application uses a sophisticated data refresh system with multiple schedules and sources:

```
┌─────────────────────────────────────────────────────────────┐
│                    Scheduler Service                        │
│  - Daily snapshots (23:59)                                │
│  - 30-min refresh cycle                                    │
│  - Schwab refresh (1 min)                                 │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   Data Sources                              │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐          │
│  │ IB Gateway  │ │ Schwab API  │ │Yahoo Finance│          │
│  │ Real-time   │ │ Every 1min  │ │ Every 30min │          │
│  └─────────────┘ └─────────────┘ └─────────────┘          │
└─────────────────────────────────────────────────────────────┘
```

### Scheduled Jobs

#### 1. Daily Performance Snapshot (23:59)
```typescript
// Runs every day at 23:59 Dublin time
cron.schedule('59 23 * * *', async () => {
  await SchedulerService.calculateDailySnapshots();
});

// Process:
// 1. Copy IB bond prices to close prices
// 2. Calculate performance snapshots for all users
// 3. Store in performance_history table
```

#### 2. Data Refresh Cycle (Every 30 minutes)
```typescript
// Runs every 30 minutes
cron.schedule('*/30 * * * *', async () => {
  await SchedulerService.refreshAllData();
});

// Process:
// Step 1: Currency exchange rates
// Step 2: Manual investment market data
// Step 3: IB close prices from Yahoo Finance
// Step 4: Recalculate performance snapshots
```

#### 3. Schwab Portfolio Refresh (Every 1 minute)
```typescript
// Runs every minute
cron.schedule('* * * * *', async () => {
  await SchedulerService.refreshSchwabPortfolios();
});

// Process:
// 1. Find all accounts with Schwab integration
// 2. Refresh portfolio and balance for each
// 3. Update database with new data
```

### Real-time Updates

#### Interactive Brokers
```typescript
// Subscription-based updates
export class IBServiceOptimized {
  static async refreshPortfolio(settings) {
    // 1. Connect to IB Gateway
    await this.connectToIB(settings);
    
    // 2. Subscribe to account updates
    this.ibApi.on(EventName.updatePortfolio, (contract, position, marketPrice, marketValue, averageCost, unrealizedPNL, realizedPNL, accountName) => {
      // Real-time position updates
      this.handlePortfolioUpdate(contract, position, marketPrice, marketValue, averageCost, unrealizedPNL, realizedPNL);
    });
    
    // 3. Sync to database every 60 seconds
    setInterval(() => {
      this.syncToDatabase();
    }, 60000);
  }
}
```

---

## Testing Guidelines

### Unit Testing

```typescript
// tests/services/exchangeRateService.test.ts
import { ExchangeRateService } from '../../src/services/exchangeRateService';
import { jest } from '@jest/globals';

describe('ExchangeRateService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  
  describe('fetchExchangeRate', () => {
    it('should fetch exchange rate successfully', async () => {
      const mockRate = 7.8;
      jest.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ rate: mockRate })
      } as Response);
      
      const result = await ExchangeRateService.fetchExchangeRate('USD', 'HKD');
      
      expect(result).toBe(mockRate);
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('USD/HKD')
      );
    });
  });
});
```

---

## Deployment

### Production Build

```bash
# Build for production
npm run build

# Test production build locally
npm run start

# Or use PM2
npm run pm2:start
```

### Environment Setup

#### Production .env
```bash
# Database
DATABASE_URL=/var/lib/investment-tracker/database.db

# Security
JWT_SECRET=your-production-jwt-secret-here
JWT_EXPIRES_IN=7d

# Logging
LOG_LEVEL=1  # INFO level for production

# CORS
CORS_ORIGIN=https://your-domain.com

# Integrations
SCHWAB_APP_KEY=your_production_schwab_key
SCHWAB_APP_SECRET=your_production_schwab_secret
SCHWAB_REDIRECT_URI=https://your-domain.com/api/schwab/callback
```

#### PM2 Configuration
```json
// ecosystem.config.json
{
  "apps": [{
    "name": "investment-tracker",
    "script": "server/dist/index.js",
    "instances": 1,
    "exec_mode": "fork",
    "env": {
      "NODE_ENV": "production",
      "PORT": 3002
    },
    "log_file": "logs/app.log",
    "error_file": "logs/error.log",
    "out_file": "logs/out.log",
    "log_date_format": "YYYY-MM-DD HH:mm:ss Z",
    "max_log_files": 10,
    "log_max_size": "10M"
  }]
}
```

---

**Need Help?** Check the troubleshooting sections in the relevant guides or review server logs for detailed error messages.
