import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle2, AlertCircle, RefreshCw, TestTube } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiClient } from "@/services/api";

interface IntegrationConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accountId: number;
  accountName: string;
  onIntegrationUpdated?: () => void;
}

export default function IntegrationConfigDialog({
  open,
  onOpenChange,
  accountId,
  accountName,
  onIntegrationUpdated
}: IntegrationConfigDialogProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [currentType, setCurrentType] = useState<string | null>(null);
  const [selectedTab, setSelectedTab] = useState<string>('none');

  // IB form state
  const [ibForm, setIbForm] = useState({
    host: 'localhost',
    port: '4001',
    clientId: '1'
  });

  // Schwab form state
  const [schwabForm, setSchwabForm] = useState({
    appKey: '',
    appSecret: '',
    accountHash: ''
  });

  useEffect(() => {
    if (open) {
      loadIntegration();
    }
  }, [open, accountId]);

  const loadIntegration = async () => {
    try {
      setLoading(true);
      const response = await apiClient.getAccountIntegration(accountId);
      
      console.log('Integration response:', response.data);
      
      if (response.data && response.data.type) {
        setCurrentType(response.data.type);
        setSelectedTab(response.data.type.toLowerCase());
        
        if (response.data.type === 'IB' && response.data.config) {
          console.log('Loading IB config:', response.data.config);
          setIbForm({
            host: response.data.config.host || 'localhost',
            port: response.data.config.port?.toString() || '4001',
            clientId: response.data.config.clientId?.toString() || '1'
          });
        } else if (response.data.type === 'SCHWAB' && response.data.config) {
          setSchwabForm({
            appKey: response.data.config.appKey || '',
            appSecret: '', // Don't load secret for security
            accountHash: response.data.config.accountHash || ''
          });
        }
      } else {
        console.log('No integration configured');
        setCurrentType(null);
        setSelectedTab('none');
      }
    } catch (error) {
      console.error('Failed to load integration:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveIntegration = async () => {
    try {
      setLoading(true);

      if (selectedTab === 'none') {
        // Remove integration
        const response = await apiClient.removeAccountIntegration(accountId);
        if (response.data) {
          toast({
            title: 'Success',
            description: 'Integration removed successfully'
          });
          setCurrentType(null);
          if (onIntegrationUpdated) onIntegrationUpdated();
        }
      } else if (selectedTab === 'ib') {
        // Save IB integration
        const config = {
          host: ibForm.host,
          port: parseInt(ibForm.port),
          clientId: parseInt(ibForm.clientId)
        };

        console.log('Saving IB config:', { type: 'IB', ...config });
        const response = await apiClient.setAccountIntegration(accountId, 'IB', config);
        if (response.data) {
          toast({
            title: 'Success',
            description: 'IB integration configured successfully'
          });
          setCurrentType('IB');
          if (onIntegrationUpdated) onIntegrationUpdated();
        } else {
          toast({
            title: 'Error',
            description: response.error || 'Failed to save integration',
            variant: 'destructive'
          });
        }
      } else if (selectedTab === 'schwab') {
        // Save Schwab integration
        if (!schwabForm.appKey || !schwabForm.appSecret) {
          toast({
            title: 'Error',
            description: 'Please enter App Key and App Secret',
            variant: 'destructive'
          });
          return;
        }

        const config = {
          appKey: schwabForm.appKey,
          appSecret: schwabForm.appSecret,
          accountHash: schwabForm.accountHash || undefined
        };

        const response = await apiClient.setAccountIntegration(accountId, 'SCHWAB', config);
        if (response.data) {
          toast({
            title: 'Success',
            description: 'Schwab integration configured. Starting OAuth flow...'
          });
          setCurrentType('SCHWAB');
          
          // Close dialog before redirecting
          onOpenChange(false);
          
          // Initiate OAuth flow
          setTimeout(() => {
            initiateOAuthFlow(accountId);
          }, 500);
        } else {
          toast({
            title: 'Error',
            description: response.error || 'Failed to save integration',
            variant: 'destructive'
          });
        }
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to save integration',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleTestConnection = async () => {
    try {
      setTesting(true);
      const response = await apiClient.testAccountIntegration(accountId);
      
      if (response.data && response.data.success) {
        toast({
          title: 'Success',
          description: response.data.message
        });
      } else {
        toast({
          title: 'Connection Failed',
          description: response.data?.message || response.error || 'Failed to test connection',
          variant: 'destructive'
        });
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to test connection',
        variant: 'destructive'
      });
    } finally {
      setTesting(false);
    }
  };

  const handleRefreshBalance = async () => {
    try {
      setRefreshing(true);
      const response = await apiClient.refreshAccountIntegration(accountId);
      
      if (response.data && response.data.success) {
        toast({
          title: 'Success',
          description: `Balance updated: ${new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: response.data.currency
          }).format(response.data.balance)}`
        });
        if (onIntegrationUpdated) onIntegrationUpdated();
      } else {
        toast({
          title: 'Refresh Failed',
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
      setRefreshing(false);
    }
  };

  const initiateOAuthFlow = (accountId: number) => {
    // Generate PKCE code verifier and challenge
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

    const startOAuth = async () => {
      const codeVerifier = generateCodeVerifier();
      const codeChallenge = await generateCodeChallenge(codeVerifier);

      // Store code verifier and account ID in session storage
      sessionStorage.setItem('schwab_code_verifier', codeVerifier);
      sessionStorage.setItem('schwab_account_id', accountId.toString());

      // Build OAuth URL
      const redirectUri = `${window.location.origin}/schwab/callback`;
      const authUrl = new URL('https://api.schwabapi.com/v1/oauth/authorize');
      authUrl.searchParams.append('client_id', schwabForm.appKey);
      authUrl.searchParams.append('redirect_uri', redirectUri);
      authUrl.searchParams.append('response_type', 'code');
      authUrl.searchParams.append('code_challenge', codeChallenge);
      authUrl.searchParams.append('code_challenge_method', 'S256');

      // Redirect to Schwab OAuth
      window.location.href = authUrl.toString();
    };

    startOAuth();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Integration Settings: {accountName}</DialogTitle>
          <DialogDescription>
            Configure broker integration for automatic balance updates
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4">
            {/* Current Status */}
            {currentType && (
              <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">Current Integration:</span>
                  <Badge variant="default">{currentType}</Badge>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleTestConnection}
                    disabled={testing}
                  >
                    {testing ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <TestTube className="h-4 w-4" />
                    )}
                    <span className="ml-2">Test</span>
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleRefreshBalance}
                    disabled={refreshing}
                  >
                    {refreshing ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4" />
                    )}
                    <span className="ml-2">Refresh</span>
                  </Button>
                </div>
              </div>
            )}

            {/* Integration Type Tabs */}
            <Tabs value={selectedTab} onValueChange={setSelectedTab}>
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="none">No Integration</TabsTrigger>
                <TabsTrigger value="ib">Interactive Brokers</TabsTrigger>
                <TabsTrigger value="schwab">Charles Schwab</TabsTrigger>
              </TabsList>

              <TabsContent value="none" className="space-y-4">
                <Alert>
                  <AlertDescription>
                    This account will not be automatically synced with any broker.
                    You can manually update the balance in the account details.
                  </AlertDescription>
                </Alert>
              </TabsContent>

              <TabsContent value="ib" className="space-y-4">
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label htmlFor="ib-host">Host</Label>
                    <Input
                      id="ib-host"
                      value={ibForm.host}
                      onChange={(e) => setIbForm({ ...ibForm, host: e.target.value })}
                      placeholder="localhost"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label htmlFor="ib-port">Port</Label>
                      <Input
                        id="ib-port"
                        type="number"
                        value={ibForm.port}
                        onChange={(e) => setIbForm({ ...ibForm, port: e.target.value })}
                        placeholder="4001"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="ib-client-id">Client ID</Label>
                      <Input
                        id="ib-client-id"
                        type="number"
                        value={ibForm.clientId}
                        onChange={(e) => setIbForm({ ...ibForm, clientId: e.target.value })}
                        placeholder="1"
                      />
                    </div>
                  </div>

                  <Alert>
                    <AlertDescription className="text-xs">
                      <strong>Note:</strong> IB Gateway or TWS must be running.
                      Port 4001 for IB Gateway, 7497 for TWS.
                    </AlertDescription>
                  </Alert>
                </div>
              </TabsContent>

              <TabsContent value="schwab" className="space-y-4">
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label htmlFor="schwab-key">App Key</Label>
                    <Input
                      id="schwab-key"
                      value={schwabForm.appKey}
                      onChange={(e) => setSchwabForm({ ...schwabForm, appKey: e.target.value })}
                      placeholder="Enter your Schwab App Key"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="schwab-secret">App Secret</Label>
                    <Input
                      id="schwab-secret"
                      type="password"
                      value={schwabForm.appSecret}
                      onChange={(e) => setSchwabForm({ ...schwabForm, appSecret: e.target.value })}
                      placeholder="Enter your Schwab App Secret"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="schwab-hash">Account Hash (Optional)</Label>
                    <Input
                      id="schwab-hash"
                      value={schwabForm.accountHash}
                      onChange={(e) => setSchwabForm({ ...schwabForm, accountHash: e.target.value })}
                      placeholder="Schwab account hash"
                    />
                  </div>

                  <Alert>
                    <AlertDescription className="text-xs">
                      <strong>Note:</strong> Get your App Key and Secret from the{' '}
                      <a
                        href="https://developer.schwab.com/"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline"
                      >
                        Schwab Developer Portal
                      </a>
                      . OAuth authentication will be required after saving.
                    </AlertDescription>
                  </Alert>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSaveIntegration} disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              'Save Integration'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
