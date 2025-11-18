# Charles Schwab Integration - Quick Start Guide

## What You Can Do

With the Charles Schwab API integration, you can:
- ✅ Automatically refresh account balances from Schwab
- ✅ View real-time portfolio positions
- ✅ Get stock/bond prices for your holdings
- ✅ Update performance tracking automatically

## Step-by-Step Setup

### 1. Get Schwab API Credentials

1. Go to [Charles Schwab Developer Portal](https://developer.schwab.com/)
2. Sign up for a developer account
3. Create a new App
4. Enable "Accounts and Trading Production" access
5. Copy your **App Key** and **App Secret**

### 2. Configure in Investment Tracker

1. Go to the **Other Portfolio** page in your Investment Tracker
2. Click the **"Schwab API"** button (blue button before "Refresh Market Data")
3. Enter your **App Key** and **App Secret**
4. Click **"Save & Authenticate"**

### 3. Complete OAuth Authentication

After saving your credentials:
1. A popup window will open with Schwab's login page
2. Log in to your Schwab account
3. Authorize the application
4. The popup will close automatically after successful authentication

### 4. Link Schwab Account & Refresh Balance

After OAuth authentication is complete:
1. In the Schwab API dialog, you'll see your Schwab accounts
2. Select the **Schwab Account** you want to link
3. Select the **Investment Tracker Account** to link it to
4. Click **"Refresh Balance from Schwab"**
5. Your account balance will be automatically updated!

### 5. Future Refreshes

Once configured, you can refresh your Schwab account balance anytime:
- **Manual Refresh**: Click "Schwab API" button → Select accounts → Click "Refresh Balance"
- **Automatic Refresh**: Click the main "Refresh" button in Performance Overview (refreshes all data sources including Schwab)

## How It Works

### Automatic Refresh Flow

```
User clicks Refresh
    ↓
System checks Schwab configuration
    ↓
Retrieves Schwab accounts
    ↓
Matches by account number
    ↓
Fetches latest balance from Schwab
    ↓
Updates Investment Tracker account
    ↓
Recalculates performance history
```

### Token Management

- **Access Token**: Valid for 30 minutes
  - Automatically refreshed when needed
  - No manual intervention required
  
- **Refresh Token**: Valid for 7 days
  - Used to get new access tokens
  - Need to re-authenticate after expiration

## API Endpoints Available

### Account Management
- `GET /api/schwab/accounts` - List all Schwab accounts
- `GET /api/schwab/accounts/:hash/balance` - Get account balance
- `GET /api/schwab/accounts/:hash/positions` - Get positions

### Market Data
- `POST /api/schwab/quotes` - Get real-time quotes

### Configuration
- `GET /api/schwab/settings` - Get current settings
- `POST /api/schwab/settings` - Save App Key/Secret
- `POST /api/schwab/tokens` - Save OAuth tokens

## Example: Manual Balance Refresh

```typescript
// Get Schwab account balance and update linked account
const response = await apiClient.getSchwabAccountBalance(
  'schwab_account_hash',
  123 // Your Investment Tracker account ID
);

console.log('Updated balance:', response.currentBalance);
```

## Troubleshooting

### "Schwab not configured"
- Ensure you've saved your App Key and Secret
- Complete the OAuth authentication flow

### "No access token available"
- Complete OAuth authentication
- Check if refresh token has expired (7 days)

### Account not updating
- Verify account number matches exactly
- Check Schwab account hash is correct
- Review server logs for errors

### Rate limit errors
- Schwab API has rate limits (~120 req/min)
- Wait a moment before retrying
- System handles this automatically

## Security Notes

- ✅ App Secret stored encrypted in database
- ✅ Tokens never exposed to frontend
- ✅ All API calls authenticated with JWT
- ✅ OAuth with PKCE recommended for production

## Next Steps

1. **Implement OAuth UI**: Add a settings page for easy OAuth flow
2. **Position Sync**: Automatically sync Schwab positions to portfolio
3. **Transaction Import**: Import transaction history
4. **Real-time Updates**: Add WebSocket support for live quotes

## Need Help?

- Check server logs: `server/logs/`
- Review API documentation: `docs/SCHWAB_INTEGRATION.md`
- Schwab API docs: https://developer.schwab.com/products/trader-api--individual
