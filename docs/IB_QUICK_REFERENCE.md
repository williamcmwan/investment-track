# IB Optimized Service - Quick Reference

## System Behavior

### On Application Startup
```
✅ Automatically connects to all configured IB accounts
✅ Starts real-time data subscriptions
✅ Syncs data to database every 60 seconds
✅ No manual intervention needed
```

### When User Clicks Refresh
```
✅ Returns current data immediately (if subscriptions active)
✅ Continues receiving real-time updates
✅ Updates account balance and performance
```

## API Endpoints

### Portfolio Refresh
```bash
POST /api/integration/ib/portfolio/refresh
Authorization: Bearer <token>

# Response: Portfolio data with balance, positions, cash
# Time: ~38s first time, instant if already subscribed
```

### Full Refresh
```bash
POST /api/integration/ib/refresh-all
Authorization: Bearer <token>

# Response: Complete account data
# Time: ~38s first time, instant if already subscribed
```

### Get Refresh Status
```bash
GET /api/integration/ib/refresh-status
Authorization: Bearer <token>

# Response:
{
  "success": true,
  "status": {
    "isActive": true,
    "lastSync": "2025-11-19T10:30:00.000Z",
    "lastSyncAge": 45,
    "subscriptions": {
      "accountUpdates": true,
      "marketDataCount": 10
    }
  }
}
```

### Stop Refresh
```bash
POST /api/integration/ib/stop-refresh
Authorization: Bearer <token>

# Stops all subscriptions and periodic syncing
```

### Disconnect
```bash
POST /api/integration/ib/disconnect
Authorization: Bearer <token>

# Stops refresh and disconnects from IB Gateway
```

## Service Methods

### IBServiceOptimized

```typescript
// Start refresh with subscriptions
await IBServiceOptimized.refreshPortfolio({
  host: 'localhost',
  port: 4001,
  client_id: 1,
  target_account_id: 123
});

// Get refresh status
const status = IBServiceOptimized.getRefreshStatus();
// Returns: { isActive, lastSync, subscriptions }

// Stop refresh
await IBServiceOptimized.stopRefresh();

// Disconnect
await IBServiceOptimized.disconnect();
```

## Data Flow

```
IB Gateway → Subscriptions → Temporary Memory → Database (every 60s) → API → Frontend
```

## Performance Metrics

| Metric | Value |
|--------|-------|
| Initial refresh | ~38 seconds |
| Subsequent refresh | Instant (0s) |
| Data sync interval | 60 seconds |
| API calls (initial) | 16 |
| API calls (ongoing) | 0 |

## Monitoring

### Check Logs
```bash
# Startup
grep "Initializing IB optimized service" logs/server.log

# Refresh activity
grep "IB account.*refresh" logs/server.log

# Sync activity
grep "Database sync complete" logs/server.log

# Errors
grep "ERROR.*IB" logs/server.log
```

### Check Status via API
```bash
curl -X GET http://localhost:3002/api/integration/ib/refresh-status \
  -H "Authorization: Bearer YOUR_TOKEN" | jq
```

### Check Database
```sql
-- Check last sync times
SELECT * FROM last_updates WHERE update_type LIKE 'IB%';

-- Check portfolio data
SELECT COUNT(*) FROM portfolios WHERE source = 'IB';

-- Check cash balances
SELECT * FROM cash_balances WHERE source = 'IB';
```

## Troubleshooting

### Subscriptions Not Active

**Check:**
```bash
curl -X GET http://localhost:3002/api/integration/ib/refresh-status
```

**Fix:**
```bash
# Restart refresh
curl -X POST http://localhost:3002/api/integration/ib/portfolio/refresh
```

### Data Not Updating

**Check:**
- IB Gateway running?
- Database connection OK?
- Check logs for errors

**Fix:**
```bash
# Stop and restart
curl -X POST http://localhost:3002/api/integration/ib/stop-refresh
curl -X POST http://localhost:3002/api/integration/ib/portfolio/refresh
```

### High Memory Usage

**Normal:** ~65MB per account (vs ~50MB old service)

**If excessive:**
```bash
# Restart subscriptions
curl -X POST http://localhost:3002/api/integration/ib/stop-refresh
sleep 5
curl -X POST http://localhost:3002/api/integration/ib/portfolio/refresh
```

## Key Files

```
server/src/
├── index.ts                          # Startup auto-refresh
├── routes/integration.ts             # API endpoints
└── services/
    ├── ibServiceOptimized.ts         # New optimized service
    └── ibService.ts                  # Old service (kept for compatibility)

docs/
├── IB_QUICK_REFERENCE.md            # This file
├── IB_SYSTEM_MIGRATION_COMPLETE.md  # Migration details
├── IB_OPTIMIZED.md                  # Technical documentation
└── IB_COMPARISON.md                 # Performance comparison
```

## Common Commands

```bash
# Start application
npm run dev

# Check if IB Gateway is running
ps aux | grep -i "ib gateway"

# Check port
nc -zv localhost 4001

# View logs
tail -f logs/server.log

# Restart application
pkill -f "node.*index.ts"
npm run dev
```

## Environment Variables

```bash
# Optional: Set log level for debugging
export LOG_LEVEL=debug
export NODE_ENV=development

# Start application
npm run dev
```

## Testing Checklist

- [ ] Application starts without errors
- [ ] IB accounts auto-refresh on startup
- [ ] Manual refresh returns data quickly
- [ ] Refresh status shows active subscriptions
- [ ] Data syncs every minute
- [ ] Graceful shutdown works
- [ ] No memory leaks after 24h

## Support

**Documentation:**
- Technical: `IB_OPTIMIZED.md`
- Comparison: `IB_COMPARISON.md`
- Migration: `IB_SYSTEM_MIGRATION_COMPLETE.md`

**Logs:**
- Server: `logs/server.log`
- Errors: `grep ERROR logs/server.log`

**Database:**
- Portfolio: `SELECT * FROM portfolios WHERE source = 'IB'`
- Cash: `SELECT * FROM cash_balances WHERE source = 'IB'`
- Updates: `SELECT * FROM last_updates WHERE update_type LIKE 'IB%'`

---

**Quick Reference Version:** 1.0  
**Last Updated:** November 19, 2025
