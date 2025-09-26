import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  PlusCircle, 
  Edit, 
  TrendingUp, 
  TrendingDown,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
  ArrowLeftRight
} from "lucide-react";

interface Currency {
  pair: string;
  rate: number;
  avgCost: number;
  profitLoss: number;
  amount: number;
}

interface CurrencyViewProps {
  currencies: Currency[];
}

const CurrencyView = ({ currencies }: CurrencyViewProps) => {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);

  const formatCurrency = (amount: number, currency = "HKD") => {
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
      HKD: "🇭🇰"
    };
    
    const [from, to] = pair.split("/");
    return `${flagMap[from]} → ${flagMap[to]}`;
  };

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
            <Select>
              <SelectTrigger className="bg-background/50">
                <SelectValue placeholder="Select currency pair" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="USD/HKD">🇺🇸 USD to HKD</SelectItem>
                <SelectItem value="EUR/HKD">🇪🇺 EUR to HKD</SelectItem>
                <SelectItem value="GBP/HKD">🇬🇧 GBP to HKD</SelectItem>
                <SelectItem value="CAD/HKD">🇨🇦 CAD to HKD</SelectItem>
                <SelectItem value="SGD/HKD">🇸🇬 SGD to HKD</SelectItem>
                <SelectItem value="JPY/HKD">🇯🇵 JPY to HKD</SelectItem>
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
              className="bg-background/50"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="amount">Amount Exchanged</Label>
            <Input
              id="amount"
              type="number"
              placeholder="100000"
              className="bg-background/50"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
            Cancel
          </Button>
          <Button className="bg-gradient-primary hover:opacity-90">
            Add Currency Pair
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  const UpdateRateDialog = ({ currency }: { currency: Currency }) => (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="border-primary text-primary hover:bg-primary/10">
          <Edit className="h-3 w-3 mr-1" />
          Update
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-foreground">Update Exchange Rate - {currency.pair}</DialogTitle>
          <DialogDescription>
            Update your average exchange cost for this currency pair.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="new-avg-cost">New Average Exchange Cost</Label>
            <Input
              id="new-avg-cost"
              type="number"
              step="0.0001"
              defaultValue={currency.avgCost}
              className="bg-background/50"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="additional-amount">Additional Amount (optional)</Label>
            <Input
              id="additional-amount"
              type="number"
              placeholder="0"
              className="bg-background/50"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline">Cancel</Button>
          <Button className="bg-gradient-primary hover:opacity-90">
            Update Rate
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  const totalProfitLoss = currencies.reduce((sum, curr) => sum + curr.profitLoss, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
        <Button variant="outline" className="border-primary text-primary hover:bg-primary/10">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh Rates
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
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Exposure</CardTitle>
            <ArrowLeftRight className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              {formatCurrency(currencies.reduce((sum, curr) => sum + curr.amount, 0))}
            </div>
            <p className="text-xs text-muted-foreground">Total amount in foreign currencies</p>
          </CardContent>
        </Card>
      </div>

      {/* Exchange Rate Alert */}
      <Card className="bg-gradient-card border-border shadow-card border-warning/50">
        <CardHeader>
          <CardTitle className="text-foreground flex items-center gap-2">
            <RefreshCw className="h-5 w-5 text-warning" />
            Live Exchange Rates
          </CardTitle>
          <CardDescription>
            Rates are updated in real-time. Last updated: Jan 15, 2024 14:30 HKT
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Currency Pairs List */}
      <div className="grid gap-6">
        {currencies.map((currency, index) => (
          <Card key={index} className="bg-gradient-card border-border shadow-card">
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
                  <Badge variant={currency.profitLoss > 0 ? "default" : "destructive"}>
                    {currency.profitLoss > 0 ? (
                      <ArrowUpRight className="h-3 w-3 mr-1" />
                    ) : (
                      <ArrowDownRight className="h-3 w-3 mr-1" />
                    )}
                    {formatCurrency(currency.profitLoss)}
                  </Badge>
                  <UpdateRateDialog currency={currency} />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">Current Rate</p>
                  <p className="text-lg font-semibold text-foreground">
                    {formatRate(currency.rate)}
                  </p>
                  <div className="flex items-center gap-1">
                    {currency.rate > currency.avgCost ? (
                      <ArrowUpRight className="h-3 w-3 text-profit" />
                    ) : (
                      <ArrowDownRight className="h-3 w-3 text-loss" />
                    )}
                    <span className={`text-xs ${currency.rate > currency.avgCost ? 'text-profit' : 'text-loss'}`}>
                      {((currency.rate - currency.avgCost) / currency.avgCost * 100).toFixed(2)}%
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
                  <p className="text-sm text-muted-foreground">Amount Exposed</p>
                  <p className="text-lg font-semibold text-foreground">
                    {formatCurrency(currency.amount, currency.pair.split('/')[0])}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Total foreign currency held
                  </p>
                </div>
                
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">Unrealized P&L</p>
                  <p className={`text-lg font-semibold ${currency.profitLoss > 0 ? 'text-profit' : 'text-loss'}`}>
                    {formatCurrency(currency.profitLoss)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {((currency.profitLoss / (currency.amount * currency.avgCost)) * 100).toFixed(2)}% of exposure
                  </p>
                </div>
              </div>
              
              {/* Rate Comparison Bar */}
              <div className="mt-4 space-y-2">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Your Cost: {formatRate(currency.avgCost)}</span>
                  <span>Current: {formatRate(currency.rate)}</span>
                </div>
                <div className="h-2 bg-background/50 rounded-full overflow-hidden">
                  <div 
                    className={`h-full transition-all duration-300 ${
                      currency.rate > currency.avgCost ? 'bg-profit' : 'bg-loss'
                    }`}
                    style={{ 
                      width: `${Math.abs((currency.rate - currency.avgCost) / currency.avgCost) * 100 * 10}%`,
                      maxWidth: '100%'
                    }}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default CurrencyView;