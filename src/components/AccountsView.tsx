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
  DollarSign,
  Calendar,
  ArrowUpRight,
  ArrowDownRight
} from "lucide-react";

interface Account {
  id: number;
  name: string;
  currency: string;
  originalCapital: number;
  currentBalance: number;
  lastUpdated: string;
  profitLoss: number;
  profitLossPercent: number;
}

interface AccountsViewProps {
  accounts: Account[];
}

const AccountsView = ({ accounts }: AccountsViewProps) => {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);

  const formatCurrency = (amount: number, currency = "HKD") => {
    return new Intl.NumberFormat("en-HK", {
      style: "currency",
      currency: currency,
    }).format(amount);
  };

  const formatPercent = (percent: number) => {
    return `${percent > 0 ? "+" : ""}${percent.toFixed(2)}%`;
  };

  const getCurrencyFlag = (currency: string) => {
    const flags = {
      USD: "🇺🇸",
      EUR: "🇪🇺", 
      HKD: "🇭🇰",
      GBP: "🇬🇧",
      CAD: "🇨🇦",
      SGD: "🇸🇬",
      JPY: "🇯🇵"
    };
    return flags[currency as keyof typeof flags] || "💰";
  };

  const AddAccountDialog = () => (
    <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
      <DialogTrigger asChild>
        <Button className="bg-gradient-primary hover:opacity-90 transition-smooth">
          <PlusCircle className="h-4 w-4 mr-2" />
          Add Account
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-foreground">Add Investment Account</DialogTitle>
          <DialogDescription>
            Add a new broker account to track your investments.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="broker-name">Broker Name</Label>
            <Input
              id="broker-name"
              placeholder="e.g., Interactive Brokers"
              className="bg-background/50"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="currency">Base Currency</Label>
            <Select>
              <SelectTrigger className="bg-background/50">
                <SelectValue placeholder="Select currency" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="USD">🇺🇸 USD - US Dollar</SelectItem>
                <SelectItem value="EUR">🇪🇺 EUR - Euro</SelectItem>
                <SelectItem value="HKD">🇭🇰 HKD - Hong Kong Dollar</SelectItem>
                <SelectItem value="GBP">🇬🇧 GBP - British Pound</SelectItem>
                <SelectItem value="CAD">🇨🇦 CAD - Canadian Dollar</SelectItem>
                <SelectItem value="SGD">🇸🇬 SGD - Singapore Dollar</SelectItem>
                <SelectItem value="JPY">🇯🇵 JPY - Japanese Yen</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="capital">Original Capital</Label>
            <Input
              id="capital"
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
            Add Account
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  const UpdateBalanceDialog = ({ account }: { account: Account }) => (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="border-primary text-primary hover:bg-primary/10">
          <Edit className="h-3 w-3 mr-1" />
          Update
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-foreground">Update Balance - {account.name}</DialogTitle>
          <DialogDescription>
            Update the current balance for this account.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="current-balance">Current Balance ({account.currency})</Label>
            <Input
              id="current-balance"
              type="number"
              defaultValue={account.currentBalance}
              className="bg-background/50"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="update-date">Update Date</Label>
            <Input
              id="update-date"
              type="date"
              defaultValue="2024-01-15"
              className="bg-background/50"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline">Cancel</Button>
          <Button className="bg-gradient-primary hover:opacity-90">
            Update Balance
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl md:text-2xl font-bold text-foreground">Investment Accounts</h2>
          <p className="text-muted-foreground">Manage your broker accounts and track performance</p>
        </div>
        <AddAccountDialog />
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
        <Card className="bg-gradient-card border-border shadow-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Accounts</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{accounts.length}</div>
            <p className="text-xs text-muted-foreground">Active investment accounts</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-card border-border shadow-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Capital</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              {formatCurrency(accounts.reduce((sum, acc) => sum + (acc.originalCapital * 7.8), 0))}
            </div>
            <p className="text-xs text-muted-foreground">Original investment (HKD equivalent)</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-card border-border shadow-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Current Value</CardTitle>
            <TrendingUp className="h-4 w-4 text-profit" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              {formatCurrency(accounts.reduce((sum, acc) => sum + (acc.currentBalance * 7.8), 0))}
            </div>
            <p className="text-xs text-muted-foreground">Current balance (HKD equivalent)</p>
          </CardContent>
        </Card>
      </div>

      {/* Accounts List */}
      <div className="grid gap-6">
        {accounts.map((account) => (
          <Card key={account.id} className="bg-gradient-card border-border shadow-card">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/20 rounded-lg">
                    <span className="text-lg">{getCurrencyFlag(account.currency)}</span>
                  </div>
                  <div>
                    <CardTitle className="text-foreground">{account.name}</CardTitle>
                    <CardDescription>Base Currency: {account.currency}</CardDescription>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={account.profitLoss > 0 ? "default" : "destructive"}>
                    {account.profitLoss > 0 ? (
                      <ArrowUpRight className="h-3 w-3 mr-1" />
                    ) : (
                      <ArrowDownRight className="h-3 w-3 mr-1" />
                    )}
                    {formatPercent(account.profitLossPercent)}
                  </Badge>
                  <UpdateBalanceDialog account={account} />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">Original Capital</p>
                  <p className="text-lg font-semibold text-foreground">
                    {formatCurrency(account.originalCapital, account.currency)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    ≈ {formatCurrency(account.originalCapital * 7.8)}
                  </p>
                </div>
                
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">Current Balance</p>
                  <p className="text-lg font-semibold text-foreground">
                    {formatCurrency(account.currentBalance, account.currency)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    ≈ {formatCurrency(account.currentBalance * 7.8)}
                  </p>
                </div>
                
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">Profit/Loss</p>
                  <p className={`text-lg font-semibold ${account.profitLoss > 0 ? 'text-profit' : 'text-loss'}`}>
                    {formatCurrency(account.profitLoss, account.currency)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    ≈ {formatCurrency(account.profitLoss * 7.8)}
                  </p>
                </div>
                
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">Last Updated</p>
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <p className="text-sm text-foreground">{account.lastUpdated}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default AccountsView;