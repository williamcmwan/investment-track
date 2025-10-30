import React, { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  PlusCircle, 
  Edit, 
  Trash2,
  Building,
  TrendingUp,
  TrendingDown,
  DollarSign,
  ArrowUpRight,
  ArrowDownRight
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiClient } from "@/services/api";

interface Asset {
  id: number;
  assetType: string;
  asset: string;
  currency: string;
  originalValue: number;
  marketValue: number;
  remarks: string;
  createdAt: string;
  updatedAt: string;
}

interface OtherAssetsViewProps {
  baseCurrency: string;
  exchangeRates: Record<string, number>;
  convertToBaseCurrency: (amount: number, fromCurrency: string) => number;
}

const OtherAssetsView = ({ baseCurrency, exchangeRates, convertToBaseCurrency }: OtherAssetsViewProps) => {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  // Form states
  const [newAsset, setNewAsset] = useState({
    assetType: "",
    asset: "",
    currency: "",
    originalValue: 0,
    marketValue: 0,
    remarks: ""
  });

  const [editAsset, setEditAsset] = useState({
    assetType: "",
    asset: "",
    currency: "",
    originalValue: 0,
    marketValue: 0,
    remarks: ""
  });

  // Asset type options
  const assetTypes = [
    "Real Estate",
    "Precious Metals",
    "Collectibles",
    "Art & Antiques",
    "Vehicles",
    "Business Assets",
    "Intellectual Property",
    "Other"
  ];

  // Currency options
  const currencies = [
    { code: "USD", name: "🇺🇸 USD - US Dollar" },
    { code: "EUR", name: "🇪🇺 EUR - Euro" },
    { code: "HKD", name: "🇭🇰 HKD - Hong Kong Dollar" },
    { code: "GBP", name: "🇬🇧 GBP - British Pound" },
    { code: "CAD", name: "🇨🇦 CAD - Canadian Dollar" },
    { code: "SGD", name: "🇸🇬 SGD - Singapore Dollar" },
    { code: "JPY", name: "🇯🇵 JPY - Japanese Yen" }
  ];

  const formatCurrency = (amount: number, currency = "HKD") => {
    return new Intl.NumberFormat("en-HK", {
      style: "currency",
      currency: currency,
    }).format(amount);
  };

  const formatPercent = (percent: number) => {
    return `${percent > 0 ? "+" : ""}${percent.toFixed(2)}%`;
  };

  const calculateProfitLoss = (originalValue: number, marketValue: number) => {
    return marketValue - originalValue;
  };

  const calculateProfitLossPercent = (originalValue: number, marketValue: number) => {
    if (originalValue === 0) return 0;
    return ((marketValue - originalValue) / originalValue) * 100;
  };

  // Mock data for demonstration - replace with actual API calls
  useEffect(() => {
    // Load assets from API
    loadAssets();
  }, []);

  const loadAssets = async () => {
    setIsLoading(true);
    try {
      const response = await apiClient.getOtherAssets();
      if (response.data) {
        setAssets(response.data);
      } else {
        toast({
          title: "Error",
          description: response.error || "Failed to load assets",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load assets",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateAsset = async () => {
    try {
      const response = await apiClient.createOtherAsset(newAsset);
      if (response.data) {
        toast({
          title: "Success",
          description: "Asset created successfully",
        });
        
        handleDialogClose();
        loadAssets(); // Reload assets
      } else {
        toast({
          title: "Error",
          description: response.error || "Failed to create asset",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to create asset",
        variant: "destructive",
      });
    }
  };

  const handleUpdateAsset = async (assetId: number) => {
    try {
      const response = await apiClient.updateOtherAsset(assetId, editAsset);
      if (response.data) {
        toast({
          title: "Success",
          description: "Asset updated successfully",
        });
        
        handleEditDialogClose();
        loadAssets(); // Reload assets
      } else {
        toast({
          title: "Error",
          description: response.error || "Failed to update asset",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update asset",
        variant: "destructive",
      });
    }
  };

  const handleDeleteAsset = async (assetId: number) => {
    if (!confirm('Are you sure you want to delete this asset?')) {
      return;
    }

    try {
      const response = await apiClient.deleteOtherAsset(assetId);
      if (response.data) {
        toast({
          title: "Success",
          description: "Asset deleted successfully",
        });
        
        loadAssets(); // Reload assets
      } else {
        toast({
          title: "Error",
          description: response.error || "Failed to delete asset",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete asset",
        variant: "destructive",
      });
    }
  };

  const handleDialogClose = () => {
    setIsAddDialogOpen(false);
    setNewAsset({
      assetType: "",
      asset: "",
      currency: "",
      originalValue: 0,
      marketValue: 0,
      remarks: ""
    });
  };

  const handleEditDialogClose = () => {
    setEditingAsset(null);
    setEditAsset({
      assetType: "",
      asset: "",
      currency: "",
      originalValue: 0,
      marketValue: 0,
      remarks: ""
    });
  };

  const openEditDialog = (asset: Asset) => {
    setEditingAsset(asset);
    setEditAsset({
      assetType: asset.assetType,
      asset: asset.asset,
      currency: asset.currency,
      originalValue: asset.originalValue,
      marketValue: asset.marketValue,
      remarks: asset.remarks
    });
  };

  // Calculate summary data
  const totalOriginalValue = assets.reduce((sum, asset) => 
    sum + convertToBaseCurrency(asset.originalValue, asset.currency), 0
  );
  
  const totalMarketValue = assets.reduce((sum, asset) => 
    sum + convertToBaseCurrency(asset.marketValue, asset.currency), 0
  );
  
  const totalProfitLoss = totalMarketValue - totalOriginalValue;
  const totalProfitLossPercent = totalOriginalValue > 0 ? (totalProfitLoss / totalOriginalValue) * 100 : 0;

  return (
    <div className="space-y-6 w-full max-w-full overflow-hidden">
      {/* Header */}
      <div className="flex justify-start">
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-gradient-primary hover:opacity-90 transition-smooth">
              <PlusCircle className="h-4 w-4 mr-2" />
              Add Asset
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-card border-border max-w-2xl">
            <DialogHeader>
              <DialogTitle className="text-foreground">Add New Asset</DialogTitle>
              <DialogDescription>
                Add a new asset to track its value and performance.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="asset-type">Asset Type</Label>
                  <Select value={newAsset.assetType} onValueChange={(value) => setNewAsset({...newAsset, assetType: value})}>
                    <SelectTrigger className="bg-background/50">
                      <SelectValue placeholder="Select asset type" />
                    </SelectTrigger>
                    <SelectContent>
                      {assetTypes.map((type) => (
                        <SelectItem key={type} value={type}>{type}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="currency">Currency</Label>
                  <Select value={newAsset.currency} onValueChange={(value) => setNewAsset({...newAsset, currency: value})}>
                    <SelectTrigger className="bg-background/50">
                      <SelectValue placeholder="Select currency" />
                    </SelectTrigger>
                    <SelectContent>
                      {currencies.map((currency) => (
                        <SelectItem key={currency.code} value={currency.code}>{currency.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="asset-name">Asset</Label>
                <Input
                  id="asset-name"
                  placeholder="e.g., Apartment in Central, Gold Bars, Vintage Car"
                  className="bg-background/50"
                  value={newAsset.asset}
                  onChange={(e) => setNewAsset({...newAsset, asset: e.target.value})}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="original-value">Original Value</Label>
                  <Input
                    id="original-value"
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    className="bg-background/50"
                    value={newAsset.originalValue || ""}
                    onChange={(e) => setNewAsset({...newAsset, originalValue: parseFloat(e.target.value) || 0})}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="market-value">Market Value</Label>
                  <Input
                    id="market-value"
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    className="bg-background/50"
                    value={newAsset.marketValue || ""}
                    onChange={(e) => setNewAsset({...newAsset, marketValue: parseFloat(e.target.value) || 0})}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="remarks">Remarks</Label>
                <Textarea
                  id="remarks"
                  placeholder="Additional notes about this asset..."
                  className="bg-background/50"
                  value={newAsset.remarks}
                  onChange={(e) => setNewAsset({...newAsset, remarks: e.target.value})}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={handleDialogClose}>
                Cancel
              </Button>
              <Button className="bg-gradient-primary hover:opacity-90" onClick={handleCreateAsset}>
                Add Asset
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        <Card className="bg-gradient-card border-border shadow-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Assets</CardTitle>
            <Building className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{assets.length}</div>
            <p className="text-xs text-muted-foreground">Assets tracked</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-card border-border shadow-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Original Value</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              {formatCurrency(totalOriginalValue, baseCurrency)}
            </div>
            <p className="text-xs text-muted-foreground">Total invested</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-card border-border shadow-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Market Value</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              {formatCurrency(totalMarketValue, baseCurrency)}
            </div>
            <p className="text-xs text-muted-foreground">Current worth</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-card border-border shadow-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total P&L</CardTitle>
            {totalProfitLoss > 0 ? (
              <TrendingUp className="h-4 w-4 text-profit" />
            ) : (
              <TrendingDown className="h-4 w-4 text-loss" />
            )}
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${totalProfitLoss > 0 ? 'text-profit' : 'text-loss'}`}>
              {formatCurrency(totalProfitLoss, baseCurrency)}
            </div>
            <p className={`text-xs ${totalProfitLoss > 0 ? 'text-profit' : 'text-loss'}`}>
              {formatPercent(totalProfitLossPercent)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Assets List */}
      <div className="grid gap-6 w-full max-w-full">
        {assets.map((asset) => {
          const profitLoss = calculateProfitLoss(asset.originalValue, asset.marketValue);
          const profitLossPercent = calculateProfitLossPercent(asset.originalValue, asset.marketValue);
          
          return (
            <Card key={asset.id} className="bg-gradient-card border-border shadow-card w-full overflow-hidden">
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <div className="p-2 bg-primary/20 rounded-lg flex-shrink-0">
                      <Building className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex flex-col min-w-0 flex-1">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:gap-2">
                        <CardTitle className="text-foreground truncate">{asset.asset}</CardTitle>
                        <Badge variant="outline" className="w-fit">
                          {asset.assetType}
                        </Badge>
                      </div>
                      <CardDescription className="truncate">
                        {asset.currency} • Updated {new Date(asset.updatedAt).toLocaleDateString()}
                      </CardDescription>
                    </div>
                  </div>
                  <div className="flex-shrink-0 flex items-center gap-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="border-blue-500 text-blue-500 hover:bg-blue-500/10"
                      onClick={() => openEditDialog(asset)}
                    >
                      <Edit className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-red-500 text-red-500 hover:bg-red-500/10"
                      onClick={() => handleDeleteAsset(asset.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">Original Value</p>
                    <p className="text-lg font-semibold text-foreground">
                      {formatCurrency(asset.originalValue, asset.currency)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      ≈ {formatCurrency(convertToBaseCurrency(asset.originalValue, asset.currency), baseCurrency)}
                    </p>
                  </div>
                  
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">Market Value</p>
                    <p className="text-lg font-semibold text-foreground">
                      {formatCurrency(asset.marketValue, asset.currency)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      ≈ {formatCurrency(convertToBaseCurrency(asset.marketValue, asset.currency), baseCurrency)}
                    </p>
                  </div>
                  
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">Profit/Loss</p>
                    <div className="flex items-center gap-2">
                      <p className={`text-lg font-semibold ${profitLoss > 0 ? 'text-profit' : 'text-loss'}`}>
                        {formatCurrency(profitLoss, asset.currency)}
                      </p>
                      <Badge variant={profitLoss > 0 ? "default" : "destructive"} className="text-xs">
                        {profitLoss > 0 ? (
                          <ArrowUpRight className="h-3 w-3 mr-1" />
                        ) : (
                          <ArrowDownRight className="h-3 w-3 mr-1" />
                        )}
                        {formatPercent(profitLossPercent)}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      ≈ {formatCurrency(convertToBaseCurrency(profitLoss, asset.currency), baseCurrency)}
                    </p>
                  </div>
                  
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">Remarks</p>
                    <p className="text-sm text-foreground break-words">
                      {asset.remarks || "No remarks"}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
        
        {assets.length === 0 && !isLoading && (
          <Card className="bg-gradient-card border-border shadow-card">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Building className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">No Assets Yet</h3>
              <p className="text-muted-foreground text-center mb-4">
                Start tracking your real estate, collectibles, and other investments.
              </p>
              <Button 
                className="bg-gradient-primary hover:opacity-90"
                onClick={() => setIsAddDialogOpen(true)}
              >
                <PlusCircle className="h-4 w-4 mr-2" />
                Add Your First Asset
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Edit Asset Dialog */}
      <Dialog open={editingAsset !== null} onOpenChange={handleEditDialogClose}>
        <DialogContent className="bg-card border-border max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-foreground">Edit Asset</DialogTitle>
            <DialogDescription>
              Update the asset information and values.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-asset-type">Asset Type</Label>
                <Select value={editAsset.assetType} onValueChange={(value) => setEditAsset({...editAsset, assetType: value})}>
                  <SelectTrigger className="bg-background/50">
                    <SelectValue placeholder="Select asset type" />
                  </SelectTrigger>
                  <SelectContent>
                    {assetTypes.map((type) => (
                      <SelectItem key={type} value={type}>{type}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-currency">Currency</Label>
                <Select value={editAsset.currency} onValueChange={(value) => setEditAsset({...editAsset, currency: value})}>
                  <SelectTrigger className="bg-background/50">
                    <SelectValue placeholder="Select currency" />
                  </SelectTrigger>
                  <SelectContent>
                    {currencies.map((currency) => (
                      <SelectItem key={currency.code} value={currency.code}>{currency.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-asset-name">Asset</Label>
              <Input
                id="edit-asset-name"
                placeholder="e.g., Apartment in Central, Gold Bars, Vintage Car"
                className="bg-background/50"
                value={editAsset.asset}
                onChange={(e) => setEditAsset({...editAsset, asset: e.target.value})}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-original-value">Original Value</Label>
                <Input
                  id="edit-original-value"
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  className="bg-background/50"
                  value={editAsset.originalValue || ""}
                  onChange={(e) => setEditAsset({...editAsset, originalValue: parseFloat(e.target.value) || 0})}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-market-value">Market Value</Label>
                <Input
                  id="edit-market-value"
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  className="bg-background/50"
                  value={editAsset.marketValue || ""}
                  onChange={(e) => setEditAsset({...editAsset, marketValue: parseFloat(e.target.value) || 0})}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-remarks">Remarks</Label>
              <Textarea
                id="edit-remarks"
                placeholder="Additional notes about this asset..."
                className="bg-background/50"
                value={editAsset.remarks}
                onChange={(e) => setEditAsset({...editAsset, remarks: e.target.value})}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleEditDialogClose}>
              Cancel
            </Button>
            <Button 
              className="bg-gradient-primary hover:opacity-90" 
              onClick={() => editingAsset && handleUpdateAsset(editingAsset.id)}
            >
              Update Asset
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default OtherAssetsView;