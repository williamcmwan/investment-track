import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiClient } from "@/services/api";
import { 
  PlusCircle, 
  Edit, 
  TrendingUp, 
  TrendingDown,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
  ArrowLeftRight,
  Settings,
  Trash2,
  Loader2
} from "lucide-react";

interface CurrencyPair {
  id: number;
  pair: string;
  currentRate: number;
  avgCost: number;
  amount: number;
  createdAt: string;
  updatedAt: string;
}

interface CurrencyViewProps {
  baseCurrency: string;
  onBaseCurrencyChange: (currency: string) => void;
}

const CurrencyView = ({ baseCurrency, onBaseCurrencyChange }: CurrencyViewProps) => {
  const [currencies, setCurrencies] = useState<CurrencyPair[]>([]);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [showBaseCurrencySettings, setShowBaseCurrencySettings] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [popularPairs, setPopularPairs] = useState<string[]>([]);
  const { toast } = useToast();

  // Form state for adding new currency pair
  const [newPair, setNewPair] = useState({
    pair: '',
    avgCost: '',
    amount: ''
  });

  // Load currencies and popular pairs on component mount
  useEffect(() => {
    loadCurrencies();
    loadPopularPairs();
  }, []);

  // Reload popular pairs when base currency changes
  useEffect(() => {
    loadPopularPairs();
  }, [baseCurrency]);

  // Reload currencies when base currency changes to get updated rates
  useEffect(() => {
    loadCurrencies();
  }, [baseCurrency]);

  const loadCurrencies = async () => {
    try {
      setIsLoading(true);
      const response = await apiClient.getCurrencyPairs();
      if (response.data) {
        setCurrencies(response.data);
      } else {
        console.error('Failed to load currencies:', response.error);
        toast({
          title: "Error",
          description: "Failed to load currency pairs",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error loading currencies:', error);
      toast({
        title: "Error",
        description: "Failed to load currency pairs",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const loadPopularPairs = async () => {
    try {
      const response = await apiClient.getPopularPairs(baseCurrency);
      if (response.data) {
        setPopularPairs(response.data);
      }
    } catch (error) {
      console.error('Error loading popular pairs:', error);
    }
  };

  const handleAddCurrencyPair = async () => {
    if (!newPair.pair || !newPair.avgCost || !newPair.amount) {
      toast({
        title: "Invalid Input",
        description: "Please fill in all fields",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsLoading(true);
      const response = await apiClient.createCurrencyPair({
        pair: newPair.pair,
        avgCost: parseFloat(newPair.avgCost),
        amount: parseFloat(newPair.amount)
      });

      if (response.data) {
        toast({
          title: "Success",
          description: "Currency pair added successfully",
        });
        setNewPair({ pair: '', avgCost: '', amount: '' });
        setIsAddDialogOpen(false);
        loadCurrencies(); // Reload the list
      } else {
        toast({
          title: "Error",
          description: response.error || "Failed to add currency pair",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error adding currency pair:', error);
      toast({
        title: "Error",
        description: "Failed to add currency pair",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateRates = async () => {
    try {
      setIsRefreshing(true);
      const response = await apiClient.updateExchangeRates();
      if (response.data) {
        setCurrencies(response.data.pairs);
        toast({
          title: "Success",
          description: "Exchange rates updated successfully",
        });
      } else {
        toast({
          title: "Error",
          description: response.error || "Failed to update exchange rates",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error updating rates:', error);
      toast({
        title: "Error",
        description: "Failed to update exchange rates",
        variant: "destructive",
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleDeleteCurrencyPair = async (id: number) => {
    try {
      const response = await apiClient.deleteCurrencyPair(id);
      if (response.data) {
        toast({
          title: "Success",
          description: "Currency pair deleted successfully",
        });
        loadCurrencies(); // Reload the list
      } else {
        toast({
          title: "Error",
          description: response.error || "Failed to delete currency pair",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error deleting currency pair:', error);
      toast({
        title: "Error",
        description: "Failed to delete currency pair",
        variant: "destructive",
      });
    }
  };

  const formatCurrency = (amount: number, currency = baseCurrency) => {
    return new Intl.NumberFormat("en-HK", {
      style: "currency",
      currency: currency,
    }).format(amount);
  };

  const formatRate = (rate: number) => {
    return rate.toFixed(4);
  };

  const getCurrencyFlags = (pair: string) => {
    const flagMap: { [key: string]: string } = {
      USD: "🇺🇸",
      EUR: "🇪🇺",
      GBP: "🇬🇧",
      CAD: "🇨🇦",
      SGD: "🇸🇬",
      JPY: "🇯🇵",
      HKD: "🇭🇰",
      AUD: "🇦🇺"
    };
    
    const [from, to] = pair.split("/");
    return `${flagMap[from]} → ${flagMap[to]}`;
  };

  const calculateProfitLoss = (currency: CurrencyPair) => {
    const [fromCurrency, toCurrency] = currency.pair.split('/');
    
    // Calculate current value and cost basis in the original pair's target currency
    const currentValue = currency.amount * currency.currentRate;
    const costBasis = currency.amount * currency.avgCost;
    const profitLossInOriginalCurrency = currentValue - costBasis;
    
    // Convert profit/loss to base currency
    if (toCurrency === baseCurrency) {
      // Already in base currency
      return profitLossInOriginalCurrency;
    } else if (fromCurrency === baseCurrency) {
      // The profit/loss is in the target currency, need to convert to base currency
      // Use the inverse of the current rate to convert from target currency to base currency
      return profitLossInOriginalCurrency / currency.currentRate;
    } else {
      // For cross-currency pairs, we need to convert to base currency
      // This is a simplified approach - in reality we'd need the rate from toCurrency to baseCurrency
      return profitLossInOriginalCurrency;
    }
  };

  const calculateCurrentTotalInBaseCurrency = (currency: CurrencyPair) => {
    const [fromCurrency, toCurrency] = currency.pair.split('/');
    
    if (toCurrency === baseCurrency) {
      // Already in base currency
      return currency.amount * currency.currentRate;
    } else if (fromCurrency === baseCurrency) {
      // Convert from base currency to target currency
      return currency.amount;
    } else {
      // For cross-currency pairs, we need to convert to base currency
      // This is a simplified approach - in reality we'd need the rate from toCurrency to baseCurrency
      return currency.amount * currency.currentRate;
    }
  };

  const totalProfitLoss = currencies.reduce((sum, curr) => sum + calculateProfitLoss(curr), 0);
  const totalAmountInBaseCurrency = currencies.reduce((sum, curr) => sum + calculateCurrentTotalInBaseCurrency(curr), 0);

  const AddCurrencyDialog = () => (
    <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
      <DialogTrigger asChild>
        <Button className="bg-gradient-primary hover:opacity-90 transition-smooth">
          <PlusCircle className="h-4 w-4 mr-2" />
          Add Currency Pair
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-foreground">Add Currency Exchange</DialogTitle>
          <DialogDescription>
            Track a new currency pair and your average exchange cost.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="currency-pair">Currency Pair</Label>
            <Select value={newPair.pair} onValueChange={(value) => setNewPair({...newPair, pair: value})}>
              <SelectTrigger className="bg-background/50">
                <SelectValue placeholder="Select currency pair" />
              </SelectTrigger>
              <SelectContent>
                {popularPairs.map((pair) => (
                  <SelectItem key={pair} value={pair}>
                    {getCurrencyFlags(pair)} {pair}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="avg-cost">Average Exchange Cost</Label>
            <Input
              id="avg-cost"
              type="number"
              step="0.0001"
              placeholder="7.8500"
              value={newPair.avgCost}
              onChange={(e) => setNewPair({...newPair, avgCost: e.target.value})}
              className="bg-background/50"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="amount">Amount Exchanged</Label>
            <Input
              id="amount"
              type="number"
              placeholder="100000"
              value={newPair.amount}
              onChange={(e) => setNewPair({...newPair, amount: e.target.value})}
              className="bg-background/50"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
            Cancel
          </Button>
          <Button 
            className="bg-gradient-primary hover:opacity-90"
            onClick={handleAddCurrencyPair}
            disabled={isLoading}
          >
            {isLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
            Add Currency Pair
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  if (isLoading && currencies.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Base Currency Settings - Collapsible */}
      {showBaseCurrencySettings && (
        <Card className="bg-gradient-card border-border shadow-card">
          <CardHeader>
            <CardTitle className="text-foreground">Base Currency Settings</CardTitle>
            <CardDescription>
              Set your base currency for portfolio calculations and reporting
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <div className="space-y-2 flex-1">
                <Label htmlFor="base-currency">Base Currency</Label>
                <Select value={baseCurrency} onValueChange={onBaseCurrencyChange}>
                  <SelectTrigger className="bg-background/50 w-full sm:w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="HKD">🇭🇰 HKD - Hong Kong Dollar</SelectItem>
                    <SelectItem value="USD">🇺🇸 USD - US Dollar</SelectItem>
                    <SelectItem value="EUR">🇪🇺 EUR - Euro</SelectItem>
                    <SelectItem value="GBP">🇬🇧 GBP - British Pound</SelectItem>
                    <SelectItem value="CAD">🇨🇦 CAD - Canadian Dollar</SelectItem>
                    <SelectItem value="SGD">🇸🇬 SGD - Singapore Dollar</SelectItem>
                    <SelectItem value="JPY">🇯🇵 JPY - Japanese Yen</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <p className="text-sm text-muted-foreground">
                All portfolio totals and P&L will be displayed in {baseCurrency}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
        <Button 
          variant="outline" 
          className="border-primary text-primary hover:bg-primary/10"
          onClick={handleUpdateRates}
          disabled={isRefreshing}
        >
          {isRefreshing ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4 mr-2" />
          )}
          Refresh Rates
        </Button>
        <Button 
          variant="outline" 
          className="border-primary text-primary hover:bg-primary/10"
          onClick={() => setShowBaseCurrencySettings(!showBaseCurrencySettings)}
        >
          <Settings className="h-4 w-4 mr-2" />
          Base Currency
        </Button>
        <AddCurrencyDialog />
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
        <Card className="bg-gradient-card border-border shadow-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Currency P&L</CardTitle>
            {totalProfitLoss > 0 ? (
              <TrendingUp className="h-4 w-4 text-profit" />
            ) : (
              <TrendingDown className="h-4 w-4 text-loss" />
            )}
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${totalProfitLoss > 0 ? 'text-profit' : 'text-loss'}`}>
              {formatCurrency(totalProfitLoss)}
            </div>
            <p className="text-xs text-muted-foreground">From exchange rate fluctuations</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-card border-border shadow-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Currency Pairs</CardTitle>
            <ArrowLeftRight className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{currencies.length}</div>
            <p className="text-xs text-muted-foreground">Active currency pairs</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-card border-border shadow-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Amount ({baseCurrency})</CardTitle>
            <ArrowLeftRight className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              {formatCurrency(totalAmountInBaseCurrency)}
            </div>
            <p className="text-xs text-muted-foreground">Total amount in {baseCurrency}</p>
          </CardContent>
        </Card>
      </div>


      {/* Currency Pairs List */}
      <div className="grid gap-6">
        {currencies.length === 0 ? (
          <Card className="bg-gradient-card border-border shadow-card">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <ArrowLeftRight className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">No Currency Pairs</h3>
              <p className="text-muted-foreground text-center mb-4">
                Start tracking your currency exchanges by adding your first currency pair.
              </p>
              <AddCurrencyDialog />
            </CardContent>
          </Card>
        ) : (
          currencies
            .map((currency) => ({
              ...currency,
              profitLoss: calculateProfitLoss(currency)
            }))
            .sort((a, b) => b.profitLoss - a.profitLoss) // Sort by P&L descending (highest first)
            .map((currency) => {
              const profitLoss = currency.profitLoss;
              return (
              <Card key={currency.id} className="bg-gradient-card border-border shadow-card">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-primary/20 rounded-lg">
                        <ArrowLeftRight className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <CardTitle className="text-foreground flex items-center gap-2">
                          {getCurrencyFlags(currency.pair)} {currency.pair}
                        </CardTitle>
                        <CardDescription>Exchange rate tracking</CardDescription>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={profitLoss > 0 ? "default" : "destructive"}>
                        {profitLoss > 0 ? (
                          <ArrowUpRight className="h-3 w-3 mr-1" />
                        ) : (
                          <ArrowDownRight className="h-3 w-3 mr-1" />
                        )}
                        {formatCurrency(profitLoss)}
                      </Badge>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDeleteCurrencyPair(currency.id)}
                        className="text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                    <div className="space-y-2">
                      <p className="text-sm text-muted-foreground">Current Rate</p>
                      <p className="text-lg font-semibold text-foreground">
                        {formatRate(currency.currentRate)}
                      </p>
                      <div className="flex items-center gap-1">
                        {currency.currentRate > currency.avgCost ? (
                          <ArrowUpRight className="h-3 w-3 text-profit" />
                        ) : (
                          <ArrowDownRight className="h-3 w-3 text-loss" />
                        )}
                        <span className={`text-xs ${currency.currentRate > currency.avgCost ? 'text-profit' : 'text-loss'}`}>
                          {((currency.currentRate - currency.avgCost) / currency.avgCost * 100).toFixed(2)}%
                        </span>
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <p className="text-sm text-muted-foreground">Your Avg Cost</p>
                      <p className="text-lg font-semibold text-foreground">
                        {formatRate(currency.avgCost)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Cost basis for calculations
                      </p>
                    </div>
                    
                    <div className="space-y-2">
                      <p className="text-sm text-muted-foreground">Amount ({currency.pair.split('/')[0]})</p>
                      <p className="text-lg font-semibold text-foreground">
                        {formatCurrency(currency.amount, currency.pair.split('/')[0])}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Total foreign currency held
                      </p>
                    </div>
                    
                    <div className="space-y-2">
                      <p className="text-sm text-muted-foreground">Current Total ({baseCurrency})</p>
                      <p className="text-lg font-semibold text-foreground">
                        {formatCurrency(calculateCurrentTotalInBaseCurrency(currency))}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Current value in {baseCurrency}
                      </p>
                    </div>
                    
                    <div className="space-y-2">
                      <p className="text-sm text-muted-foreground">Unrealized P&L</p>
                      <p className={`text-lg font-semibold ${profitLoss > 0 ? 'text-profit' : 'text-loss'}`}>
                        {formatCurrency(profitLoss)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {((profitLoss / (currency.amount * currency.avgCost)) * 100).toFixed(2)}% of exposure
                      </p>
                    </div>
                  </div>
                  
                  {/* Rate Comparison Bar */}
                  <div className="mt-4 space-y-2">
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Your Cost: {formatRate(currency.avgCost)}</span>
                      <span>Current: {formatRate(currency.currentRate)}</span>
                    </div>
                    <div className="h-2 bg-background/50 rounded-full overflow-hidden">
                      <div 
                        className={`h-full transition-all duration-300 ${
                          currency.currentRate > currency.avgCost ? 'bg-profit' : 'bg-loss'
                        }`}
                        style={{ 
                          width: `${Math.abs((currency.currentRate - currency.avgCost) / currency.avgCost) * 100 * 10}%`,
                          maxWidth: '100%'
                        }}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
};

export default CurrencyView;