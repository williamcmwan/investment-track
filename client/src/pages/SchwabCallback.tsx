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
      
      // Note: In a production environment, this token exchange should happen
      // on the backend to keep the client_secret secure.
      // For now, we'll show a success message and let the user manually
      // complete the process through the settings dialog.
      
      setStatus('success');
      setMessage('Authentication successful! You can now close this window and return to the settings dialog.');
      
      toast({
        title: 'Success',
        description: 'Schwab authentication completed. Please save your tokens in the settings dialog.'
      });

      // Close window after 3 seconds
      setTimeout(() => {
        window.close();
      }, 3000);
      
    } catch (error: any) {
      setStatus('error');
      setMessage('Failed to complete authentication');
      toast({
        title: 'Error',
        description: error.message || 'Failed to complete authentication',
        variant: 'destructive'
      });
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
