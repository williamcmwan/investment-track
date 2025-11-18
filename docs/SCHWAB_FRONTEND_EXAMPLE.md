# Charles Schwab Frontend Integration Example

This document provides example code for implementing the Schwab OAuth flow and settings UI in your React frontend.

## 1. Schwab Settings Component

Create a settings page where users can configure their Schwab connection:

```typescript
// components/SchwabSettings.tsx
import { useState, useEffect } from 'react';
import { apiClient } from '@/services/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';

export default function SchwabSettings() {
  const [appKey, setAppKey] = useState('');
  const [appSecret, setAppSecret] = useState('');
  const [hasTokens, setHasTokens] = useState(false);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const response = await apiClient.getSchwabSettings();
      if (response.data) {
        setAppKey(response.data.app_key);
        setHasTokens(response.data.has_tokens);
      }
    } catch (error) {
      console.error('Failed to load Schwab settings:', error);
    }
  };

  const handleSaveCredentials = async () => {
    if (!appKey || !appSecret) {
      toast({
        title: 'Error',
        description: 'Please enter both App Key and App Secret',
        variant: 'destructive'
      });
      return;
    }

    setLoading(true);
    try {
      const response = await apiClient.saveSchwabSettings({
        app_key: appKey,
        app_secret: appSecret
      });

      if (response.data) {
        toast({
          title: 'Success',
          description: 'Schwab credentials saved successfully'
        });
      } else {
        toast({
          title: 'Error',
          description: response.error || 'Failed to save credentials',
          variant: 'destructive'
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to save credentials',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleStartOAuth = () => {
    // Redirect to OAuth flow
    const redirectUri = `${window.location.origin}/schwab/callback`;
    const authUrl = `https://api.schwabapi.com/v1/oauth/authorize?` +
      `client_id=${appKey}&` +
      `redirect_uri=${encodeURIComponent(redirectUri)}&` +
      `response_type=code`;
    
    window.location.href = authUrl;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Charles Schwab Integration</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2">
            App Key
          </label>
          <Input
            type="text"
            value={appKey}
            onChange={(e) => setAppKey(e.target.value)}
            placeholder="Enter your Schwab App Key"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">
            App Secret
          </label>
          <Input
            type="password"
            value={appSecret}
            onChange={(e) => setAppSecret(e.target.value)}
            placeholder="Enter your Schwab App Secret"
          />
        </div>

        <Button
          onClick={handleSaveCredentials}
          disabled={loading}
        >
          Save Credentials
        </Button>

        {appKey && (
          <div className="pt-4 border-t">
            <p className="text-sm text-gray-600 mb-2">
              Status: {hasTokens ? '✅ Connected' : '⚠️ Not authenticated'}
            </p>
            <Button
              onClick={handleStartOAuth}
              variant="outline"
              disabled={!appKey}
            >
              {hasTokens ? 'Re-authenticate' : 'Connect to Schwab'}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
```

## 2. OAuth Callback Handler

Create a callback page to handle the OAuth redirect:

```typescript
// pages/SchwabCallback.tsx
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { apiClient } from '@/services/api';
import { useToast } from '@/hooks/use-toast';

export default function SchwabCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [status, setStatus] = useState('Processing...');

  useEffect(() => {
    handleCallback();
  }, []);

  const handleCallback = async () => {
    const code = searchParams.get('code');
    const error = searchParams.get('error');

    if (error) {
      setStatus('Authentication failed');
      toast({
        title: 'Error',
        description: `Schwab authentication failed: ${error}`,
        variant: 'destructive'
      });
      setTimeout(() => navigate('/settings'), 3000);
      return;
    }

    if (!code) {
      setStatus('No authorization code received');
      setTimeout(() => navigate('/settings'), 3000);
      return;
    }

    try {
      setStatus('Exchanging authorization code for tokens...');
      
      // Get settings to retrieve app key and secret
      const settingsResponse = await apiClient.getSchwabSettings();
      if (!settingsResponse.data) {
        throw new Error('Schwab settings not found');
      }

      // Exchange code for tokens
      // Note: This should ideally be done on the backend for security
      const tokenResponse = await fetch('https://api.schwabapi.com/v1/oauth/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code: code,
          redirect_uri: `${window.location.origin}/schwab/callback`,
          client_id: settingsResponse.data.app_key,
          // Note: In production, client_secret should never be exposed to frontend
          // This exchange should happen on your backend
        })
      });

      if (!tokenResponse.ok) {
        throw new Error('Failed to exchange code for tokens');
      }

      const tokens = await tokenResponse.json();

      // Save tokens
      setStatus('Saving tokens...');
      const saveResponse = await apiClient.saveSchwabTokens({
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_in: tokens.expires_in
      });

      if (saveResponse.data) {
        setStatus('Success! Redirecting...');
        toast({
          title: 'Success',
          description: 'Schwab account connected successfully'
        });
        setTimeout(() => navigate('/settings'), 2000);
      } else {
        throw new Error(saveResponse.error || 'Failed to save tokens');
      }
    } catch (error: any) {
      setStatus('Failed to complete authentication');
      toast({
        title: 'Error',
        description: error.message || 'Failed to complete authentication',
        variant: 'destructive'
      });
      setTimeout(() => navigate('/settings'), 3000);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <h2 className="text-2xl font-bold mb-4">Schwab Authentication</h2>
        <p className="text-gray-600">{status}</p>
      </div>
    </div>
  );
}
```

## 3. Account Linking Component

Add UI to link Schwab accounts with Investment Tracker accounts:

```typescript
// components/SchwabAccountLink.tsx
import { useState, useEffect } from 'react';
import { apiClient } from '@/services/api';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';

interface SchwabAccountLinkProps {
  accountId: number;
  currentAccountNumber?: string;
  onUpdate: () => void;
}

export default function SchwabAccountLink({ 
  accountId, 
  currentAccountNumber,
  onUpdate 
}: SchwabAccountLinkProps) {
  const [schwabAccounts, setSchwabAccounts] = useState<any[]>([]);
  const [selectedAccount, setSelectedAccount] = useState(currentAccountNumber || '');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadSchwabAccounts();
  }, []);

  const loadSchwabAccounts = async () => {
    try {
      const response = await apiClient.getSchwabAccounts();
      if (response.data) {
        setSchwabAccounts(response.data);
      }
    } catch (error) {
      console.error('Failed to load Schwab accounts:', error);
    }
  };

  const handleLink = async () => {
    if (!selectedAccount) return;

    setLoading(true);
    try {
      const response = await apiClient.updateAccount(accountId, {
        accountNumber: selectedAccount
      });

      if (response.data) {
        toast({
          title: 'Success',
          description: 'Schwab account linked successfully'
        });
        onUpdate();
      } else {
        toast({
          title: 'Error',
          description: response.error || 'Failed to link account',
          variant: 'destructive'
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to link account',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  if (schwabAccounts.length === 0) {
    return (
      <div className="text-sm text-gray-500">
        No Schwab accounts found. Please configure Schwab integration first.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium">
        Link Schwab Account
      </label>
      <div className="flex gap-2">
        <Select value={selectedAccount} onValueChange={setSelectedAccount}>
          <SelectTrigger>
            <SelectValue placeholder="Select Schwab account" />
          </SelectTrigger>
          <SelectContent>
            {schwabAccounts.map((account) => (
              <SelectItem key={account.hashValue} value={account.accountNumber}>
                {account.accountNumber} - {account.accountType}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          onClick={handleLink}
          disabled={loading || !selectedAccount}
        >
          Link
        </Button>
      </div>
    </div>
  );
}
```

## 4. Manual Balance Refresh Button

Add a button to manually refresh Schwab balance:

```typescript
// In your account details component
const handleRefreshSchwabBalance = async (accountId: number, accountHash: string) => {
  try {
    const response = await apiClient.getSchwabAccountBalance(accountHash, accountId);
    
    if (response.data) {
      toast({
        title: 'Success',
        description: `Balance updated: ${response.data.currentBalance}`
      });
      // Reload account data
      loadAccount();
    } else {
      toast({
        title: 'Error',
        description: response.error || 'Failed to refresh balance',
        variant: 'destructive'
      });
    }
  } catch (error) {
    toast({
      title: 'Error',
      description: 'Failed to refresh balance',
      variant: 'destructive'
    });
  }
};
```

## 5. Router Configuration

Add routes to your React Router:

```typescript
// App.tsx or routes configuration
import SchwabCallback from './pages/SchwabCallback';
import SchwabSettings from './components/SchwabSettings';

// In your routes
<Route path="/schwab/callback" element={<SchwabCallback />} />
<Route path="/settings/schwab" element={<SchwabSettings />} />
```

## Security Considerations

⚠️ **Important**: The OAuth token exchange shown above exposes the client secret in the frontend, which is NOT secure for production.

**Production Implementation:**
1. Create a backend endpoint to handle the OAuth code exchange
2. Keep client_secret on the server only
3. Use PKCE (Proof Key for Code Exchange) for additional security

```typescript
// Better approach: Backend endpoint
// server/src/routes/schwab.ts
router.post('/oauth/exchange', authenticateToken, async (req, res) => {
  const { code } = req.body;
  const userId = req.user.id;
  
  // Get user's settings (including secret)
  const settings = await SchwabService.getUserSettings(userId);
  
  // Exchange code for tokens on backend
  const tokens = await exchangeCodeForTokens(code, settings);
  
  // Save tokens
  await SchwabService.saveUserSettings(userId, {
    ...settings,
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    token_expires_at: Date.now() + tokens.expires_in * 1000
  });
  
  res.json({ success: true });
});
```

## Testing

Test the integration:

1. Configure Schwab credentials
2. Complete OAuth flow
3. Link an account
4. Refresh balance manually
5. Check automatic refresh in Dashboard

## Next Steps

- Add error handling for expired tokens
- Implement automatic token refresh UI
- Add position sync functionality
- Create transaction import feature
