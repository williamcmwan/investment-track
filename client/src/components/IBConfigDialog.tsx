import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiClient } from "@/services/api";

interface IBConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSettingsSaved: () => void;
}

interface Account {
  id: number;
  name: string;
  currentBalance: number;
  currency: string;
}

interface IBSettings {
  host: string;
  port: number;
  client_id: number;
  target_account_id?: number;
}

const IBConfigDialog = ({ open, onOpenChange, onSettingsSaved }: IBConfigDialogProps) => {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [settings, setSettings] = useState<IBSettings>({
    host: 'localhost',
    port: 7497,
    client_id: 1,
    target_account_id: undefined
  });

  // Load accounts and current settings when dialog opens
  useEffect(() => {
    if (open) {
      loadData();
    }
  }, [open]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      // Load accounts and current IB settings in parallel
      const [accountsResponse, settingsResponse] = await Promise.all([
        apiClient.getAccounts(),
        apiClient.getIBSettings()
      ]);

      if (accountsResponse.error) {
        toast({
          title: "Error",
          description: `Failed to load accounts: ${accountsResponse.error}`,
          variant: "destructive",
        });
      } else if (accountsResponse.data) {
        setAccounts(accountsResponse.data);
      }

      if (settingsResponse.error) {
        toast({
          title: "Error",
          description: `Failed to load IB settings: ${settingsResponse.error}`,
          variant: "destructive",
        });
      } else if (settingsResponse.data) {
        setSettings({
          host: settingsResponse.data.host,
          port: settingsResponse.data.port,
          client_id: settingsResponse.data.client_id,
          target_account_id: settingsResponse.data.target_account_id
        });
      }
    } catch (error) {
      console.error('Failed to load data:', error);
      toast({
        title: "Error",
        description: "Failed to load configuration data",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    // Validate required fields
    if (!settings.host.trim()) {
      toast({
        title: "Validation Error",
        description: "Host is required",
        variant: "destructive",
      });
      return;
    }

    if (!settings.port || settings.port <= 0) {
      toast({
        title: "Validation Error",
        description: "Port must be a positive number",
        variant: "destructive",
      });
      return;
    }

    if (!settings.client_id || settings.client_id <= 0) {
      toast({
        title: "Validation Error",
        description: "Client ID must be a positive number",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);
    try {
      const response = await apiClient.saveIBSettings(settings);
      
      if (response.data?.success) {
        toast({
          title: "Success",
          description: "IB settings saved successfully",
        });
        onSettingsSaved();
        onOpenChange(false);
      } else {
        throw new Error(response.error || 'Failed to save settings');
      }
    } catch (error) {
      console.error('Failed to save IB settings:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to save IB settings",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleInputChange = (field: keyof IBSettings, value: string | number) => {
    setSettings(prev => ({
      ...prev,
      [field]: value
    }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Configure Interactive Brokers Connection</DialogTitle>
          <DialogDescription>
            Set up your connection parameters for Interactive Brokers Gateway/TWS and select which account to update.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="text-sm text-muted-foreground">Loading configuration...</div>
          </div>
        ) : (
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="host" className="text-right">
                Host
              </Label>
              <Input
                id="host"
                value={settings.host}
                onChange={(e) => handleInputChange('host', e.target.value)}
                className="col-span-3"
                placeholder="localhost"
              />
            </div>

            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="port" className="text-right">
                Port
              </Label>
              <Input
                id="port"
                type="number"
                value={settings.port}
                onChange={(e) => handleInputChange('port', parseInt(e.target.value) || 0)}
                className="col-span-3"
                placeholder="7497"
              />
            </div>

            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="client_id" className="text-right">
                Client ID
              </Label>
              <Input
                id="client_id"
                type="number"
                value={settings.client_id}
                onChange={(e) => handleInputChange('client_id', parseInt(e.target.value) || 0)}
                className="col-span-3"
                placeholder="1"
              />
            </div>

            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="target_account" className="text-right">
                Target Account
              </Label>
              <Select
                value={settings.target_account_id?.toString() || "none"}
                onValueChange={(value) => handleInputChange('target_account_id', value === "none" ? undefined : parseInt(value))}
              >
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="Select account to update" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No account selected</SelectItem>
                  {accounts.length === 0 ? (
                    <SelectItem value="no-accounts" disabled>
                      No investment accounts found
                    </SelectItem>
                  ) : (
                    accounts.map((account) => (
                      <SelectItem key={account.id} value={account.id.toString()}>
                        {account.name} ({account.currency})
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="text-xs text-muted-foreground mt-2">
              <p><strong>Host:</strong> Usually 'localhost' if running IB Gateway/TWS on the same machine</p>
              <p><strong>Port:</strong> 7497 for paper trading, 7496 for live trading (default IB Gateway ports)</p>
              <p><strong>Client ID:</strong> Unique identifier for this connection (1-32)</p>
              <p><strong>Target Account:</strong> Which investment account to update with portfolio data</p>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isLoading || isSaving}>
            {isSaving ? 'Saving...' : 'Save Settings'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default IBConfigDialog;