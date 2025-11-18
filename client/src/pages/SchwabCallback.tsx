import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiClient } from '@/services/api';

export default function SchwabCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
  const [message, setMessage] = useState('Processing authentication...');

  useEffect(() => {
    handleCallback();
  }, []);

  const handleCallback = async () => {
    const code = searchParams.get('code');
    const error = searchParams.get('error');
    const errorDescription = searchParams.get('error_description');

    if (error) {
      setStatus('error');
      setMessage(`Authentication failed: ${errorDescription || error}`);
      toast({
        title: 'Error',
        description: `Schwab authentication failed: ${errorDescription || error}`,
        variant: 'destructive'
      });
      setTimeout(() => {
        window.close(); // Close popup window
      }, 3000);
      return;
    }

    if (!code) {
      setStatus('error');
      setMessage('No authorization code received');
      setTimeout(() => {
        window.close();
      }, 3000);
      return;
    }

    try {
      setMessage('Exchanging authorization code for tokens...');
      
      // Get code verifier and account ID from session storage
      const codeVerifier = sessionStorage.getItem('schwab_code_verifier');
      const accountId = sessionStorage.getItem('schwab_account_id');
      const redirectUri = `${window.location.origin}/schwab/callback`;
      
      // Exchange code for tokens on backend (secure)
      const response = await apiClient.exchangeSchwabOAuthCode({
        code,
        code_verifier: codeVerifier || undefined,
        redirect_uri: redirectUri,
        account_id: accountId || undefined
      });
      
      if (!response.data) {
        throw new Error(response.error || 'Failed to exchange authorization code');
      }

      setMessage('Fetching account information...');
      
      // Fetch account numbers to get the account hash
      const accountsResponse = await apiClient.getSchwabAccounts();
      
      if (accountsResponse.data && accountsResponse.data.length > 0) {
        // Get the first account hash (or let user select if multiple)
        const accountHash = accountsResponse.data[0].hashValue;
        
        // Update the account integration with the account hash
        if (accountId) {
          const updateResponse = await apiClient.setAccountIntegration(
            parseInt(accountId),
            'SCHWAB',
            {
              accountHash: accountHash
            }
          );
          
          if (updateResponse.data) {
            setMessage('Account hash saved successfully!');
          }
        }
      }
      
      // Clean up session storage
      sessionStorage.removeItem('schwab_code_verifier');
      sessionStorage.removeItem('schwab_account_id');
      
      setStatus('success');
      setMessage('Authentication successful! You can now close this window.');
      
      toast({
        title: 'Success',
        description: 'Schwab authentication completed successfully!'
      });

      // Notify parent window if it exists
      if (window.opener) {
        window.opener.postMessage({ type: 'schwab_auth_success' }, window.location.origin);
      }

      // Close window after 2 seconds
      setTimeout(() => {
        window.close();
      }, 2000);
      
    } catch (error: any) {
      setStatus('error');
      setMessage(`Failed to complete authentication: ${error.message || 'Unknown error'}`);
      toast({
        title: 'Error',
        description: error.message || 'Failed to complete authentication',
        variant: 'destructive'
      });
      
      // Clean up session storage
      sessionStorage.removeItem('schwab_code_verifier');
      sessionStorage.removeItem('schwab_account_id');
      
      // Notify parent window of error
      if (window.opener) {
        window.opener.postMessage({ 
          type: 'schwab_auth_error',
          message: error.message || 'Authentication failed'
        }, window.location.origin);
      }
      
      setTimeout(() => {
        window.close();
      }, 3000);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <div className="text-center space-y-4 p-8 max-w-md">
        {status === 'processing' && (
          <>
            <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto" />
            <h2 className="text-2xl font-bold">Schwab Authentication</h2>
            <p className="text-muted-foreground">{message}</p>
          </>
        )}
        
        {status === 'success' && (
          <>
            <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto" />
            <h2 className="text-2xl font-bold text-green-500">Success!</h2>
            <p className="text-muted-foreground">{message}</p>
            <p className="text-sm text-muted-foreground">This window will close automatically...</p>
          </>
        )}
        
        {status === 'error' && (
          <>
            <XCircle className="h-12 w-12 text-destructive mx-auto" />
            <h2 className="text-2xl font-bold text-destructive">Error</h2>
            <p className="text-muted-foreground">{message}</p>
            <p className="text-sm text-muted-foreground">This window will close automatically...</p>
          </>
        )}
      </div>
    </div>
  );
}
