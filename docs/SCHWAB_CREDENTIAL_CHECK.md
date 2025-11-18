# Charles Schwab Credential Verification

## Quick Checklist

Before troubleshooting OAuth issues, verify these basics:

### 1. App Key Format
- ✅ Should be a long alphanumeric string (typically 32+ characters)
- ✅ No spaces before or after
- ✅ Case-sensitive
- ✅ Copy directly from Schwab Developer Portal

**Example format:** `a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6`

### 2. App Secret Format
- ✅ Should be a long alphanumeric string (typically 32+ characters)
- ✅ No spaces before or after
- ✅ Case-sensitive
- ✅ Copy directly from Schwab Developer Portal
- ⚠️ **Never share or commit to git**

**Example format:** `Z9Y8X7W6V5U4T3S2R1Q0P9O8N7M6L5K4`

### 3. Callback URL
Must be **exactly** registered in Schwab Portal:

**Development:**
```
http://localhost:3002/schwab/callback
```

**Production:**
```
https://yourdomain.com/schwab/callback
```

⚠️ **Common mistakes:**
- ❌ `http://localhost:3002/schwab/callback/` (trailing slash)
- ❌ `https://localhost:3002/schwab/callback` (https instead of http)
- ❌ `http://localhost:3001/schwab/callback` (wrong port)
- ❌ `http://127.0.0.1:3002/schwab/callback` (IP instead of localhost)

### 4. App Status in Schwab Portal

Check your app status:
1. Log into https://developer.schwab.com/
2. Go to "My Apps"
3. Click on your app
4. Check status:
   - ✅ **Active** - Ready to use
   - ✅ **Approved** - Ready for production
   - ⚠️ **Pending** - Waiting for approval
   - ❌ **Sandbox** - Test environment only

### 5. Required Permissions

Your app must have these enabled:
- ✅ Accounts and Trading Production
- ✅ Read account information
- ✅ Read positions
- ✅ OAuth 2.0 enabled

## Testing Credentials

### Method 1: Check in Investment Tracker

1. Open Schwab API dialog
2. Enter credentials
3. Click "Save & Authenticate"
4. Check browser console (F12) for errors
5. Check server logs for detailed error messages

### Method 2: Manual API Test

You can test credentials directly with curl:

```bash
# Step 1: Get authorization code manually
# Open this URL in browser (replace YOUR_APP_KEY):
https://api.schwabapi.com/v1/oauth/authorize?client_id=YOUR_APP_KEY&redirect_uri=http://localhost:3002/schwab/callback&response_type=code

# Step 2: After authorization, you'll be redirected with a code
# Copy the code from URL: http://localhost:3002/schwab/callback?code=XXXXX

# Step 3: Exchange code for tokens (replace values):
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

**Error response (invalid credentials):**
```json
{
  "error": "invalid_client",
  "error_description": "Unauthorized"
}
```

## Common Error Messages

### "invalid_client"
- **Cause:** App Key or Secret is wrong
- **Fix:** Re-copy credentials from Schwab Portal

### "invalid_grant"
- **Cause:** Authorization code expired or already used
- **Fix:** Get a new authorization code (restart OAuth flow)

### "invalid_request"
- **Cause:** Missing required parameter
- **Fix:** Check redirect_uri matches exactly

### "unauthorized_client"
- **Cause:** App not approved for this grant type
- **Fix:** Check app permissions in Schwab Portal

### "access_denied"
- **Cause:** User denied authorization
- **Fix:** User needs to approve the authorization request

## Schwab Portal Checklist

Log into https://developer.schwab.com/ and verify:

1. **App Details:**
   - [ ] App name is correct
   - [ ] App status is "Active" or "Approved"
   - [ ] App Key is visible (copy it)
   - [ ] App Secret is visible (copy it)

2. **OAuth Settings:**
   - [ ] OAuth 2.0 is enabled
   - [ ] Callback URL is registered: `http://localhost:3002/schwab/callback`
   - [ ] For production, add: `https://yourdomain.com/schwab/callback`

3. **Permissions:**
   - [ ] "Accounts and Trading Production" is checked
   - [ ] "Read account information" is enabled
   - [ ] "Read positions" is enabled

4. **Environment:**
   - [ ] Using production credentials for production API
   - [ ] Using sandbox credentials for sandbox API (if applicable)

## Still Having Issues?

### Check Server Logs

The backend now logs detailed OAuth errors:

```bash
# View server logs
tail -f server/logs/app.log

# Look for:
🔄 Exchanging OAuth code for tokens for user 1
❌ Error exchanging OAuth code: { error: 'invalid_client', error_description: 'Unauthorized' }
Status: 401
Response data: { error: 'invalid_client', error_description: 'Unauthorized' }
```

### Enable Debug Logging

Set in `server/.env`:
```
LOG_LEVEL=0
```

This will show:
- Token request parameters
- Redirect URI being used
- Full error responses

### Contact Schwab Support

If credentials are definitely correct but still failing:

**Email:** developer.support@schwab.com

**Include:**
- Your App Key (NOT the secret)
- Error message you're receiving
- Timestamp of the error
- Callback URL you're using

They can check:
- If your app is properly configured
- If there are any restrictions on your account
- If the API endpoint is having issues

## Success Indicators

When credentials are correct:

✅ OAuth popup opens successfully
✅ User can log into Schwab
✅ Authorization completes
✅ Callback page shows "Success!"
✅ Status badge shows "Connected"
✅ Schwab accounts load in dropdown
✅ Balance refresh works

## Next Steps

Once credentials are verified:
1. Complete OAuth flow
2. Link accounts by account number
3. Test balance refresh
4. Set up automatic refreshes
