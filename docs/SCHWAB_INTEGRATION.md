# Charles Schwab API Integration

This document explains how to integrate Charles Schwab API to automatically refresh account balances in your Investment Tracker.

## Prerequisites

1. **Charles Schwab Developer Account**
   - Sign up at [Charles Schwab Developer Portal](https://developer.schwab.com/)
   - Create an App with "Accounts and Trading Production" access
   - Note down your App Key and App Secret

2. **OAuth 2.0 Setup**
   - Schwab uses OAuth 2.0 with PKCE for authentication
   - You'll need to implement the OAuth flow to get access and refresh tokens

## Setup Instructions

### 1. Configure Schwab Credentials

The Schwab integration is configured per user in the application. Each user can set up their own Schwab connection.

### 2. Link Schwab Account to Investment Account

When creating or editing an account in the Investment Tracker:
- Set the **Account Number** field to match your Schwab account number
- This allows the system to automatically update the correct account when refreshing

### 3. OAuth Authentication Flow

The OAuth flow needs to be implemented in your frontend:

```typescript
// 1. Generate PKCE code verifier and challenge
const codeVerifier = generateRandomString(128);
const codeChallenge = await generateCodeChallenge(codeVerifier);

// 2. Redirect user to Schwab authorization URL
const authUrl = `https://api.schwabapi.com/v1/oauth/authorize?` +
  `client_id=${appKey}&` +
  `redirect_uri=${redirectUri}&` +
  `response_type=code&` +
  `code_challenge=${codeChallenge}&` +
  `code_challenge_method=S256`;

// 3. After user authorizes, exchange code for tokens
const tokenResponse = await fetch('https://api.schwabapi.com/v1/oauth/token', {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({
    grant_type: 'authorization_code',
    code: authorizationCode,
    redirect_uri: redirectUri,
    client_id: appKey,
    client_secret: appSecret,
    code_verifier: codeVerifier
  })
});

// 4. Save tokens using API
await apiClient.saveSchwabTokens({
  access_token: tokenResponse.access_token,
  refresh_token: tokenResponse.refresh_token,
  expires_in: tokenResponse.expires_in
});
```

## API Endpoints

### Backend Routes (server/src/routes/schwab.ts)

- `GET /api/schwab/settings` - Get user's Schwab configuration
- `POST /api/schwab/settings` - Save App Key and Secret
- `POST /api/schwab/tokens` - Save OAuth tokens after authentication
- `GET /api/schwab/accounts` - Get all Schwab account numbers
- `GET /api/schwab/accounts/:accountHash/balance` - Get account balance and refresh linked account
- `GET /api/schwab/accounts/:accountHash/positions` - Get positions for an account
- `POST /api/schwab/quotes` - Get real-time quotes for symbols

### Frontend API Client (client/src/services/api.ts)

```typescript
// Configure Schwab
await apiClient.saveSchwabSettings({
  app_key: 'your_app_key',
  app_secret: 'your_app_secret'
});

// Save OAuth tokens
await apiClient.saveSchwabTokens({
  access_token: 'token',
  refresh_token: 'refresh',
  expires_in: 1800
});

// Get account balance (automatically updates linked account)
await apiClient.getSchwabAccountBalance(accountHash, linkedAccountId);

// Get positions
const positions = await apiClient.getSchwabPositions(accountHash);

// Get quotes
const quotes = await apiClient.getSchwabQuotes(['AAPL', 'GOOGL']);
```

## Automatic Refresh

When you click the "Refresh" button in the Performance Overview:

1. The system checks if Schwab is configured
2. Retrieves all Schwab accounts
3. Matches them with your Investment Tracker accounts by account number
4. Refreshes the balance for each matched account
5. Updates the performance history

## Token Management

- **Access Token**: Valid for 30 minutes, automatically refreshed when needed
- **Refresh Token**: Valid for 7 days, used to get new access tokens
- Tokens are stored securely in the database per user
- The system automatically handles token refresh before expiration

## Security Notes

- App Secret is stored encrypted in the database
- Tokens are never exposed to the frontend
- All API calls are authenticated with JWT
- OAuth flow should be implemented with PKCE for security

## Rate Limits

Charles Schwab API has rate limits (typically 120 requests/minute). The integration:
- Caches account data to minimize API calls
- Only refreshes when explicitly requested
- Handles rate limit errors gracefully

## Troubleshooting

### "No access token available"
- Complete the OAuth authentication flow
- Ensure tokens are saved correctly

### "Failed to refresh access token"
- Refresh token may have expired (7 days)
- Re-authenticate through OAuth flow

### Account not updating
- Verify account number matches exactly
- Check that Schwab account is linked correctly
- Review server logs for API errors

## Future Enhancements

- Automatic position sync to portfolio
- Real-time quote updates
- Transaction history import
- Multi-account support per user
