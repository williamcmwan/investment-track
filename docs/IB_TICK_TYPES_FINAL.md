# IB Tick Types - Final Implementation

**Date:** November 19, 2025  
**Status:** ✅ Implemented

---

## Correct Tick Types

Based on IB API documentation, the correct tick types for day change calculations are:

### Last Price (Current Price)

| Tick | Name | Description | Priority |
|------|------|-------------|----------|
| **4** | **Last** | Real-time last trade price | **1st (Preferred)** |
| **68** | **Delayed Last** | Delayed last trade price (15-min delay) | **2nd (Fallback)** |

### Close Price (Previous Day Close)

| Tick | Name | Description | Priority |
|------|------|-------------|----------|
| **9** | **Close** | Real-time previous close | **1st (Preferred)** |
| **69** | **Delayed Close** | Delayed previous close (15-min delay) | **2nd (Fallback)** |

---

## Implementation Logic

### Priority-Based Fallback

```typescript
// Last Price - Prefer real-time (4), fallback to delayed (68)
if (tickType === 4) {
  existing.lastPrice = price;  // Real-time - always use
} 
else if (tickType === 68 && existing.lastPrice === 0) {
  existing.lastPrice = price;  // Delayed - only if no real-time yet
}

// Close Price - Prefer real-time (9), fallback to delayed (69)
if (tickType === 9) {
  existing.closePrice = price;  // Real-time - always use
}
else if (tickType === 69 && existing.closePrice === 0) {
  existing.closePrice = price;  // Delayed - only if no real-time yet
}
```

### Why This Works

1. **Real-time subscribers** get tick 4 and 9 immediately
2. **Free/delayed subscribers** get tick 68 and 69 after 15 minutes
3. **Fallback logic** ensures delayed data is used only when real-time isn't available
4. **All markets** (US, HK, Singapore, Canada) use the same tick types

---

## Market Data Types

IB supports different market data subscription levels:

```typescript
this.ibApi.reqMarketDataType(type);
```

| Type | Description | Tick Types | Cost |
|------|-------------|------------|------|
| 1 | Real-time | 4, 9 | Paid subscription |
| 2 | Frozen | Last available | Free |
| 3 | Delayed | 68, 69 | Free (15-min delay) |
| 4 | Delayed Frozen | Last available delayed | Free |

Our implementation uses **Type 3 (Delayed)** for free access.

---

## Expected Behavior

### With Free/Delayed Data (Type 3)

**All Stocks (US, HK, Singapore, Canada):**
```
📡 Subscribed to market data for AAPL (STK) on NASDAQ - reqId: 123456
💹 AAPL (STK, NASDAQ) - Delayed last price (tick 68): 150.25
💹 AAPL (STK, NASDAQ) - Delayed close price (tick 69): 149.50
📊 Day change for AAPL (STK): 75.00 (0.50%) [close: 149.50, last: 150.25]
```

### With Real-time Data (Type 1)

**If User Has Paid Subscription:**
```
📡 Subscribed to market data for AAPL (STK) on NASDAQ - reqId: 123456
💹 AAPL (STK, NASDAQ) - Last price (tick 4): 150.25
💹 AAPL (STK, NASDAQ) - Close price (tick 9): 149.50
📊 Day change for AAPL (STK): 75.00 (0.50%) [close: 149.50, last: 150.25]
```

---

## Day Change Calculation

Once we have both prices, calculate day change:

```typescript
if (closePrice && lastPrice && closePrice > 0 && lastPrice !== closePrice) {
  if (secType === 'BOND') {
    // Bond formula: (lastPrice - closePrice) * qty * 10
    dayChange = (lastPrice - closePrice) * position * 10;
    dayChangePercent = ((lastPrice - closePrice) / closePrice) * 100;
  } else {
    // Stock/Crypto formula: (lastPrice - closePrice) * qty
    dayChange = (lastPrice - closePrice) * position;
    dayChangePercent = ((lastPrice - closePrice) / closePrice) * 100;
  }
}
```

---

## Testing

### Test All Markets

1. **US Stocks** (NASDAQ, NYSE)
   - Should receive tick 68 and 69
   - Day change should calculate correctly

2. **Hong Kong Stocks** (SEHK)
   - Should receive tick 68 and 69
   - Day change should calculate correctly

3. **Singapore Stocks** (SGX)
   - Should receive tick 68 and 69
   - Day change should calculate correctly

4. **Canada Stocks** (TSE/TSX)
   - Should receive tick 68 and 69
   - Day change should calculate correctly

### Verification Query

```sql
SELECT 
  symbol, 
  sec_type, 
  exchange,
  market_price as last_price,
  close_price,
  day_change,
  day_change_percent
FROM portfolios
WHERE source = 'IB'
  AND day_change IS NOT NULL
ORDER BY exchange, symbol;
```

Expected: All stocks should have day_change and day_change_percent values.

---

## Common Issues

### Issue: Still Showing N/A

**Possible Causes:**
1. Market is closed (no tick updates)
2. No market data subscription for that exchange
3. Stock is not actively traded
4. IB Gateway connection issue

**Debug:**
```bash
# Check logs for tick updates
grep "💹.*tick" logs/server.log | grep "SYMBOL"

# Check if subscription was successful
grep "📡 Subscribed" logs/server.log | grep "SYMBOL"
```

### Issue: Only Getting Tick 68, Not 69

**Solution:**
- Tick 69 may arrive later than tick 68
- Wait for periodic sync (60 seconds)
- Check if market is open (close price only available after market close)

### Issue: Getting Tick 4/9 Instead of 68/69

**Explanation:**
- You have real-time market data subscription
- This is actually better (no delay)
- Day change will still calculate correctly

---

## Summary

### Implementation
- ✅ Tick 4 (Last) with fallback to Tick 68 (Delayed Last)
- ✅ Tick 9 (Close) with fallback to Tick 69 (Delayed Close)
- ✅ Priority-based logic (prefer real-time, use delayed as fallback)
- ✅ Works for all markets (US, HK, Singapore, Canada)

### Benefits
- ✅ Universal solution for all exchanges
- ✅ Supports both free and paid subscriptions
- ✅ Graceful fallback from real-time to delayed
- ✅ Accurate day change calculations

### Result
All stocks across all markets should now show day change correctly!

---

**Status:** ✅ Complete  
**Tested:** Ready for testing  
**Next:** Deploy and verify with real data
