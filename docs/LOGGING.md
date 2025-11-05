# Logging Configuration

## Overview

The IB service now uses a structured logging system that allows you to control the verbosity of log messages. This is particularly useful for debugging IB portfolio refresh operations.

## Log Levels

- **DEBUG (0)**: Detailed information for debugging, including individual contract processing, market data requests, and bond calculations
- **INFO (1)**: General information about process start/end and summaries (default)
- **WARN (2)**: Warning messages
- **ERROR (3)**: Error messages only

## Configuration

### Environment Variable

Set the `LOG_LEVEL` environment variable to control logging:

```bash
# Show only info and above (default)
LOG_LEVEL=1

# Show debug messages (verbose)
LOG_LEVEL=0

# Show only warnings and errors
LOG_LEVEL=2
```

### Development Mode

For development with debug logging, add to your `.env` file:

```
NODE_ENV=development
LOG_LEVEL=0
```

## What Changed

### Before (All Info Level)
All log messages were output at the same level using `console.log()`, making it difficult to filter verbose debugging information.

### After (Structured Logging)
- **Info Level**: Process start/end messages, summaries, completion notifications
- **Debug Level**: Individual contract processing, market data requests, bond calculations, detailed progress

## Examples

### Info Level Messages (Always Shown)
- `🚀 Initializing IB Service...`
- `📊 Force refreshing portfolio from IB...`
- `📊 Portfolio refresh completed in 5234ms (45 positions)`

### Debug Level Messages (Only in Debug Mode)
- `📊 Portfolio contract received: AAPL STK`
- `📊 Processing contract: AAPL STK`
- `Processing AAPL (STK) for day change data...`
- `Got contract details for AAPL (STK): {...}`
- `Historical bar for AAPL (STK): date=20251104, close=270.04`
- `💰 Cash balance: USD = 126859.13`
- `✅ Performance snapshot calculated and stored for [date]: {totalPL: '...', investmentPL: '...', ...}`
- `Fetching GBP/HKD rate from Yahoo Finance...`
- `Successfully fetched GBP/HKD rate: 10.136`
- `Cache expired for USD/HKD, fetching fresh rate...`
- `Falling back to exchangerate-api for missing rates...`
- `📊 Fetching Yahoo Finance data for BRK-B using yahoo-finance2...`
- `📊 Fetching detailed company info for BRK-B...`
- `📊 Company info for BRK-B: {sector: 'Financial Services', ...}`
- `✅ Got Yahoo Finance data for BRK-B: 491.59 (...)`
- `📊 Fetching enhanced data for BRK-B using yahoo-finance2...`
- `✅ Enhanced data for BRK-B: {price: 491.59, change: 3.93, ...}`
- `⚠️ No market data available for US-T, keeping existing data`
- `⏱️ Waiting 1s before next batch to avoid rate limiting...`
- `❌ No data found for symbol US-T`

## Usage in Code

```typescript
import { Logger } from '../utils/logger.js';

// Info level (process summaries)
Logger.info('📊 Starting portfolio refresh...');

// Debug level (detailed processing)
Logger.debug(`Processing ${symbol} for market data...`);

// Warning level
Logger.warn('Connection timeout, retrying...');

// Error level
Logger.error('Failed to connect to IB Gateway:', error);
```