# IB Service Migration Guide
## Migrating from Old to Optimized Service

## Overview

This guide will help you migrate from the old `IBService` to the new `IBServiceOptimized`.

## Pre-Migration Checklist

### 1. Backup Database
```bash
# Backup SQLite database
cp investment-tracker.db investment-tracker.db.backup

# Or use SQLite command
sqlite3 investment-tracker.db ".backup investment-tracker.db.backup"
```

### 2. Check Current Configuration
```bash
# Check IB connection settings
sqlite3 investment-tracker.db "SELECT * FROM ib_connections;"

# Check account configuration
sqlite3 investment-tracker.db "SELECT id, name, integration_type FROM accounts WHERE integration_type = 'IB';"
```

### 3. Record Current Performance
```typescript
// Test current refresh time
const startTime = Date.now();
await IBService.forceRefreshAll(settings);
const duration = Date.now() - startTime;
console.log(`Current refresh time: ${duration}ms`);
```

## Migration Steps

### Step 1: Install New Service

```bash
# Copy optimized service file
cp server/src/services/ibServiceOptimized.ts server/src/services/

# Confirm file exists
ls -la server/src/services/ibServiceOptimized.ts
```

### Step 2: Create Test Routes

Create `server/src/routes/ibOptimizedTest.ts`:

```typescript
import { Router } from 'express';
import { IBServiceOptimized } from '../services/ibServiceOptimized.js';
import { IBService } from '../services/ibService.js';
import { Logger } from '../utils/logger.js';

const router = Router();

// Comparison test endpoint
router.post('/compare-refresh/:accountId', async (req, res) => {
  try {
    const { accountId } = req.params;
    
    // Get settings
    const { dbGet } = await import('../database/connection.js');
    const account = await dbGet(
      'SELECT integration_config FROM accounts WHERE id = ?',
      [accountId]
    );
    
    const config = JSON.parse(account.integration_config);
    const settings = {
      host: config.host,
      port: config.port,
      client_id: config.clientId,
      target_account_id: parseInt(accountId)
    };

    // Test old service
    Logger.info('Testing old service...');
    const oldStart = Date.now();
    const oldResult = await IBService.forceRefreshAll(settings);
    const oldDuration = Date.now() - oldStart;

    // Wait to avoid conflicts
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Test new service
    Logger.info('Testing new service...');
    const newStart = Date.now();
    const newResult = await IBServiceOptimized.refreshPortfolio(settings);
    const newDuration = Date.now() - newStart;

    // Compare results
    const comparison = {
      old: {
        duration: oldDuration,
        positionCount: oldResult.portfolio.length,
        balance: oldResult.balance.balance
      },
      new: {
        duration: newDuration,
        positionCount: newResult.portfolio.length,
        balance: newResult.balance.balance
      },
      improvement: {
        speedup: `${Math.round((1 - newDuration / oldDuration) * 100)}%`,
        timeSaved: `${Math.round((oldDuration - newDuration) / 1000)}s`
      }
    };

    res.json({
      success: true,
      comparison
    });

  } catch (error: any) {
    Logger.error('Comparison test failed:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
```

### Step 3: Register Test Routes

In `server/src/app.ts` or main application file:

```typescript
import ibOptimizedTest from './routes/ibOptimizedTest.js';

// Add test routes
app.use('/api/ib-test', ibOptimizedTest);
```

### Step 4: Run Comparison Test

```bash
# Start server
npm run dev

# In another terminal, run test
curl -X POST http://localhost:3000/api/ib-test/compare-refresh/123
```

Expected Output:
```json
{
  "success": true,
  "comparison": {
    "old": {
      "duration": 234000,
      "positionCount": 10,
      "balance": 50000
    },
    "new": {
      "duration": 38000,
      "positionCount": 10,
      "balance": 50000
    },
    "improvement": {
      "speedup": "84%",
      "timeSaved": "196s"
    }
  }
}
```

### Step 5: Run in Parallel

Create feature flag:

```typescript
// server/src/config/featureFlags.ts
export const FeatureFlags = {
  USE_OPTIMIZED_IB: process.env.USE_OPTIMIZED_IB === 'true'
};
```

Update existing routes:

```typescript
import { FeatureFlags } from '../config/featureFlags.js';
import { IBService } from '../services/ibService.js';
import { IBServiceOptimized } from '../services/ibServiceOptimized.js';

router.post('/refresh/:accountId', async (req, res) => {
  try {
    const { accountId } = req.params;
    // ... get settings ...

    let result;
    if (FeatureFlags.USE_OPTIMIZED_IB) {
      Logger.info('Using optimized IB service');
      result = await IBServiceOptimized.refreshPortfolio(settings);
    } else {
      Logger.info('Using legacy IB service');
      const oldResult = await IBService.forceRefreshAll(settings);
      result = {
        balance: oldResult.balance,
        portfolio: oldResult.portfolio,
        cashBalances: oldResult.cashBalances
      };
    }

    res.json({ success: true, data: result });

  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});
```

### Step 6: Gradual Rollout

#### 6.1 Enable for Single Account

```bash
# Set environment variable
export USE_OPTIMIZED_IB=true

# Restart server
npm run dev
```

Test single account:
```bash
curl -X POST http://localhost:3000/api/ib/refresh/123
```

#### 6.2 Monitor Performance

```typescript
// Add performance monitoring
router.post('/refresh/:accountId', async (req, res) => {
  const startTime = Date.now();
  
  try {
    // ... refresh logic ...
    
    const duration = Date.now() - startTime;
    Logger.info(`Refresh completed in ${duration}ms`);
    
    // Log to database or monitoring system
    await logPerformance({
      accountId,
      service: FeatureFlags.USE_OPTIMIZED_IB ? 'optimized' : 'legacy',
      duration,
      success: true
    });
    
  } catch (error) {
    // ... error handling ...
  }
});
```

#### 6.3 Enable for All Accounts

After confirming tests are successful:

```bash
# Set in production environment
export USE_OPTIMIZED_IB=true

# Or in .env file
echo "USE_OPTIMIZED_IB=true" >> .env
```

### Step 7: Clean Up Old Code

After confirming new service is stable for 1-2 weeks:

#### 7.1 Remove Feature Flag

```typescript
// Use optimized service directly
router.post('/refresh/:accountId', async (req, res) => {
  try {
    const result = await IBServiceOptimized.refreshPortfolio(settings);
    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});
```

#### 7.2 Remove Old Service References

```bash
# Search all references
grep -r "IBService" server/src/

# Replace with IBServiceOptimized
# Ensure no references are missed
```

#### 7.3 Archive Old Code

```bash
# Create archive directory
mkdir -p server/src/services/archived

# Move old service
mv server/src/services/ibService.ts server/src/services/archived/

# Add README
echo "Archived on $(date). Replaced by ibServiceOptimized.ts" > server/src/services/archived/README.md
```

## Rollback Plan

If you encounter issues and need to rollback:

### Quick Rollback

```bash
# Method 1: Use feature flag
export USE_OPTIMIZED_IB=false
# Restart server

# Method 2: Restore old code
git revert HEAD
git push origin main
```

### Data Recovery

```bash
# If data has issues, restore backup
cp investment-tracker.db.backup investment-tracker.db

# Re-run old service refresh
curl -X POST http://localhost:3000/api/ib/refresh/123
```

## Verification Checklist

After migration, verify the following:

### Functional Verification

- [ ] Account balance correct
- [ ] Position count matches
- [ ] Market prices updating
- [ ] Day change calculated correctly
- [ ] Cash balances correct
- [ ] Industry/category displayed

### Performance Verification

- [ ] Initial refresh < 60 seconds
- [ ] Data updates every minute
- [ ] No rate limit errors
- [ ] CPU usage normal
- [ ] Memory usage stable

### Stability Verification

- [ ] 24h run without errors
- [ ] Auto-reconnect on disconnect
- [ ] Error handling correct
- [ ] Logging complete

## Common Issues

### Issue 1: Data Mismatch

**Symptoms:**
- New and old services return inconsistent data

**Solution:**
```typescript
// Add data validation
function validateData(oldData: any, newData: any) {
  const tolerance = 0.01; // 1% tolerance
  
  // Check balance
  const balanceDiff = Math.abs(oldData.balance - newData.balance);
  if (balanceDiff > oldData.balance * tolerance) {
    Logger.warn('Balance mismatch:', { old: oldData.balance, new: newData.balance });
  }
  
  // Check position count
  if (oldData.portfolio.length !== newData.portfolio.length) {
    Logger.warn('Position count mismatch:', {
      old: oldData.portfolio.length,
      new: newData.portfolio.length
    });
  }
}
```

### Issue 2: Subscriptions Not Starting

**Symptoms:**
- `getRefreshStatus()` shows `isActive: false`

**Solution:**
```typescript
// Check connection status
const status = IBServiceOptimized.getRefreshStatus();
if (!status.isActive) {
  Logger.warn('Subscriptions not active, restarting...');
  await IBServiceOptimized.stopRefresh();
  await new Promise(resolve => setTimeout(resolve, 2000));
  await IBServiceOptimized.refreshPortfolio(settings);
}
```

### Issue 3: Memory Leak

**Symptoms:**
- Memory usage continuously grows

**Solution:**
```typescript
// Periodic cleanup
setInterval(async () => {
  const memUsage = process.memoryUsage();
  Logger.info('Memory usage:', {
    heapUsed: `${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`,
    heapTotal: `${Math.round(memUsage.heapTotal / 1024 / 1024)}MB`
  });
  
  // If memory usage too high, restart subscriptions
  if (memUsage.heapUsed > 500 * 1024 * 1024) { // 500MB
    Logger.warn('High memory usage, restarting subscriptions...');
    await IBServiceOptimized.stopRefresh();
    await new Promise(resolve => setTimeout(resolve, 5000));
    await IBServiceOptimized.refreshPortfolio(settings);
  }
}, 10 * 60 * 1000); // Check every 10 minutes
```

## Monitoring Recommendations

### 1. Performance Monitoring

```typescript
// Log key metrics
interface PerformanceMetrics {
  refreshDuration: number;
  positionCount: number;
  lastSyncAge: number;
  subscriptionCount: number;
  errorCount: number;
}

async function collectMetrics(): Promise<PerformanceMetrics> {
  const status = IBServiceOptimized.getRefreshStatus();
  
  return {
    refreshDuration: 0, // Get from logs
    positionCount: status.subscriptions.marketDataCount,
    lastSyncAge: Date.now() - status.lastSync,
    subscriptionCount: status.subscriptions.marketDataCount,
    errorCount: 0 // Get from error logs
  };
}

// Periodically collect and send to monitoring system
setInterval(async () => {
  const metrics = await collectMetrics();
  // Send to Prometheus, Datadog, etc.
}, 60000);
```

### 2. Alert Configuration

```typescript
// Set alert thresholds
const ALERT_THRESHOLDS = {
  maxSyncAge: 5 * 60 * 1000, // 5 minutes
  maxRefreshDuration: 120 * 1000, // 2 minutes
  maxErrorRate: 0.05 // 5%
};

async function checkAlerts() {
  const status = IBServiceOptimized.getRefreshStatus();
  
  // Check sync delay
  const syncAge = Date.now() - status.lastSync;
  if (syncAge > ALERT_THRESHOLDS.maxSyncAge) {
    await sendAlert({
      level: 'warning',
      message: `IB sync delayed: ${Math.round(syncAge / 1000)}s`
    });
  }
  
  // Check subscription status
  if (!status.isActive) {
    await sendAlert({
      level: 'critical',
      message: 'IB subscriptions not active'
    });
  }
}

setInterval(checkAlerts, 60000);
```

## Summary

Key migration steps:

1. ✅ Backup data
2. ✅ Parallel testing
3. ✅ Gradual rollout
4. ✅ Monitor performance
5. ✅ Verify functionality
6. ✅ Clean up old code

Expected benefits:
- 🚀 84% faster initial refresh
- 📊 Real-time data updates
- � 949% fewer API calls
- 🎯 Better user experience

For questions, refer to:
- `docs/IB_OPTIMIZED.md` - Detailed documentation
- `docs/IB_COMPARISON.md` - Performance comparison
- `server/src/routes/ibOptimized.example.ts` - Usage examples
