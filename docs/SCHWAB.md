# Charles Schwab API Integration

Complete guide for integrating Charles Schwab API with Investment Tracker.

## Quick Start

### What You Can Do
- ✅ Automatically refresh account balances from Schwab
- ✅ View real-time portfolio positions
- ✅ Get stock/bond prices for your holdings
- ✅ Update performance tracking automatically

### Setup Steps

1. **Get API Credentials**
   - Sign up at [Charles Schwab Developer Portal](https://developer.schwab.com/)
   - Create an App with "Accounts and Trading Production" access
   - Copy your App Key and App Secret

2. **Configure in Investment Tracker**
   - Go to Other Portfolio page
   - Click "Schwab API" button
   - Enter App Key and App Secret
   - Click "Save & Authenticate"

3. **Complete OAuth**
   - Popup opens with Schwab login
   - Authorize the application
   - Popup closes automatically

4. **Link Account & Refresh**
   - Select Schwab account from dropdown
   - Select Investment Tracker account to link
   - Click "Refresh Balance from Schwab"

## How It Works

### OAuth Flow
1. User clicks "Save & Authenticate"
2. Popup opens with Schwab login
3. User authorizes the app
4. Schwab redirects to `/schwab/callback` with authorization code
5. Backend exchanges code for tokens (secure)
6. Tokens saved to database
7. Status shows "Connected"

### Balance Refresh
1. User clicks "Refresh" in Dashboard
2. System checks if Schwab has tokens
3. Fetches all Schwab accounts
4. Matches by account number
5. Updates each matched account balance
6. Recalculates performance

### Token Management
- **Access Token**: Valid for 30 minutes, auto-refreshed
- **Refresh Token**: Valid for 7 days
- Tokens stored securely in database
- System handles refresh automatically

## API Endpoints

### Backend Routes
- `GET /api/schwab/settings` - Get user's Schwab configuration
- `POST /api/schwab/settings` - Save App Key and Secret
- `POST /api/schwab/tokens` - Save OAuth tokens
- `POST /api/schwab/oauth/exchange` - Exchange auth code for tokens
- `GET /api/schwab/accounts` - Get all Schwab account numbers
- `GET /api/schwab/accounts/:accountHash/balance` - Get account balance
- `GET /api/schwab/accounts/:accountHash/positions` - Get positions
- `POST /api/schwab/quotes` - Get real-time quotes

### Frontend Usage

```typescript
// Configure Schwab
await apiClient.saveSchwabSettings({
  app_key: 'your_app_key',
  app_secret: 'your_app_secret'
});

// Get account balance (automatically updates linked account)
await apiClient.getSchwabAccountBalance(accountHash, linkedAccountId);

// Get positions
const positions = await apiClient.getSchwabPositions(accountHash);

// Get quotes
const quotes = await apiClient.getSchwabQuotes(['AAPL', 'GOOGL']);
```

## Credential Verification

### Required Format

**App Key:**
- Long alphanumeric string (32+ characters)
- No spaces, case-sensitive
- Copy directly from Schwab Developer Portal
- Example: `a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6`

**App Secret:**
- Long alphanumeric string (32+ characters)
- No spaces, case-sensitive
- Never share or commit to git
- Example: `Z9Y8X7W6V5U4T3S2R1Q0P9O8N7M6L5K4`

**Callback URL:**
Must match exactly in Schwab Portal:
- Development: `http://localhost:3002/schwab/callback`
- Production: `https://yourdomain.com/schwab/callback`

⚠️ Common mistakes:
- Trailing slash
- Wrong protocol (https vs http)
- Wrong port
- IP address instead of localhost

### App Status
Check in Schwab Developer Portal:
- ✅ Active/Approved - Ready to use
- ⚠️ Pending - Waiting for approval
- ❌ Sandbox - Test environment only

### Required Permissions
- ✅ Accounts and Trading Production
- ✅ Read account information
- ✅ Read positions
- ✅ OAuth 2.0 enabled

## Troubleshooting

### Status Shows "Not Connected"
**Cause:** Tokens not saved to database

**Fix:**
1. Check browser console for errors
2. Check server logs for token exchange errors
3. Verify App Key/Secret are correct
4. Ensure callback URL matches in Schwab Portal

### Balance Not Updating
**Cause:** Account number mismatch

**Fix:**
1. Go to Accounts page
2. Edit the account
3. Set Account Number to match Schwab account exactly
4. Save and try refresh again

### "invalid_client" Error
**Cause:** App Key or Secret is wrong

**Fix:**
1. Log into https://developer.schwab.com/
2. Copy credentials again (no spaces)
3. Re-enter in Investment Tracker
4. Check app status is Active/Approved
5. Verify callback URL is exact match

### "invalid_grant" Error
**Cause:** Authorization code expired or already used

**Fix:** Restart OAuth flow (get new authorization code)

### OAuth Popup Blocked
**Fix:** Allow popups for this site in browser settings

### Token Expired
**Cause:** Refresh token expired (7 days)

**Fix:** Re-authenticate through OAuth flow

## Testing Credentials

### Method 1: In Investment Tracker
1. Open Schwab API dialog
2. Enter credentials
3. Click "Save & Authenticate"
4. Check browser console (F12) for errors
5. Check server logs for detailed messages

### Method 2: Manual API Test

```bash
# Step 1: Get authorization code
# Open in browser (replace YOUR_APP_KEY):
https://api.schwabapi.com/v1/oauth/authorize?client_id=YOUR_APP_KEY&redirect_uri=http://localhost:3002/schwab/callback&response_type=code

# Step 2: Copy code from redirect URL
# http://localhost:3002/schwab/callback?code=XXXXX

# Step 3: Exchange code for tokens
curl -X POST https://api.schwabapi.com/v1/oauth/token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -H "Authorization: Basic $(echo -n 'YOUR_APP_KEY:YOUR_APP_SECRET' | base64)" \
  -d "grant_type=authorization_code&code=YOUR_CODE&redirect_uri=http://localhost:3002/schwab/callback"
```

**Expected response:**
```json
{
  "access_token": "...",
  "refresh_token": "...",
  "expires_in": 1800,
  "token_type": "Bearer"
}
```

## UI Guide

### Location
Other Portfolio Page → "Schwab API" button (blue, before "Refresh Market Data")

### Features
1. **API Credentials Setup** - Enter App Key and Secret
2. **OAuth Authentication** - Automatic popup for Schwab login
3. **Account Linking** - Link Schwab accounts to Investment Tracker accounts
4. **Balance Refresh** - One-click balance update

### Status Badge
- **Connected** (Green): OAuth tokens valid
- **Not Connected** (Gray): Need to authenticate

### Dropdowns
- **Schwab Account**: Shows all accounts from Schwab
- **Investment Account**: Shows all Investment Tracker accounts

## Security

- ✅ App Secret never exposed in frontend
- ✅ Tokens stored securely in database
- ✅ OAuth popup prevents phishing
- ✅ Automatic token refresh
- ✅ Per-user configuration
- ✅ All API calls authenticated with JWT

## Debug Mode

### Enable Logging
Set in `server/.env`:
```
LOG_LEVEL=0
```

Shows:
- Token request parameters
- Redirect URI being used
- Full error responses

### Check Server Logs
```bash
tail -f server/logs/app.log
```

Look for:
```
🔄 Exchanging OAuth code for tokens for user 1
✅ Successfully exchanged OAuth code and saved tokens for user 1
```

### Browser Console
Dashboard refresh shows:
```
Refreshing Schwab accounts...
Found 1 Schwab accounts
Refreshing balance for account My Account (12345678)
✅ Updated My Account: 50000.00
```

## Success Indicators

When everything works:
- ✅ OAuth popup opens successfully
- ✅ User can log into Schwab
- ✅ Authorization completes
- ✅ Status badge shows "Connected"
- ✅ Schwab accounts load in dropdown
- ✅ Balance refresh works
- ✅ No errors in server logs

## Rate Limits

Schwab API limits: ~120 requests/minute

The integration:
- Caches account data
- Only refreshes when requested
- Handles rate limit errors gracefully

## Support

**Schwab Developer Support:** developer.support@schwab.com

Include:
- Your App Key (NOT the secret)
- Error message
- Timestamp
- Callback URL

**Documentation:**
- Schwab API: https://developer.schwab.com/products/trader-api--individual
- Investment Tracker: Check server logs in `server/logs/`

## Future Enhancements

- [ ] Automatic position sync
- [ ] Transaction history import
- [ ] Real-time quote updates
- [ ] Scheduled automatic refreshes
- [ ] Balance history charts
- [ ] WebSocket support for live data
