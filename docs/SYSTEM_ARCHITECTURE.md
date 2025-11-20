# System Architecture Guide

**Version:** 1.1  
**Last Updated:** November 20, 2025

Comprehensive guide to the Investment Tracker system architecture, database design, logging, and performance optimization.

---

## Table of Contents

1. [Overview](#overview)
2. [Database Schema](#database-schema)
3. [Logging System](#logging-system)
4. [Memory Optimization](#memory-optimization)
5. [Performance Monitoring](#performance-monitoring)
6. [Best Practices](#best-practices)

---

## Overview

### Architecture Stack

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (React)                        │
│  - Dashboard Analytics  - Account Management               │
│  - Portfolio Views     - Currency Exchange                 │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   Backend (Node.js)                        │
│  - REST API        - Authentication (JWT + 2FA)            │
│  - Broker APIs     - Scheduled Jobs                        │
│  - Data Processing - Real-time Updates                     │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   Database (SQLite)                        │
│  - User Data       - Portfolio Positions                   │
│  - Performance     - Integration Configs                   │
│  - Exchange Rates  - Audit Logs                           │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                External Integrations                       │
│  - Interactive Brokers Gateway                             │
│  - Charles Schwab API (OAuth 2.0)                         │
│  - Yahoo Finance API                                       │
└─────────────────────────────────────────────────────────────┘
```

### Key Components

- **Single Port Architecture**: Everything runs on port 3002
- **Real-time Updates**: WebSocket-like subscriptions for IB data
- **Scheduled Jobs**: Automated data refresh every 30 minutes
- **Multi-tenant**: User-based data isolation
- **Stateless API**: JWT-based authentication

---

## Database Schema

### Core Tables

#### Users Table
```sql
CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    name TEXT,
    base_currency TEXT DEFAULT 'HKD',
    totp_secret TEXT,
    is_totp_enabled BOOLEAN DEFAULT FALSE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

#### Accounts Table
```sql
CREATE TABLE accounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    currency TEXT NOT NULL,
    account_type TEXT DEFAULT 'INVESTMENT', -- 'INVESTMENT' or 'BANK'
    account_number TEXT,
    original_capital DECIMAL(15,2) DEFAULT 0,
    current_balance DECIMAL(15,2) DEFAULT 0,
    integration_type TEXT, -- 'IB', 'SCHWAB', or NULL
    integration_config TEXT, -- JSON configuration
    last_updated DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

### Portfolio Data

#### Unified Portfolios Table
```sql
CREATE TABLE portfolios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    main_account_id INTEGER NOT NULL,
    symbol TEXT NOT NULL,
    sec_type TEXT, -- 'STK', 'BOND', 'CRYPTO', etc.
    currency TEXT NOT NULL,
    country TEXT,
    industry TEXT,
    category TEXT,
    quantity DECIMAL(15,6) NOT NULL,
    average_cost DECIMAL(15,6),
    exchange TEXT,
    primary_exchange TEXT,
    con_id INTEGER, -- IB contract ID
    market_price DECIMAL(15,6),
    market_value DECIMAL(15,2),
    day_change DECIMAL(15,2),
    day_change_percent DECIMAL(8,4),
    close_price DECIMAL(15,6), -- Previous day close
    unrealized_pnl DECIMAL(15,2),
    realized_pnl DECIMAL(15,2),
    notes TEXT,
    source TEXT NOT NULL, -- 'IB', 'SCHWAB', 'MANUAL'
    last_price_update DATETIME,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (main_account_id) REFERENCES accounts(id) ON DELETE CASCADE
);

-- Indexes for performance
CREATE INDEX idx_portfolios_account_source ON portfolios(main_account_id, source);
CREATE INDEX idx_portfolios_symbol ON portfolios(symbol);
CREATE INDEX idx_portfolios_con_id ON portfolios(con_id);
```

#### Cash Balances Table
```sql
CREATE TABLE cash_balances (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id INTEGER NOT NULL,
    currency TEXT NOT NULL,
    amount DECIMAL(15,2) NOT NULL,
    source TEXT NOT NULL, -- 'IB', 'SCHWAB', 'MANUAL'
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX idx_cash_balances_unique ON cash_balances(account_id, currency, source);
```

### Performance Tracking

#### Performance History Table
```sql
CREATE TABLE performance_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    date DATE NOT NULL,
    total_capital DECIMAL(15,2) NOT NULL,
    current_balance DECIMAL(15,2) NOT NULL,
    total_pl DECIMAL(15,2) NOT NULL,
    investment_pl DECIMAL(15,2) NOT NULL,
    currency_pl DECIMAL(15,2) NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX idx_performance_user_date ON performance_history(user_id, date);
```

### Currency & Exchange Rates

#### Currency Pairs Table
```sql
CREATE TABLE currency_pairs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    pair TEXT NOT NULL, -- e.g., 'USD/HKD'
    amount DECIMAL(15,6) NOT NULL,
    avg_cost DECIMAL(15,6) NOT NULL,
    current_rate DECIMAL(15,6),
    last_updated DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX idx_currency_pairs_user_pair ON currency_pairs(user_id, pair);
```

#### Exchange Rates Table
```sql
CREATE TABLE exchange_rates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    from_currency TEXT NOT NULL,
    to_currency TEXT NOT NULL,
    rate DECIMAL(15,6) NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX idx_exchange_rates_pair ON exchange_rates(from_currency, to_currency);
```

### Data Relationships

```
users (1) ──────────── (n) accounts
  │                        │
  │                        ├── (n) portfolios
  │                        └── (n) cash_balances
  │
  ├── (n) performance_history
  └── (n) currency_pairs
```

---

## Logging System

### Log Levels

```typescript
enum LogLevel {
  DEBUG = 0,   // Detailed debugging information
  INFO = 1,    // General information messages
  WARN = 2,    // Warning messages
  ERROR = 3    // Error messages only
}
```

### Configuration

```bash
# Environment variable in .env
LOG_LEVEL=1  # INFO level (default)

# Available levels:
# 0 = DEBUG (verbose, for development)
# 1 = INFO (standard, for production)
# 2 = WARN (warnings and errors only)
# 3 = ERROR (errors only)
```

### Logger Implementation

```typescript
// utils/logger.ts
export class Logger {
  private static logLevel = parseInt(process.env.LOG_LEVEL || '1');
  
  static debug(message: string, ...args: any[]) {
    if (this.logLevel <= LogLevel.DEBUG) {
      console.log(`[${new Date().toISOString()}] [DEBUG]`, message, ...args);
    }
  }
  
  static info(message: string, ...args: any[]) {
    if (this.logLevel <= LogLevel.INFO) {
      console.log(`[${new Date().toISOString()}] [INFO]`, message, ...args);
    }
  }
  
  static warn(message: string, ...args: any[]) {
    if (this.logLevel <= LogLevel.WARN) {
      console.warn(`[${new Date().toISOString()}] [WARN]`, message, ...args);
    }
  }
  
  static error(message: string, ...args: any[]) {
    if (this.logLevel <= LogLevel.ERROR) {
      console.error(`[${new Date().toISOString()}] [ERROR]`, message, ...args);
    }
  }
}
```

### Usage Examples

```typescript
// Service logging
Logger.info('🔄 Starting portfolio refresh...');
Logger.debug('Portfolio positions:', positions);
Logger.warn('⚠️ Close price not found for symbol:', symbol);
Logger.error('❌ Failed to connect to IB Gateway:', error);

// API endpoint logging
app.use((req, res, next) => {
  Logger.debug(`${req.method} ${req.path}`);
  next();
});

// Database operation logging
Logger.debug('Executing query:', sql, params);
Logger.info(`✅ Updated ${changes} records`);
```

---

## Memory Optimization

### Current Memory Usage

```bash
# Check memory usage
ps aux | grep node

# Typical usage:
# - Base application: ~50-80 MB
# - With IB connection: ~100-150 MB
# - Peak during refresh: ~200-300 MB
```

### Optimization Strategies

#### 1. Database Connection Pooling

```typescript
// database/connection.ts
import Database from 'better-sqlite3';

class DatabaseManager {
  private static instance: Database.Database;
  
  static getInstance(): Database.Database {
    if (!this.instance) {
      this.instance = new Database('investment_tracker.db', {
        memory: false,
        readonly: false,
        fileMustExist: false,
        timeout: 5000
      });
      
      // Optimize SQLite settings
      this.instance.pragma('journal_mode = WAL');
      this.instance.pragma('synchronous = NORMAL');
      this.instance.pragma('cache_size = 1000');
      this.instance.pragma('temp_store = MEMORY');
    }
    return this.instance;
  }
}
```

#### 2. Build Memory Configuration

```json
// server/package.json
{
  "scripts": {
    "build": "node --max-old-space-size=4096 ./node_modules/typescript/bin/tsc",
    "start": "node --max-old-space-size=2048 dist/index.js"
  }
}

// client/package.json
{
  "scripts": {
    "build": "node --max-old-space-size=4096 ./node_modules/vite/bin/vite.js build"
  }
}
```

#### 3. Scheduled Job Optimization

```typescript
// services/schedulerService.ts
export class SchedulerService {
  private static async refreshAllData() {
    try {
      // Process users in batches to avoid memory spikes
      const users = await dbAll('SELECT id FROM users');
      const batchSize = 5;
      
      for (let i = 0; i < users.length; i += batchSize) {
        const batch = users.slice(i, i + batchSize);
        
        await Promise.all(batch.map(async (user) => {
          await this.refreshUserData(user.id);
        }));
        
        // Allow garbage collection between batches
        if (global.gc) {
          global.gc();
        }
      }
    } catch (error) {
      Logger.error('Refresh error:', error);
    }
  }
}
```

### Memory Monitoring

```typescript
// utils/memoryMonitor.ts
export class MemoryMonitor {
  static logMemoryUsage() {
    const usage = process.memoryUsage();
    Logger.debug('Memory usage:', {
      rss: `${Math.round(usage.rss / 1024 / 1024)} MB`,
      heapTotal: `${Math.round(usage.heapTotal / 1024 / 1024)} MB`,
      heapUsed: `${Math.round(usage.heapUsed / 1024 / 1024)} MB`,
      external: `${Math.round(usage.external / 1024 / 1024)} MB`
    });
  }
  
  static startMonitoring() {
    setInterval(() => {
      this.logMemoryUsage();
      
      // Force garbage collection if available
      if (global.gc && process.memoryUsage().heapUsed > 200 * 1024 * 1024) {
        Logger.debug('Forcing garbage collection...');
        global.gc();
      }
    }, 60000); // Every minute
  }
}
```

---

## Performance Monitoring

### Key Metrics

#### Database Performance
```sql
-- Query performance analysis
EXPLAIN QUERY PLAN SELECT * FROM portfolios WHERE main_account_id = ?;

-- Index usage
.schema portfolios

-- Table sizes
SELECT 
  name,
  COUNT(*) as row_count
FROM sqlite_master 
WHERE type = 'table'
GROUP BY name;
```

#### API Performance
```typescript
// Middleware for timing
app.use((req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    if (duration > 1000) {
      Logger.warn(`Slow request: ${req.method} ${req.path} took ${duration}ms`);
    }
  });
  
  next();
});
```

---

## Best Practices

### 1. Database Design

✅ **Do:**
- Use appropriate indexes for frequent queries
- Normalize data to reduce redundancy
- Use transactions for multi-table operations
- Regular VACUUM operations for SQLite

❌ **Don't:**
- Store large JSON blobs in database
- Create unnecessary indexes (impacts write performance)
- Use SELECT * in production code
- Ignore foreign key constraints

### 2. API Design

✅ **Do:**
- Use pagination for large datasets
- Implement proper error handling
- Cache frequently accessed data
- Use appropriate HTTP status codes

❌ **Don't:**
- Return sensitive data in API responses
- Ignore rate limiting
- Use synchronous operations for I/O
- Expose internal error details to clients

### 3. Performance Optimization

✅ **Do:**
- Profile code regularly
- Use connection pooling
- Implement caching strategies
- Monitor memory usage

❌ **Don't:**
- Premature optimization
- Ignore memory leaks
- Block the event loop
- Load unnecessary data

---

## Troubleshooting

### Common Issues

#### High Memory Usage
```bash
# Check for memory leaks
node --inspect server/dist/index.js

# Enable garbage collection logging
node --trace-gc server/dist/index.js

# Force garbage collection
node --expose-gc server/dist/index.js
```

#### Slow Database Queries
```sql
-- Enable query logging
PRAGMA query_only = ON;

-- Analyze query plans
EXPLAIN QUERY PLAN SELECT ...

-- Check index usage
.expert
SELECT ...
```

### Health Checks

```typescript
// Health check endpoint
app.get('/api/health', async (req, res) => {
  const health = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    database: 'ok'
  };
  
  try {
    // Test database
    await dbGet('SELECT 1');
  } catch (error) {
    health.status = 'error';
    health.database = 'error';
  }
  
  res.json(health);
});
```

---

**Need Help?** Check the logs first, then review the troubleshooting sections for common solutions.
