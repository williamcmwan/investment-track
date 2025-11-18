# Charles Schwab UI Integration Guide

## Overview

The Schwab API integration is now available through a user-friendly interface in the "Other Portfolio" page.

## Location

**Other Portfolio Page** → **"Schwab API"** button (blue button, located before "Refresh Market Data")

## Features

### 1. API Credentials Setup
- Enter your Schwab App Key and App Secret
- Secure storage in database (encrypted)
- One-click OAuth authentication

### 2. OAuth Authentication
- Automatic popup window for Schwab login
- Secure OAuth 2.0 flow
- Automatic token management (refresh handled automatically)

### 3. Account Linking & Balance Refresh
- View all your Schwab accounts
- Link Schwab accounts to Investment Tracker accounts
- One-click balance refresh
- Automatic performance recalculation

## Step-by-Step Usage

### First Time Setup

1. **Open Schwab API Dialog**
   - Navigate to "Other Portfolio" page
   - Click the blue "Schwab API" button

2. **Enter Credentials**
   - App Key: Your Schwab Developer App Key
   - App Secret: Your Schwab Developer App Secret
   - Click "Save & Authenticate"

3. **Complete OAuth**
   - Popup window opens automatically
   - Log in to your Schwab account
   - Authorize the application
   - Popup closes automatically

4. **Link Account & Refresh**
   - Select your Schwab account from dropdown
   - Select Investment Tracker account to link
   - Click "Refresh Balance from Schwab"
   - Balance updates automatically!

### Subsequent Usage

1. Click "Schwab API" button
2. Select accounts (if not already selected)
3. Click "Refresh Balance from Schwab"
4. Done!

## UI Components

### Status Badge
- **Connected** (Green): OAuth tokens are valid
- **Not Connected** (Gray): Need to authenticate

### Schwab Account Dropdown
- Shows all accounts from your Schwab account
- Displays account numbers
- Only visible after successful OAuth

### Investment Account Dropdown
- Shows all your Investment Tracker accounts
- Displays account names and numbers
- Select which account to update

### Refresh Button
- Updates selected account balance
- Shows loading spinner during refresh
- Displays success message with new balance

## Security Features

- ✅ App Secret never exposed in frontend
- ✅ Tokens stored securely in database
- ✅ OAuth popup prevents phishing
- ✅ Automatic token refresh (no manual intervention)
- ✅ Per-user configuration (multi-user support)

## Error Handling

### "No Schwab accounts found"
- OAuth authentication not completed
- Click "Save & Authenticate" again

### "Failed to refresh balance"
- Token may have expired (re-authenticate)
- Check Schwab API status
- Verify account permissions

### OAuth popup blocked
- Allow popups for this site
- Try again after allowing popups

## Integration with Dashboard

The Schwab integration works seamlessly with the main Dashboard:

1. **Performance Overview Refresh**
   - Click main "Refresh" button
   - Automatically refreshes Schwab balances
   - Updates performance metrics

2. **Account Matching**
   - Matches by account number
   - Automatic balance updates
   - Performance history tracking

## Tips

- **Keep OAuth tokens fresh**: Tokens expire after 7 days, re-authenticate if needed
- **Link accounts properly**: Ensure account numbers match for automatic refresh
- **Use manual refresh**: For immediate updates, use the Schwab API dialog
- **Check status badge**: Green = ready to use, Gray = need to authenticate

## Troubleshooting

### Popup doesn't open
1. Check browser popup blocker
2. Allow popups for your Investment Tracker domain
3. Try again

### Balance not updating
1. Verify account is linked (account numbers match)
2. Check OAuth status (should be "Connected")
3. Try manual refresh from Schwab API dialog
4. Check server logs for errors

### "Authentication failed"
1. Verify App Key and Secret are correct
2. Check Schwab Developer Portal for app status
3. Ensure app has "Accounts and Trading Production" access
4. Try re-entering credentials

## Future Enhancements

Planned features:
- [ ] Automatic position sync
- [ ] Transaction history import
- [ ] Real-time quote updates
- [ ] Multiple account support per user
- [ ] Scheduled automatic refreshes
- [ ] Balance history charts

## Support

For issues or questions:
1. Check server logs: `server/logs/`
2. Review API documentation: `docs/SCHWAB_INTEGRATION.md`
3. Schwab API docs: https://developer.schwab.com/
