import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle2, AlertCircle, ExternalLink } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiClient } from "@/services/api";

interface SchwabSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accounts: Array<{
    id: number;
    name: string;
    accountNumber?: string;
  }>;
  onBalanceRefreshed?: () => void;
}

export default function SchwabSettingsDialog({ 
  open, 
  onOpenChange, 
  accounts,
  onBalanceRefreshed 
}: SchwabSettingsDialogProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [hasTokens, setHasTokens] = useState(false);
  const [schwabAccounts, setSchwabAccounts] = useState<any[]>([]);
  const [loadingSchwabAccounts, setLoadingSchwabAccounts] = useState(false);
  
  const [form, setForm] = useState({
    appKey: '',
    appSecret: '',
    selectedAccount: '',
    linkedAccountId: ''
  });

  useEffect(() => {
    if (open) {
      loadSettings();
    }
  }, [open]);

  const loadSettings = async () => {
    try {
      const response = await apiClient.getSchwabSettings();
      if (response.data) {
        setForm(prev => ({
          ...prev,
          appKey: response.data.app_key || ''
        }));
        setHasTokens(response.data.has_tokens);
        
        // If has tokens, load Schwab accounts
        if (response.data.has_tokens) {
          loadSchwabAccounts();
        }
      }
    } catch (error) {
      console.error('Failed to load Schwab settings:', error);
    }
  };

  const loadSchwabAccounts = async () => {
    try {
      setLoadingSchwabAccounts(true);
      const response = await apiClient.getSchwabAccounts();
      if (response.data) {
        setSchwabAccounts(response.data);
      } else if (response.error) {
        toast({
          title: "Error",
          description: response.error,
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Failed to load Schwab accounts:', error);
    } finally {
      setLoadingSchwabAccounts(false);
    }
  };

  const handleSaveCredentials = async () => {
    if (!form.appKey || !form.appSecret) {
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
        app_key: form.appKey,
        app_secret: form.appSecret
      });

      if (response.data) {
        toast({
          title: 'Success',
          description: 'Schwab credentials saved successfully. Please complete OAuth authentication.'
        });
        // Open OAuth flow in new window
        handleStartOAuth();
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

  const generateCodeVerifier = () => {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return btoa(String.fromCharCode(...array))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  };

  const generateCodeChallenge = async (verifier: string) => {
    const encoder = new TextEncoder();
    const data = encoder.encode(verifier);
    const hash = await crypto.subtle.digest('SHA-256', data);
    return btoa(String.fromCharCode(...new Uint8Array(hash)))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  };

  const handleStartOAuth = async () => {
    try {
      // Generate PKCE parameters
      const codeVerifier = generateCodeVerifier();
      const codeChallenge = await generateCodeChallenge(codeVerifier);
      
      // Store code verifier for later use
      sessionStorage.setItem('schwab_code_verifier', codeVerifier);
      
      const redirectUri = `${window.location.origin}/schwab/callback`;
      const authUrl = `https://api.schwabapi.com/v1/oauth/authorize?` +
        `client_id=${encodeURIComponent(form.appKey)}&` +
        `redirect_uri=${encodeURIComponent(redirectUri)}&` +
        `response_type=code&` +
        `code_challenge=${encodeURIComponent(codeChallenge)}&` +
        `code_challenge_method=S256`;
      
      // Open in new window
      const width = 600;
      const height = 700;
      const left = window.screen.width / 2 - width / 2;
      const top = window.screen.height / 2 - height / 2;
      
      window.open(
        authUrl,
        'Schwab OAuth',
        `width=${width},height=${height},left=${left},top=${top}`
      );
      
      toast({
        title: 'OAuth Window Opened',
        description: 'Please complete authentication in the popup window'
      });
    } catch (error) {
      console.error('Error starting OAuth:', error);
      toast({
        title: 'Error',
        description: 'Failed to start OAuth flow',
        variant: 'destructive'
      });
    }
  };

  const handleRefreshBalance = async () => {
    if (!form.selectedAccount || !form.linkedAccountId) {
      toast({
        title: 'Error',
        description: 'Please select both Schwab account and linked account',
        variant: 'destructive'
      });
      return;
    }

    setLoading(true);
    try {
      const schwabAccount = schwabAccounts.find(acc => acc.accountNumber === form.selectedAccount);
      if (!schwabAccount) {
        throw new Error('Schwab account not found');
      }

      const response = await apiClient.getSchwabAccountBalance(
        schwabAccount.hashValue,
        parseInt(form.linkedAccountId)
      );

      if (response.data) {
        toast({
          title: 'Success',
          description: `Balance updated: ${new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD'
          }).format(response.data.currentBalance)}`
        });
        
        if (onBalanceRefreshed) {
          onBalanceRefreshed();
        }
      } else {
        toast({
          title: 'Error',
          description: response.error || 'Failed to refresh balance',
          variant: 'destructive'
        });
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to refresh balance',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Charles Schwab Integration
          </DialogTitle>
          <DialogDescription>
            Configure your Schwab API credentials and link accounts for automatic balance updates
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Status Badge */}
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Status:</span>
            {hasTokens ? (
              <Badge variant="default" className="gap-1">
                <CheckCircle2 className="h-3 w-3" />
                Connected
              </Badge>
            ) : (
              <Badge variant="secondary" className="gap-1">
                <AlertCircle className="h-3 w-3" />
                Not Connected
              </Badge>
            )}
          </div>

          {/* Setup Instructions */}
          <Alert>
            <AlertDescription className="text-xs space-y-2">
              <p>To get started:</p>
              <ol className="list-decimal list-inside space-y-1 ml-2">
                <li>Get your App Key and Secret from <a href="https://developer.schwab.com/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center gap-1">Schwab Developer Portal <ExternalLink className="h-3 w-3" /></a></li>
                <li>Enter credentials below and save</li>
                <li>Complete OAuth authentication</li>
                <li>Link your Schwab account to an Investment Tracker account</li>
              </ol>
            </AlertDescription>
          </Alert>

          {/* Credentials Section */}
          <div className="space-y-3 border-t pt-4">
            <h4 className="text-sm font-semibold">API Credentials</h4>
            
            <div className="space-y-2">
              <Label htmlFor="appKey">App Key</Label>
              <Input
                id="appKey"
                type="text"
                value={form.appKey}
                onChange={(e) => setForm({ ...form, appKey: e.target.value })}
                placeholder="Enter your Schwab App Key"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="appSecret">App Secret</Label>
              <Input
                id="appSecret"
                type="password"
                value={form.appSecret}
                onChange={(e) => setForm({ ...form, appSecret: e.target.value })}
                placeholder="Enter your Schwab App Secret"
              />
            </div>

            <Button
              onClick={handleSaveCredentials}
              disabled={loading || !form.appKey || !form.appSecret}
              className="w-full"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save & Authenticate'
              )}
            </Button>
          </div>

          {/* Account Linking Section */}
          {hasTokens && (
            <div className="space-y-3 border-t pt-4">
              <h4 className="text-sm font-semibold">Link Account & Refresh Balance</h4>
              
              {loadingSchwabAccounts ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : schwabAccounts.length > 0 ? (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="schwabAccount">Schwab Account</Label>
                    <Select 
                      value={form.selectedAccount} 
                      onValueChange={(value) => setForm({ ...form, selectedAccount: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select Schwab account" />
                      </SelectTrigger>
                      <SelectContent>
                        {schwabAccounts.map((account) => (
                          <SelectItem key={account.hashValue} value={account.accountNumber}>
                            {account.accountNumber}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="linkedAccount">Link to Investment Account</Label>
                    <Select 
                      value={form.linkedAccountId} 
                      onValueChange={(value) => setForm({ ...form, linkedAccountId: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select account to link" />
                      </SelectTrigger>
                      <SelectContent>
                        {accounts.map((account) => (
                          <SelectItem key={account.id} value={account.id.toString()}>
                            {account.name} {account.accountNumber ? `(${account.accountNumber})` : ''}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <Button
                    onClick={handleRefreshBalance}
                    disabled={loading || !form.selectedAccount || !form.linkedAccountId}
                    className="w-full"
                    variant="default"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Refreshing...
                      </>
                    ) : (
                      'Refresh Balance from Schwab'
                    )}
                  </Button>
                </>
              ) : (
                <Alert>
                  <AlertDescription className="text-xs">
                    No Schwab accounts found. Please ensure you've completed OAuth authentication.
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
