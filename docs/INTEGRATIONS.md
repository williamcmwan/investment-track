# Broker Integrations Guide

**Version:** 1.1  
**Last Updated:** November 20, 2025

Complete guide for integrating Interactive Brokers and Charles Schwab with the Investment Tracker application.

---

## Table of Contents

1. [Overview](#overview)
2. [Interactive Brokers](#interactive-brokers)
3. [Charles Schwab](#charles-schwab)
4. [Comparison](#comparison)
5. [Troubleshooting](#troubleshooting)

---

## Overview

The Investment Tracker supports two major broker integrations:

| Feature | Interactive Brokers | Charles Schwab |
|---------|-------------------|----------------|
| **Authentication** | Direct API connection | OAuth 2.0 |
| **Update Frequency** | Real-time (subscription) | Every 1 minute |
| **Data Sources** | IB Gateway/TWS | Schwab API |
| **Setup Complexity** | Medium | Easy |
| **Position Details** | Extensive | Basic |
| **Market Data** | Real-time | Delayed |

---

## Interactive Brokers

### Quick Start

#### Prerequisites
- IB Gateway or TWS installed and running
- API connections enabled in IB Gateway settings
- Available client ID (1-32)

#### Configuration

1. **Start IB Gateway**
   - Login to your IB account
   - Enable API connections
   - Note the port number (4001 for live, 7497 for paper)

2. **Configure in Application**
   - Go to Accounts page
   - Select your IB account
   - Click "Configure Integration"
   - Enter:
     - Host: `localhost` (or remote IP)
     - Port: `4001` (or `7497` for paper trading)
     - Client ID: `1` (or any unused ID)

3. **Test Connection**
   - Click "Refresh" button
   - Should see portfolio data within 30-40 seconds

### Features

#### Real-time Portfolio Updates
- Subscription-based synchronization
- Automatic updates pushed from IB Gateway
- Database sync every 60 seconds
- No manual refresh needed after initial setup

#### Market Data
- Current prices updated in real-time
- Close prices from Yahoo Finance (refreshed every 30 minutes)
- Day change calculations: `(currentPrice - closePrice) * quantity`
- Special handling for bonds: `(currentPrice - closePrice) * quantity * 10`

#### Position Details
- Symbol, security type, currency
- Quantity, average cost, market value
- Unrealized P&L, realized P&L
- Industry, category, country
- Exchange information

#### Cash Balances
- Multi-currency support
- Automatic currency conversion
- Real-time balance updates

### Data Refresh Schedule

| Task | Frequency | Description |
|------|-----------|-------------|
| Portfolio positions | Real-time | Via IB Gateway subscription |
| Close prices | Every 30 min | From Yahoo Finance |
| Bond price snapshot | Daily at 23:59 | Copy market price to close price |
| Database sync | Every 60 seconds | Save to database |

### API Endpoints

```
GET  /api/ib/portfolio          # Get portfolio from database
POST /api/ib/portfolio/refresh  # Refresh from IB Gateway
GET  /api/ib/balance            # Get account balance
GET  /api/ib/cash               # Get cash balances
GET  /api/ib/refresh-status     # Check subscription status
POST /api/ib/stop-refresh       # Stop subscriptions
```

### Troubleshooting

**Connection timeout:**
- Verify IB Gateway is running
- Check port number (4001 for live, 7497 for paper)
- Try different client ID

**No data updates:**
- Check subscription status: `GET /api/ib/refresh-status`
- Verify database sync is running
- Check server logs for errors

**Missing close prices:**
- Close prices fetched from Yahoo Finance
- Refreshed every 30 minutes automatically
- Manual refresh: Click account refresh button

---

## Charles Schwab

### Quick Start

#### Prerequisites
- Charles Schwab brokerage account
- Schwab Developer Portal account
- Registered application with OAuth credentials

#### Setup Steps

1. **Register Application**
   - Go to: https://developer.schwab.com
   - Create new application
   - Note your App Key and App Secret
   - Set redirect URI: `http://localhost:3002/api/schwab/callback`

2. **Configure Environment**
   ```bash
   # Add to server/.env
   SCHWAB_APP_KEY=your_app_key
   SCHWAB_APP_SECRET=your_app_secret
   SCHWAB_REDIRECT_URI=http://localhost:3002/api/schwab/callback
   ```

3. **Link Account**
   - Go to Accounts page
   - Select your Schwab account
   - Click "Configure Integration"
   - Select "Charles Schwab"
   - Click "Authenticate with Schwab"
   - Login and authorize
   - Select account to link

4. **Verify**
   - Portfolio should refresh automatically every minute
   - Check for position data in Portfolio view

### Features

#### OAuth 2.0 Authentication
- Account-level token management
- Automatic token refresh
- Secure credential storage

#### Automatic Refresh
- Portfolio refresh every 1 minute
- Balance updates
- Position synchronization
- No manual intervention needed

#### Position Categorization
- **EQUITY** → Stocks - USA
- **FIXED_INCOME** → Bonds - USA
- Automatic classification in Portfolio Analytics

#### Data Available
- Account balance
- Portfolio positions (symbol, quantity, value)
- Security type (EQUITY, FIXED_INCOME, etc.)
- Market values
- Basic position details

### Data Refresh Schedule

| Task | Frequency | Description |
|------|-----------|-------------|
| Portfolio & Balance | Every 1 minute | Automatic via scheduler |
| Token refresh | As needed | Automatic when expired |

### API Endpoints

```
GET  /api/schwab/auth-url                    # Get OAuth URL
GET  /api/schwab/callback                    # OAuth callback
POST /api/accounts/:id/integration           # Configure integration
GET  /api/accounts/:id/integration           # Get integration config
POST /api/accounts/:id/integration/refresh   # Manual refresh
GET  /api/accounts/:id/integration/portfolio # Get portfolio
GET  /api/accounts/:id/integration/cash      # Get cash balances
```

### Troubleshooting

**Authentication failed:**
- Verify App Key and App Secret in .env
- Check redirect URI matches exactly
- Ensure Schwab account is active

**No portfolio data:**
- Check if account is linked: `GET /api/accounts/:id/integration`
- Verify tokens are valid
- Check server logs for API errors

**Token expired:**
- Tokens refresh automatically
- If refresh fails, re-authenticate through UI

---

## Comparison

### When to Use Each Integration

#### Use Interactive Brokers When:
- ✅ You need real-time data
- ✅ You have many positions (10+)
- ✅ You want detailed position information
- ✅ You need multi-currency support
- ✅ You can run IB Gateway continuously

#### Use Charles Schwab When:
- ✅ You want simple setup (OAuth only)
- ✅ You don't need real-time updates
- ✅ You have US-based investments
- ✅ You prefer automatic background refresh
- ✅ You don't want to run additional software

### Data Comparison

| Data Point | IB | Schwab |
|-----------|-----|--------|
| Current Price | ✅ Real-time | ✅ Delayed |
| Close Price | ✅ Yahoo Finance | ✅ From API |
| Day Change | ✅ Calculated | ✅ From API |
| Unrealized P&L | ✅ Yes | ✅ Yes |
| Industry/Category | ✅ Yes | ⚠️ Limited |
| Exchange Info | ✅ Yes | ❌ No |
| Multi-currency | ✅ Yes | ⚠️ USD only |

### Performance Comparison

| Metric | IB | Schwab |
|--------|-----|--------|
| Initial Setup | ~38s | ~2s |
| Subsequent Updates | Real-time | 1 min |
| API Calls/Day | ~16 | ~1,440 |
| Data Freshness | Real-time | 1 min delay |

---

## Troubleshooting

### Common Issues

#### Both Integrations

**Problem:** Account not showing in Portfolio view

**Solution:**
1. Verify integration is configured: `GET /api/accounts/:id/integration`
2. Check account type is INVESTMENT (not BANK)
3. Refresh the account manually
4. Check server logs for errors

**Problem:** Positions not categorized correctly

**Solution:**
- IB: Check industry/category fields in database
- Schwab: Verify secType is EQUITY or FIXED_INCOME
- Review categorization logic in Dashboard.tsx

#### Interactive Brokers Specific

**Problem:** Connection keeps dropping

**Solution:**
- Increase timeout in IB Gateway settings
- Use dedicated client ID
- Check network stability
- Verify IB Gateway is running continuously

**Problem:** Close prices not updating

**Solution:**
- Close prices refresh every 30 minutes automatically
- Check Yahoo Finance API status
- Verify symbol mapping is correct
- Check logs for fetch errors

#### Charles Schwab Specific

**Problem:** OAuth authentication fails

**Solution:**
- Verify App Key and App Secret are correct
- Check redirect URI matches exactly
- Ensure Schwab account has API access enabled
- Try re-registering the application

**Problem:** Token refresh fails

**Solution:**
- Re-authenticate through UI
- Check token expiration in database
- Verify Schwab API is accessible
- Review server logs for specific error

### Debug Mode

Enable detailed logging:

```bash
# In server/.env
LOG_LEVEL=0  # DEBUG mode

# Restart server
./scripts/app.sh restart

# View logs
./scripts/app.sh logs
```

---

## Best Practices

### 1. Use Both Integrations

Leverage the strengths of each:
- **IB** for active trading accounts with real-time needs
- **Schwab** for long-term holdings with less frequent updates

### 2. Monitor Health

```typescript
// Check integration health periodically
setInterval(async () => {
  const ibStatus = await fetch('/api/ib/refresh-status').then(r => r.json());
  const schwabAccounts = await fetch('/api/accounts').then(r => r.json());
  
  if (!ibStatus.isActive) {
    console.warn('IB subscriptions inactive');
  }
  
  // Check Schwab accounts
  for (const account of schwabAccounts.data) {
    if (account.integrationType === 'SCHWAB') {
      const lastUpdate = new Date(account.lastUpdated);
      const age = Date.now() - lastUpdate.getTime();
      if (age > 5 * 60 * 1000) {
        console.warn(`Schwab account ${account.name} not updated in 5 minutes`);
      }
    }
  }
}, 5 * 60 * 1000);
```

### 3. Graceful Degradation

```typescript
// Fallback to manual data if integration fails
async function getPortfolioData(accountId) {
  try {
    // Try integration first
    const integration = await fetch(`/api/accounts/${accountId}/integration/portfolio`);
    if (integration.ok) {
      return integration.json();
    }
  } catch (error) {
    console.warn('Integration failed, using manual data');
  }
  
  // Fallback to manual positions
  return fetch('/api/manual-investments').then(r => r.json());
}
```

### 4. Error Recovery

```typescript
// Auto-restart on failure
async function ensureIntegrationActive(accountId) {
  const config = await fetch(`/api/accounts/${accountId}/integration`).then(r => r.json());
  
  if (config.type === 'IB') {
    const status = await fetch('/api/ib/refresh-status').then(r => r.json());
    if (!status.isActive) {
      await fetch(`/api/accounts/${accountId}/integration/refresh`, { method: 'POST' });
    }
  } else if (config.type === 'SCHWAB') {
    // Schwab auto-refreshes, just verify last update
    const account = await fetch(`/api/accounts/${accountId}`).then(r => r.json());
    const age = Date.now() - new Date(account.lastUpdated).getTime();
    if (age > 10 * 60 * 1000) {
      await fetch(`/api/accounts/${accountId}/integration/refresh`, { method: 'POST' });
    }
  }
}
```

---

## Additional Resources

- **IB API Documentation**: https://interactivebrokers.github.io/tws-api/
- **Schwab Developer Portal**: https://developer.schwab.com
- **Yahoo Finance API**: Used for close price data
- **Project Repository**: See README.md for setup instructions

---

**Need Help?** Check the troubleshooting section or review server logs for detailed error messages.
