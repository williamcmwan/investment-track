# IB Gateway Request Throttling

## Problem

The IB Gateway Historical Data Farm gets yellow alerts after running for a while, causing the application to fail when getting last prices for stocks, bonds, and crypto. This happens due to **pacing violations** when exceeding Interactive Brokers' API rate limits.

## IB Gateway Rate Limits

- **Historical Data**: Maximum 60 requests per 10 minutes
- **Market Data**: Maximum 100 requests per second (but practically much lower)
- **Error Codes**:
  - `162`: Historical data pacing violation
  - `420`: Market data farm connection issue (often related to pacing)

## Solution Implemented

### 1. Request Throttling (`IBRequestThrottler`)

A new throttling service that:
- Enforces a **2-second delay** between historical data requests
- Limits to **50 requests per 10 minutes** (conservative, below IB's 60 limit)
- Tracks request counts in a rolling 10-minute window
- Automatically resets counters after 10 minutes

### 2. Pacing Violation Detection

When error codes 162 or 420 are detected:
- Automatically pauses ALL requests for **10 minutes**
- Logs clear warnings about the cooldown period
- Prevents further violations by blocking requests during cooldown

### 3. Sequential Processing

Changed portfolio enrichment from parallel (`Promise.all`) to **sequential processing**:
- Processes one position at a time
- Prevents overwhelming IB Gateway with simultaneous requests
- Applies throttling between each request

### 4. Increased Timeouts

- Historical data timeout increased from 8s to **15 seconds**
- Gives IB Gateway more time to respond, especially for bonds and crypto

## Usage

The throttling is automatic and requires no configuration. However, you can:

### Check Throttling Status

```typescript
const status = IBRequestThrottler.getStatus();
console.log(`Requests: ${status.requestCount}/${status.maxRequests}`);
console.log(`In cooldown: ${status.isPacingViolation}`);
console.log(`Minutes remaining: ${status.cooldownMinutesRemaining}`);
```

### Manual Reset (if needed)

```typescript
IBRequestThrottler.reset();
```

## Best Practices

1. **Avoid frequent refreshes**: Wait at least 5-10 minutes between full portfolio refreshes
2. **Use cached data**: The app stores data in the database - use that instead of refreshing constantly
3. **Monitor logs**: Watch for throttling warnings and adjust refresh frequency accordingly
4. **Stagger requests**: If you have multiple accounts, don't refresh them all at once

## What to Do If You Get Yellow Alerts

1. **Wait 10 minutes**: The throttler will automatically pause requests
2. **Check logs**: Look for pacing violation warnings
3. **Reduce refresh frequency**: Increase time between manual refreshes
4. **Contact IB**: If issues persist, you may need to upgrade your IB account tier for higher limits

## Technical Details

### Files Modified

- `server/src/services/ibService.ts`: Added throttling to historical data requests
- `server/src/services/ibRequestThrottler.ts`: New throttling service

### Key Changes

1. Import throttler in `ibService.ts`
2. Call `IBRequestThrottler.checkHistoricalDataRequest()` before each historical data request
3. Detect error codes 162/420 and call `IBRequestThrottler.markPacingViolation()`
4. Changed `Promise.all()` to sequential `for` loop in portfolio enrichment

## Monitoring

Watch for these log messages:

- `⏱️ Throttling: waiting Xms before next historical data request` - Normal throttling
- `📊 Historical data request X/50 in current window` - Request counter
- `⚠️ Pacing violation detected. Pausing requests for 10 minutes...` - Violation detected
- `⏸️ Still in pacing violation cooldown. X minutes remaining.` - In cooldown
- `✅ Pacing violation cooldown period ended. Resuming requests.` - Cooldown ended
