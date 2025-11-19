# IB Integration - Optimized Implementation

## Overview

This is an optimized IB integration implementation using minimal API calls and efficient data processing strategies.

## Core Design Principles

### 1. Subscription Pattern
Use persistent subscriptions instead of repeated requests to minimize API calls.

### 2. Temporary Storage
Real-time updates stored in memory, synced to database every minute.

### 3. Smart Caching
Static data like contract details only fetched when missing, avoiding redundant calls.

## API Call Strategy

### Minimal Call Approach

#### 1. reqAccountUpdates() - Single Subscription for Multiple Data Types
**Purpose:**
- Account balance
- Cash balances by currency
- Position data: symbol, quantity, avgCost, unrealizedPNL

**Features:**
- ✅ One subscription, continuous updates
- ✅ Automatic push on changes
- ✅ Includes multiple data types

**Implementation:**
```typescript
// Subscribe once
this.ibApi.reqAccountUpdates(true, '');

// Handlers receive updates automatically
this.ibApi.on(EventName.updateAccountValue, accountValueHandler);
this.ibApi.on(EventName.updatePortfolio, portfolioHandler);
```

#### 2. reqMktData() - Subscribe to Market Data
**Purpose:**
- Last price
- Close price
- Real-time updates

**Features:**
- ✅ One subscription per position
- ✅ Continuous price updates
- ✅ Automatic day change calculation

**Implementation:**
```typescript
// Subscribe to market data for each position
for (const position of positions) {
  this.ibApi.reqMktData(
    position.conId, // Use conId as reqId
    contract,
    '', // genericTickList
    false, // snapshot
    false // regulatorySnapshot
  );
}

// Handler receives updates automatically
this.ibApi.on('tickPrice', (reqId, tickType, price) => {
  if (tickType === 4) { // Last price
    this.tempStore.marketData.set(reqId, { lastPrice: price });
  } else if (tickType === 9) { // Close price
    this.tempStore.marketData.set(reqId, { closePrice: price });
  }
});
```

#### 3. reqContractDetails() - Fetch Only When Needed
**Purpose:**
- Industry classification
- Category information
- Country/Exchange

**Optimization Strategy:**
- ✅ Check database for existing data
- ✅ Use memory cache to avoid duplicate requests
- ✅ Only call for positions missing data

**Implementation:**
```typescript
// Check database first
const existingData = await dbAll(
  'SELECT con_id, industry, category FROM portfolios WHERE con_id = ?',
  [conId]
);

// Only fetch if missing
if (!existingData || !existingData.industry) {
  const details = await this.getContractDetails(conId);
  // Cache for future use
  this.contractDetailsCache.set(conId, details);
}
```

## Data Flow

### Refresh Flow

```
1. Connect to IB Gateway
   ↓
2. Subscribe to account updates (reqAccountUpdates)
   - Get account balance
   - Get cash balances
   - Get position list
   ↓
3. Subscribe to market data (reqMktData for each position)
   - Last price
   - Close price
   ↓
4. Fetch missing contract details (reqContractDetails if needed)
   - Only if industry/category empty
   ↓
5. Immediate sync to database
   ↓
6. Start periodic sync (every minute)
   ↓
7. Continuous updates
   - Price changes auto-pushed
   - Position changes auto-pushed
   - Temporary storage updated
   ↓
8. Sync to database every minute
```

### Temporary Storage Structure

```typescript
interface TemporaryDataStore {
  // Account values
  accountValues: Map<string, {
    value: string;
    currency: string;
    timestamp: number;
  }>;
  
  // Portfolio updates
  portfolioUpdates: Map<string, PortfolioPosition & {
    timestamp: number;
  }>;
  
  // Market data
  marketData: Map<number, {
    lastPrice: number;
    closePrice: number;
    timestamp: number;
  }>;
  
  // Last sync time
  lastDbSync: number;
}
```

## Usage

### Start Refresh

```typescript
import { IBServiceOptimized } from './services/ibServiceOptimized.js';

// Start optimized refresh
const result = await IBServiceOptimized.refreshPortfolio({
  host: 'localhost',
  port: 4001,
  client_id: 1,
  target_account_id: 123
});

console.log('Balance:', result.balance);
console.log('Positions:', result.portfolio.length);
console.log('Cash:', result.cashBalances);
```

### Check Status

```typescript
const status = IBServiceOptimized.getRefreshStatus();

console.log('Active:', status.isActive);
console.log('Last sync:', new Date(status.lastSync));
console.log('Subscriptions:', status.subscriptions);
```

### Stop Refresh

```typescript
await IBServiceOptimized.stopRefresh();
```

## Performance Benefits

### API Call Comparison

#### Old Method
```
Per refresh:
- reqAccountSummary: 1 call
- reqPositions: 1 call
- reqHistoricalData: N calls (per position)
- reqContractDetails: N calls (per position)
- reqMktData: N calls (per position)

Total: 2 + 3N calls per refresh
Example with 10 positions: 32 calls
```

#### New Method (Optimized)
```
Initial setup:
- reqAccountUpdates: 1 subscription (continuous)
- reqMktData: N subscriptions (continuous)
- reqContractDetails: M calls (only missing data)

Total: 1 + N + M calls (one-time)
Example: 10 positions, 5 need details: 16 calls
No repeated calls afterwards
```

### Call Reduction
- **Initial refresh:** 50% reduction
- **Subsequent updates:** 100% reduction (no calls needed)

### Data Freshness
- **Old:** Updates only on manual refresh
- **New:** Real-time push updates

## Database Synchronization

### Sync Frequency
- **Interval:** Every 60 seconds
- **Triggers:** 
  - Timer-based
  - Immediate after initial refresh

### Sync Content
1. **Account Balance**
   - Update accounts.current_balance
   - Update accounts.currency

2. **Portfolio Positions**
   - Batch delete old data
   - Batch insert new data
   - Include market data calculations

3. **Cash Balances**
   - Update cash by currency
   - Calculate USD equivalent

## Error Handling

### Connection Errors
```typescript
try {
  await IBServiceOptimized.refreshPortfolio(settings);
} catch (error) {
  if (error.message.includes('timeout')) {
    // 重試連接 (Retry connection)
  } else if (error.message.includes('client id')) {
    // 更改 client ID (Change client ID)
  }
}
```

### Subscription Errors
- Auto-cleanup failed subscriptions
- Log errors but continue processing

### Sync Errors
- Sync failures don't affect subscriptions
- Next timer will retry

## Best Practices

### 1. Refresh on Startup
```typescript
// Execute once on app startup
await IBServiceOptimized.refreshPortfolio(settings);
```

### 2. Keep Connection Alive
```typescript
// Subscriptions keep connection alive
// No manual keep-alive needed
```

### 3. Graceful Shutdown
```typescript
// Cleanup on app shutdown
process.on('SIGTERM', async () => {
  await IBServiceOptimized.stopRefresh();
  await IBServiceOptimized.disconnect();
});
```

### 4. Monitor Status
```typescript
// Periodically check status
setInterval(() => {
  const status = IBServiceOptimized.getRefreshStatus();
  if (!status.isActive) {
    // Restart refresh
  }
}, 5 * 60 * 1000); // Every 5 minutes
```

## Migration Guide

### Migrating from Old Service

#### Replace Calls

**Old Code:**
```typescript
// Multiple calls
const balance = await IBService.forceRefreshAccountBalance(settings);
const portfolio = await IBService.forceRefreshPortfolio(settings);
const cash = await IBService.forceRefreshCashBalances(settings);
```

**New Code:**
```typescript
// Single call
const result = await IBServiceOptimized.refreshPortfolio(settings);
// result contains all data
```

#### Stop Refresh

**Old Code:**
```typescript
await IBService.disconnect();
```

**New Code:**
```typescript
await IBServiceOptimized.stopRefresh();
await IBServiceOptimized.disconnect();
```

## Troubleshooting

### Issue: Data Not Updating
**Check:**
```typescript
const status = IBServiceOptimized.getRefreshStatus();
console.log('Active:', status.isActive);
console.log('Last sync:', new Date(status.lastSync));
```

**Solution:**
- Confirm subscriptions active
- Check IB Gateway connection
- Restart refresh

### Issue: Sync Failures
**Check Logs:**
```
💾 Syncing data to database...
❌ Database sync failed: [error message]
```

**Solution:**
- Check database connection
- Verify table schema
- Check disk space

### Issue: Missing Market Data
**Causes:**
- Invalid contract ID
- Market data permissions
- IB Gateway settings

**Solution:**
- Verify conId exists
- Check IB account permissions
- Use delayed data: reqMarketDataType(3)

## Summary

### Key Improvements
1. ✅ **50-100% fewer API calls**
2. ✅ **Real-time data updates**
3. ✅ **Smart caching strategy**
4. ✅ **Batch database operations**
5. ✅ **Graceful error handling**

### Use Cases
- ✅ Apps needing real-time data
- ✅ Accounts with multiple positions
- ✅ Frequent portfolio viewing
- ✅ Long-running services

### Not Suitable For
- ❌ One-time data fetch
- ❌ Short-lived scripts
- ❌ No need for real-time updates
