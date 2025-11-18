# Charles Schwab Integration Troubleshooting

## Recent Fixes

### Issue: Status shows "Not Connected" after OAuth
**Problem:** OAuth callback wasn't actually exchanging the authorization code for tokens.

**Solution:** Added secure backend endpoint `/api/schwab/oauth/exchange` that:
- Exchanges authorization code for access/refresh tokens
- Keeps client_secret secure on backend
- Automatically saves tokens to database
- Notifies parent window of success

### Issue: Dashboard refresh doesn't update Schwab balances
**Problem:** Account matching wasn't working properly.

**Solution:** 
- Added `accountNumber` field to Account interface
- Improved logging for debugging
- Added proper error handling
- Matches Schwab accounts by account number

## How It Works Now

### OAuth Flow (Fixed)
1. User clicks "Save & Authenticate" in Schwab dialog
2. Popup opens with Schwab login
3. User authorizes the app
4. Schwab redirects to `/schwab/callback` with authorization code
5. **Callback page calls backend `/api/schwab/oauth/exchange`**
6. **Backend exchanges code for tokens (secure)**
7. **Tokens saved to database**
8. Popup notifies parent window and closes
9. Settings dialog reloads and shows "Connected" status

### Balance Refresh Flow
1. User clicks "Refresh" in Dashboard
2. System checks if Schwab has tokens
3. Fetches all Schwab accounts
4. Matches by account number
5. Updates each matched account balance
6. Recalculates performance

## Verification Steps

### 1. Check OAuth Success
After completing OAuth:
- Status badge should show "Connected" (green)
- Schwab accounts dropdown should populate
- Browser console should show: "Schwab authentication completed successfully!"

### 2. Check Account Linking
- Ensure your Investment Tracker account has `accountNumber` field set
- Account number must exactly match Schwab account number
- Check in Accounts page → Edit account → Account Number field

### 3. Check Balance Refresh
Open browser console (F12) and click Dashboard "Refresh":
```
Refreshing Schwab accounts...
Found 1 Schwab accounts
Refreshing balance for account My Account (12345678)
✅ Updated My Account: 50000.00
✅ Schwab: Refreshed 1 account(s)
```

### 4. Check Backend Logs
Server logs should show:
```
🔄 Exchanging OAuth code for tokens for user 1
✅ Successfully exchanged OAuth code and saved tokens for user 1
```

## Common Issues

### "Status: Not Connected" after OAuth

**Cause:** Tokens not saved to database

**Check:**
1. Open browser console during OAuth
2. Look for errors in callback page
3. Check server logs for token exchange errors

**Fix:**
- Ensure backend endpoint `/api/schwab/oauth/exchange` is working
- Check that Schwab API credentials are correct
- Verify callback URL matches in Schwab Developer Portal

### Balance not updating on refresh

**Cause:** Account number mismatch

**Check:**
1. Open browser console during refresh
2. Look for: "No matching account found for Schwab account XXXXX"

**Fix:**
1. Go to Accounts page
2. Edit the account you want to link
3. Set Account Number to match Schwab account number exactly
4. Save and try refresh again

### "Failed to exchange authorization code"

**Cause:** OAuth configuration issue

**Possible reasons:**
- Callback URL mismatch
- Invalid App Key/Secret
- Code verifier missing (PKCE issue)
- Schwab API error

**Fix:**
1. Verify callback URL in Schwab Portal: `http://localhost:3002/schwab/callback`
2. Re-enter App Key and Secret
3. Clear browser cache and try again
4. Check server logs for detailed error

### "invalid_client" or "Unauthorized" Error

**Cause:** Schwab rejecting client credentials

**Common reasons:**
1. **App Key or Secret is incorrect**
   - Copy directly from Schwab Developer Portal
   - No extra spaces or characters
   - Case-sensitive

2. **App not approved for production**
   - Check app status in Schwab Portal
   - May need to use sandbox/test environment first
   - Request production approval if needed

3. **Wrong API endpoint**
   - Production: `https://api.schwabapi.com`
   - Sandbox: Check Schwab docs for sandbox URL
   - Ensure credentials match environment

4. **Authentication method**
   - Schwab requires Basic Auth (Base64 encoded)
   - Format: `Authorization: Basic base64(client_id:client_secret)`
   - Now handled automatically by backend

**Fix:**
1. **Verify credentials in Schwab Portal:**
   - Log into https://developer.schwab.com/
   - Go to your app
   - Copy App Key and Secret again
   - Paste into Investment Tracker (no spaces)

2. **Check app status:**
   - Status should be "Active" or "Approved"
   - If "Pending", wait for approval
   - If "Sandbox", use sandbox credentials

3. **Verify callback URL:**
   - Must exactly match: `http://localhost:3002/schwab/callback`
   - No trailing slash
   - Correct protocol (http for localhost)

4. **Check app permissions:**
   - "Accounts and Trading Production" enabled
   - All required OAuth scopes selected

5. **Try re-creating the app:**
   - Sometimes helps with persistent issues
   - Create new app in Schwab Portal
   - Use new credentials

### Schwab accounts not loading

**Cause:** Token expired or invalid

**Fix:**
1. Re-authenticate through OAuth
2. Check token expiration in database
3. Verify API permissions in Schwab Portal

## Debug Mode

### Enable Console Logging

The Dashboard refresh now includes detailed console logging:

```javascript
// Check if Schwab is configured
console.log('Schwab not configured or no tokens, skipping refresh');

// Show accounts found
console.log('Found 2 Schwab accounts');

// Show matching process
console.log('Refreshing balance for account My Account (12345678)');

// Show success
console.log('✅ Updated My Account: 50000.00');
```

### Check Database

To verify tokens are saved:

```sql
SELECT user_id, app_key, 
       CASE WHEN access_token IS NOT NULL THEN 'YES' ELSE 'NO' END as has_token,
       token_expires_at,
       updated_at
FROM schwab_settings;
```

### Test API Directly

Test if tokens work:

```bash
# Get Schwab settings
curl -X GET http://localhost:3002/api/schwab/settings \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Should return:
# { "app_key": "...", "has_tokens": true }
```

## Manual Token Entry (Workaround)

If OAuth continues to fail, you can manually enter tokens:

1. Get tokens from Schwab OAuth Playground (if available)
2. Use API endpoint:
```bash
curl -X POST http://localhost:3002/api/schwab/tokens \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "access_token": "YOUR_ACCESS_TOKEN",
    "refresh_token": "YOUR_REFRESH_TOKEN",
    "expires_in": 1800
  }'
```

## Getting Help

If issues persist:

1. **Check server logs:** `server/logs/`
2. **Check browser console:** F12 → Console tab
3. **Verify Schwab Portal settings:**
   - App status (Active/Approved)
   - Callback URL exact match
   - Permissions enabled
4. **Contact Schwab Support:** developer.support@schwab.com

## Success Indicators

When everything is working correctly:

✅ Status badge shows "Connected" (green)
✅ Schwab accounts dropdown populates
✅ Balance refresh updates account
✅ Console shows successful refresh messages
✅ Performance metrics recalculate
✅ No errors in server logs

## Next Steps

Once working:
- Set up automatic scheduled refreshes
- Add position sync functionality
- Import transaction history
- Enable real-time quotes
