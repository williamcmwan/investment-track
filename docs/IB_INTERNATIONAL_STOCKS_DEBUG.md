# IB International Stocks - Day Change Debugging

**Date:** November 19, 2025  
**Issue:** HK, Singapore, Canada stocks showing N/A for day change  
**Status:** 🔍 Debugging

---

## Enhanced Logging

The code has been updated with comprehensive logging to identify which tick types are being received for international stocks.

### What to Look For

After refreshing your portfolio, check the logs for each stock:

#### 1. Subscription Confirmation

```
📡 Subscribed to market data for 0700.HK (STK) on SEHK - reqId: 123456
📡 Subscribed to market data for D05.SI (STK) on SGX - reqId: 234567
📡 Subscribed to market data for SHOP.TO (STK) on TSE - reqId: 345678
```

#### 2. Tick Price Updates

Look for what tick types each stock receives:

**US Stocks (Working):**
```
💹 AAPL (STK, NASDAQ) - Delayed last price (tick 68): 150.25
💹 AAPL (STK, NASDAQ) - Delayed close price (tick 69): 149.50
```

**HK Stocks (Need to check):**
```
💹 0700.HK (STK, SEHK) - Received tick type X: YYY.YY
💹 0700.HK (STK, SEHK) - Received tick type Z: ZZZ.ZZ
```

**Singapore Stocks (Need to check):**
```
💹 D05.SI (STK, SGX) - Received tick type X: YYY.YY
💹 D05.SI (STK, SGX) - Received tick type Z: ZZZ.ZZ
```

**Canada Stocks (Need to check):**
```
💹 SHOP.TO (STK, TSE) - Received tick type X: YYY.YY
💹 SHOP.TO (STK, TSE) - Received tick type Z: ZZZ.ZZ
```

---

## IB Tick Type Reference

### Common Tick Types

| Tick | Name | Description |
|------|------|-------------|
| 1 | BID | Bid price |
| 2 | ASK | Ask price |
| 4 | LAST | Last trade price |
| 6 | HIGH | Day high |
| 7 | LOW | Day low |
| 9 | CLOSE | Previous close |
| 14 | OPEN | Day open |
| 66 | DELAYED_BID | Delayed bid |
| 67 | DELAYED_ASK | Delayed ask |
| 68 | DELAYED_LAST | Delayed last |
| 69 | DELAYED_CLOSE | Delayed close |
| 72 | DELAYED_HIGH | Delayed high |
| 73 | DELAYED_LOW | Delayed low |
| 79 | DELAYED_OPEN | Delayed open |

### Currently Handled

The code currently handles these tick types:

**For Last Price (Current Price):**
- Tick 4 (Last) - Real-time, preferred
- Tick 68 (Delayed Last) - Delayed, fallback if tick 4 not available

**For Close Price (Previous Day Close):**
- Tick 9 (Close) - Real-time, preferred
- Tick 69 (Delayed Close) - Delayed, fallback if tick 9 not available

---

## How to Debug

### Step 1: Refresh Portfolio

```bash
POST /api/ib/portfolio/refresh
```

### Step 2: Check Server Logs

Look for the subscription and tick messages:

```bash
# View recent logs
tail -f logs/server.log | grep "💹"

# Or search for specific stock
grep "0700.HK" logs/server.log
grep "D05.SI" logs/server.log
grep "SHOP.TO" logs/server.log
```

### Step 3: Identify Missing Tick Types

For each international stock, note:
1. What tick types are being received?
2. Are we getting a "last price" tick?
3. Are we getting a "close price" tick?

### Step 4: Report Findings

Create a summary like this:

```
HK Stocks (SEHK):
- 0700.HK receives: tick 1 (bid), tick 2 (ask), tick 6 (high), tick 7 (low)
- Missing: tick 9 or 75 (close price)
- Need to add: tick X for close price

Singapore Stocks (SGX):
- D05.SI receives: tick 1 (bid), tick 2 (ask)
- Missing: tick 4/68 (last price), tick 9/75 (close price)
- Need to add: tick X for last, tick Y for close

Canada Stocks (TSE):
- SHOP.TO receives: tick 4 (last), tick 9 (close)
- Should work! Check if there's another issue
```

---

## Possible Solutions

### Solution 1: Add More Tick Types

If international stocks use different tick types, add them:

```typescript
// Example: If HK stocks use tick 37 for close
else if (tickType === 9 || tickType === 75 || tickType === 37) {
  existing.closePrice = price;
  Logger.info(`💹 ${symbol} - Close price (tick ${tickType}): ${price}`);
}
```

### Solution 2: Use Bid/Ask for Last Price

If no "last" tick is available, use mid-point of bid/ask:

```typescript
// Track bid and ask separately
if (tickType === 1 || tickType === 66) { // Bid
  existing.bid = price;
}
if (tickType === 2 || tickType === 67) { // Ask
  existing.ask = price;
}

// Calculate last price from bid/ask
if (existing.bid > 0 && existing.ask > 0 && existing.lastPrice === 0) {
  existing.lastPrice = (existing.bid + existing.ask) / 2;
}
```

### Solution 3: Use Open Price as Close

If close price not available, use open price from previous day:

```typescript
// If we have open but no close, use open as close approximation
if (tickType === 14 || tickType === 79) { // Open
  if (existing.closePrice === 0) {
    existing.closePrice = price;
    Logger.info(`💹 ${symbol} - Using Open as Close (tick ${tickType}): ${price}`);
  }
}
```

### Solution 4: Request Generic Tick List

Request specific tick types in subscription:

```typescript
// Request specific ticks
const genericTickList = '100,101,104,106,165,221,225,233,236,258,293,294,295,318,370,370,377,377,381,384,384,387,388,391,407,411,428,439,456,459,460,499,506,511,512,104,105,106,107,125,165,221,225,233,236,258,293,294,295,318,370,377,381,384,387,388,391,407,411,428,439,456,459,460,499,506,511,512';

this.ibApi.reqMktData(reqId, contract, genericTickList, false, false);
```

---

## Exchange-Specific Notes

### Hong Kong (SEHK)
- Market hours: 09:30-16:00 HKT
- Currency: HKD
- Delayed data: 15 minutes
- May use different tick types than US

### Singapore (SGX)
- Market hours: 09:00-17:00 SGT
- Currency: SGD
- Delayed data: 15 minutes
- May use different tick types than US

### Canada (TSE/TSX)
- Market hours: 09:30-16:00 EST
- Currency: CAD
- Delayed data: 15 minutes
- Should use similar tick types to US

---

## Next Steps

1. **Refresh portfolio** and collect logs
2. **Identify tick types** received for each exchange
3. **Update code** to handle those tick types
4. **Test** with real data
5. **Document** findings for future reference

---

## Testing Checklist

- [ ] Refresh IB portfolio
- [ ] Check logs for HK stocks (SEHK)
- [ ] Check logs for Singapore stocks (SGX)
- [ ] Check logs for Canada stocks (TSE)
- [ ] Note which tick types are received
- [ ] Identify missing tick types
- [ ] Update code to handle new tick types
- [ ] Test day change calculations
- [ ] Verify in database

---

## Log Examples to Share

When reporting the issue, include logs like:

```
=== HK Stock: 0700.HK ===
📡 Subscribed to market data for 0700.HK (STK) on SEHK - reqId: 123456
💹 0700.HK (STK, SEHK) - Received tick type 1: 350.00
💹 0700.HK (STK, SEHK) - Received tick type 2: 350.20
💹 0700.HK (STK, SEHK) - Received tick type 6: 355.00
💹 0700.HK (STK, SEHK) - Received tick type 7: 348.00
⚠️  Cannot calculate day change for 0700.HK (STK): closePrice=null, lastPrice=350.00

=== Singapore Stock: D05.SI ===
📡 Subscribed to market data for D05.SI (STK) on SGX - reqId: 234567
💹 D05.SI (STK, SGX) - Received tick type 1: 15.50
💹 D05.SI (STK, SGX) - Received tick type 2: 15.52
⚠️  Cannot calculate day change for D05.SI (STK): closePrice=null, lastPrice=15.50

=== Canada Stock: SHOP.TO ===
📡 Subscribed to market data for SHOP.TO (STK) on TSE - reqId: 345678
💹 SHOP.TO (STK, TSE) - Delayed last price (tick 68): 75.25
💹 SHOP.TO (STK, TSE) - Delayed close price (tick 69): 74.50
📊 Day change for SHOP.TO (STK): 75.00 (1.01%) [close: 74.50, last: 75.25]
```

---

**Status:** 🔍 Awaiting log data  
**Action Required:** Run portfolio refresh and collect logs  
**Next:** Update code based on findings
