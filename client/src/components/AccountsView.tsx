import { useState } from "react";
import { apiClient } from "@/services/api";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { 
  PlusCircle, 
  Edit, 
  TrendingUp, 
  TrendingDown,
  DollarSign,
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
  ChevronDown,
  ChevronUp,
  History,
  Trash2
} from "lucide-react";

interface Account {
  id: number;
  userId: number;
  name: string;
  currency: string;
  originalCapital: number;
  currentBalance: number;
  lastUpdated: string;
  createdAt: string;
  updatedAt: string;
  profitLoss: number;
  profitLossPercent: number;
  history?: Array<{
    id: number;
    accountId: number;
    balance: number;
    note: string;
    date: string;
    createdAt: string;
  }>;
}

interface AccountsViewProps {
  accounts: Account[];
  baseCurrency: string;
  exchangeRates: Record<string, number>;
  convertToBaseCurrency: (amount: number, fromCurrency: string) => number;
  onAccountUpdate: () => void;
}

const AccountsView = ({ accounts, baseCurrency, exchangeRates, convertToBaseCurrency, onAccountUpdate }: AccountsViewProps) => {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [expandedAccounts, setExpandedAccounts] = useState<Set<number>>(new Set());
  const [isUpdatingBalance, setIsUpdatingBalance] = useState<number | null>(null);
  const [isUpdateBalanceDialogOpen, setIsUpdateBalanceDialogOpen] = useState(false);
  const [updatingAccount, setUpdatingAccount] = useState<Account | null>(null);
  const [isEditHistoryDialogOpen, setIsEditHistoryDialogOpen] = useState(false);
  const [editingHistoryEntry, setEditingHistoryEntry] = useState<any>(null);
  const [historyEdit, setHistoryEdit] = useState({
    balance: 0,
    note: "",
    date: ""
  });
  const { toast } = useToast();

  // Form states
  const [newAccount, setNewAccount] = useState({
    name: "",
    currency: "",
    originalCapital: 0,
    currentBalance: 0
  });

  const [balanceUpdate, setBalanceUpdate] = useState({
    balance: 0,
    note: "",
    date: new Date().toISOString().split('T')[0]
  });

  const [editAccount, setEditAccount] = useState({
    name: "",
    originalCapital: 0
  });

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

  const toggleAccountExpansion = (accountId: number) => {
    setExpandedAccounts(prev => {
      const newSet = new Set(prev);
      if (newSet.has(accountId)) {
        newSet.delete(accountId);
      } else {
        newSet.add(accountId);
      }
      return newSet;
    });
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-GB", {
      year: "numeric",
      month: "short", 
      day: "numeric"
    });
  };

  // Handle account creation
  const handleCreateAccount = async () => {
    try {
      const response = await apiClient.createAccount(newAccount);
      if (response.data) {
        toast({
          title: "Success",
          description: "Account created successfully",
        });
        handleDialogClose();
        onAccountUpdate();
      } else {
        toast({
          title: "Error",
          description: response.error || "Failed to create account",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to create account",
        variant: "destructive",
      });
    }
  };

  // Handle balance update
  const handleUpdateBalance = async (accountId: number) => {
    try {
      setIsUpdatingBalance(accountId);
      
      // Update the account balance with the date from the form
      const updateResponse = await apiClient.updateAccount(accountId, {
        currentBalance: balanceUpdate.balance,
        date: balanceUpdate.date
      });
      
      if (updateResponse.data) {
        toast({
          title: "Success",
          description: "Balance updated successfully",
        });
        handleUpdateBalanceDialogClose();
        onAccountUpdate();
      } else {
        toast({
          title: "Error",
          description: updateResponse.error || "Failed to update balance",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update balance",
        variant: "destructive",
      });
    } finally {
      setIsUpdatingBalance(null);
    }
  };

  // Handle account editing
  const handleEditAccount = async (accountId: number) => {
    try {
      const response = await apiClient.updateAccount(accountId, {
        name: editAccount.name,
        originalCapital: editAccount.originalCapital
      });
      
      if (response.data) {
        toast({
          title: "Success",
          description: "Account updated successfully",
        });
        // Close dialog first
        setEditingAccount(null);
        setEditAccount({ name: "", originalCapital: 0 });
        // Reload accounts immediately
        onAccountUpdate();
      } else {
        toast({
          title: "Error",
          description: response.error || "Failed to update account",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update account",
        variant: "destructive",
      });
    }
  };

  // Handle dialog close and form reset
  const handleDialogClose = () => {
    setIsAddDialogOpen(false);
    setNewAccount({ name: "", currency: "", originalCapital: 0, currentBalance: 0 });
  };

  const handleUpdateBalanceDialogClose = () => {
    setIsUpdateBalanceDialogOpen(false);
    setUpdatingAccount(null);
    setBalanceUpdate({
      balance: 0,
      note: "",
      date: new Date().toISOString().split('T')[0]
    });
  };

  const openUpdateBalanceDialog = (account: Account) => {
    setUpdatingAccount(account);
    setBalanceUpdate({
      balance: account.currentBalance,
      note: "",
      date: new Date().toISOString().split('T')[0]
    });
    setIsUpdateBalanceDialogOpen(true);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && updatingAccount && !isUpdatingBalance) {
      handleUpdateBalance(updatingAccount.id);
    }
  };

  // Handle history editing
  const openEditHistoryDialog = (entry: any, account: Account) => {
    setEditingHistoryEntry({ ...entry, accountId: account.id });
    setHistoryEdit({
      balance: entry.balance,
      note: entry.note,
      date: entry.date
    });
    setIsEditHistoryDialogOpen(true);
  };

  const handleEditHistoryDialogClose = () => {
    setIsEditHistoryDialogOpen(false);
    setEditingHistoryEntry(null);
    setHistoryEdit({
      balance: 0,
      note: "",
      date: ""
    });
  };

  const handleUpdateHistory = async () => {
    if (!editingHistoryEntry) return;

    try {
      const response = await apiClient.updateBalanceHistory(
        editingHistoryEntry.accountId,
        editingHistoryEntry.id,
        historyEdit.balance,
        historyEdit.note,
        historyEdit.date
      );

      if (response.data) {
        toast({
          title: "Success",
          description: "Balance history updated successfully",
        });
        handleEditHistoryDialogClose();
        onAccountUpdate();
      } else {
        toast({
          title: "Error",
          description: response.error || "Failed to update balance history",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update balance history",
        variant: "destructive",
      });
    }
  };

  const handleDeleteHistory = async (entry: any, account: Account) => {
    if (!confirm('Are you sure you want to delete this balance history entry?')) {
      return;
    }

    try {
      const response = await apiClient.deleteBalanceHistory(account.id, entry.id);

      if (response.data) {
        toast({
          title: "Success",
          description: "Balance history deleted successfully",
        });
        onAccountUpdate();
      } else {
        toast({
          title: "Error",
          description: response.error || "Failed to delete balance history",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete balance history",
        variant: "destructive",
      });
    }
  };

  // Handle edit dialog close
  const handleEditDialogClose = () => {
    setEditingAccount(null);
    setEditAccount({ name: "", originalCapital: 0 });
  };

  // Open edit dialog
  const openEditDialog = (account: Account) => {
    setEditingAccount(account);
    setEditAccount({
      name: account.name,
      originalCapital: account.originalCapital
    });
  };


  return (
    <div className="space-y-6">
      {/* Add Account Dialog */}
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
                value={newAccount.name}
                onChange={(e) => setNewAccount({...newAccount, name: e.target.value})}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="currency">Base Currency</Label>
              <Select value={newAccount.currency} onValueChange={(value) => setNewAccount({...newAccount, currency: value})}>
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
                value={newAccount.originalCapital || ""}
                onChange={(e) => setNewAccount({...newAccount, originalCapital: parseFloat(e.target.value) || 0})}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="balance">Current Balance</Label>
              <Input
                id="balance"
                type="number"
                placeholder="125000"
                className="bg-background/50"
                value={newAccount.currentBalance || ""}
                onChange={(e) => setNewAccount({...newAccount, currentBalance: parseFloat(e.target.value) || 0})}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleDialogClose}>
              Cancel
            </Button>
            <Button className="bg-gradient-primary hover:opacity-90" onClick={handleCreateAccount}>
              Add Account
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Account Dialog */}
      <Dialog open={editingAccount !== null} onOpenChange={handleEditDialogClose}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground">Edit Account</DialogTitle>
            <DialogDescription>
              Update the account name and original capital.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Account Name</Label>
              <Input
                id="edit-name"
                placeholder="e.g., Interactive Brokers"
                className="bg-background/50"
                value={editAccount.name}
                onChange={(e) => setEditAccount({...editAccount, name: e.target.value})}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-capital">Original Capital ({editingAccount?.currency})</Label>
              <Input
                id="edit-capital"
                type="number"
                step="0.01"
                placeholder="10000"
                className="bg-background/50"
                value={editAccount.originalCapital || ""}
                onChange={(e) => setEditAccount({...editAccount, originalCapital: parseFloat(e.target.value) || 0})}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleEditDialogClose}>
              Cancel
            </Button>
            <Button 
              className="bg-gradient-primary hover:opacity-90" 
              onClick={() => editingAccount && handleEditAccount(editingAccount.id)}
            >
              Update Account
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
              {formatCurrency(accounts.reduce((sum, acc) => sum + convertToBaseCurrency(acc.originalCapital, acc.currency), 0), baseCurrency)}
            </div>
            <p className="text-xs text-muted-foreground">Original investment ({baseCurrency} equivalent)</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-card border-border shadow-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Current Value</CardTitle>
            <TrendingUp className="h-4 w-4 text-profit" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              {formatCurrency(accounts.reduce((sum, acc) => sum + convertToBaseCurrency(acc.currentBalance, acc.currency), 0), baseCurrency)}
            </div>
            <p className="text-xs text-muted-foreground">Current balance ({baseCurrency} equivalent)</p>
            <div className="mt-2 pt-2 border-t border-border/50">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Total P&L:</span>
                <span className={`text-sm font-medium ${accounts.reduce((sum, acc) => sum + convertToBaseCurrency(acc.profitLoss, acc.currency), 0) > 0 ? 'text-profit' : 'text-loss'}`}>
                  {formatCurrency(accounts.reduce((sum, acc) => sum + convertToBaseCurrency(acc.profitLoss, acc.currency), 0), baseCurrency)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">P&L %:</span>
                <span className={`text-sm font-medium ${accounts.reduce((sum, acc) => sum + convertToBaseCurrency(acc.profitLoss, acc.currency), 0) > 0 ? 'text-profit' : 'text-loss'}`}>
                  {(() => {
                    const totalCapital = accounts.reduce((sum, acc) => sum + convertToBaseCurrency(acc.originalCapital, acc.currency), 0);
                    const totalPnL = accounts.reduce((sum, acc) => sum + convertToBaseCurrency(acc.profitLoss, acc.currency), 0);
                    return totalCapital > 0 ? `${((totalPnL / totalCapital) * 100).toFixed(2)}%` : '0.00%';
                  })()}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Accounts List */}
      <div className="grid gap-6">
        {accounts
          .sort((a, b) => {
            // Sort by current balance converted to base currency (descending - highest first)
            const balanceA = convertToBaseCurrency(a.currentBalance, a.currency);
            const balanceB = convertToBaseCurrency(b.currentBalance, b.currency);
            return balanceB - balanceA;
          })
          .map((account) => (
          <Card key={account.id} className="bg-gradient-card border-border shadow-card">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/20 rounded-lg">
                    <span className="text-lg">{getCurrencyFlag(account.currency)}</span>
                  </div>
                  <div className="flex items-center gap-3 group">
                    <div className="flex items-center gap-3">
                      <CardTitle className="text-foreground">{account.name}</CardTitle>
                      <CardDescription>Base Currency: {account.currency}</CardDescription>
                    </div>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="border-blue-500 text-blue-500 hover:bg-blue-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                      onClick={() => openEditDialog(account)}
                    >
                      <Edit className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
                <Badge variant={account.profitLoss > 0 ? "default" : "destructive"}>
                  {account.profitLoss > 0 ? (
                    <ArrowUpRight className="h-3 w-3 mr-1" />
                  ) : (
                    <ArrowDownRight className="h-3 w-3 mr-1" />
                  )}
                  {formatPercent(account.profitLossPercent)}
                </Badge>
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
                    ≈ {formatCurrency(convertToBaseCurrency(account.originalCapital, account.currency), baseCurrency)}
                  </p>
                </div>
                
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">Current Balance</p>
                  <p className="text-lg font-semibold text-foreground">
                    {formatCurrency(account.currentBalance, account.currency)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    ≈ {formatCurrency(convertToBaseCurrency(account.currentBalance, account.currency), baseCurrency)}
                  </p>
                </div>
                
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">Profit/Loss</p>
                  <p className={`text-lg font-semibold ${account.profitLoss > 0 ? 'text-profit' : 'text-loss'}`}>
                    {formatCurrency(account.profitLoss, account.currency)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    ≈ {formatCurrency(convertToBaseCurrency(account.profitLoss, account.currency), baseCurrency)}
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
            
            {/* Expandable History Section */}
            <Collapsible open={expandedAccounts.has(account.id)} onOpenChange={() => toggleAccountExpansion(account.id)}>
              <div className="border-t border-border">
                <div className="flex items-center justify-between px-4 py-3 hover:bg-background/50 transition-smooth">
                  <CollapsibleTrigger asChild>
                    <Button
                      variant="ghost"
                      className="flex items-center gap-2 p-0 h-auto"
                    >
                      <History className="h-4 w-4" />
                      <span className="text-sm">Balance History</span>
                      {expandedAccounts.has(account.id) ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </Button>
                  </CollapsibleTrigger>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="border-primary text-primary hover:bg-primary/10"
                    onClick={() => openUpdateBalanceDialog(account)}
                  >
                    <Edit className="h-3 w-3 mr-1" />
                    Update
                  </Button>
                </div>
              </div>
              <CollapsibleContent className="border-t border-border">
                <div className="p-4">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border/50">
                          <th className="text-left py-2 px-3 text-muted-foreground font-medium">Date</th>
                          <th className="text-right py-2 px-3 text-muted-foreground font-medium">Balance</th>
                          <th className="text-right py-2 px-3 text-muted-foreground font-medium">Change</th>
                          <th className="text-left py-2 px-3 text-muted-foreground font-medium">Remark</th>
                          <th className="text-center py-2 px-3 text-muted-foreground font-medium">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(account.history || [])
                          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                          .map((entry, index) => {
                            const previousEntry = (account.history || [])
                              .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                              [index + 1];
                            
                            const changePercent = previousEntry 
                              ? ((entry.balance - previousEntry.balance) / previousEntry.balance) * 100
                              : 0;
                            
                            const changeAmount = previousEntry 
                              ? entry.balance - previousEntry.balance
                              : 0;
                            
                            const changeAmountBaseCurrency = previousEntry 
                              ? convertToBaseCurrency(entry.balance, account.currency) - convertToBaseCurrency(previousEntry.balance, account.currency)
                              : 0;
                            
                            return (
                              <tr key={entry.id} className="border-b border-border/30 hover:bg-background/30 transition-colors">
                                <td className="py-3 px-3 text-muted-foreground">
                                  {formatDate(entry.date)}
                                </td>
                                <td className="py-3 px-3 text-right">
                                  <div>
                                    <p className="font-medium text-foreground">
                                      {formatCurrency(entry.balance, account.currency)}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                      ≈ {formatCurrency(convertToBaseCurrency(entry.balance, account.currency), baseCurrency)}
                                    </p>
                                  </div>
                                </td>
                                <td className="py-3 px-3 text-right">
                                  {previousEntry ? (
                                    <div>
                                      <div className={`font-medium ${changePercent >= 0 ? 'text-profit' : 'text-loss'}`}>
                                        {changePercent >= 0 ? '+' : ''}{changePercent.toFixed(2)}%
                                      </div>
                                      <div className={`text-xs ${changeAmountBaseCurrency >= 0 ? 'text-profit' : 'text-loss'}`}>
                                        {changeAmountBaseCurrency >= 0 ? '+' : ''}{formatCurrency(changeAmountBaseCurrency, baseCurrency)}
                                      </div>
                                    </div>
                                  ) : (
                                    <span className="text-muted-foreground">-</span>
                                  )}
                                </td>
                                <td className="py-3 px-3 text-muted-foreground">
                                  {entry.note}
                                </td>
                                <td className="py-3 px-3 text-center">
                                  <div className="flex items-center justify-center gap-2">
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="h-8 w-8 p-0 border-blue-500 text-blue-500 hover:bg-blue-500/10"
                                      onClick={() => openEditHistoryDialog(entry, account)}
                                    >
                                      <Edit className="h-3 w-3" />
                                    </Button>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="h-8 w-8 p-0 border-red-500 text-red-500 hover:bg-red-500/10"
                                      onClick={() => handleDeleteHistory(entry, account)}
                                    >
                                      <Trash2 className="h-3 w-3" />
                                    </Button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>
          </Card>
        ))}
      </div>

      {/* Update Balance Dialog */}
      <Dialog open={isUpdateBalanceDialogOpen} onOpenChange={setIsUpdateBalanceDialogOpen}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground">Update Balance - {updatingAccount?.name}</DialogTitle>
            <DialogDescription>
              Update the current balance for this account.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="current-balance">Current Balance ({updatingAccount?.currency})</Label>
              <Input
                id="current-balance"
                type="number"
                value={balanceUpdate.balance || ""}
                onChange={(e) => setBalanceUpdate({...balanceUpdate, balance: parseFloat(e.target.value) || 0})}
                onKeyPress={handleKeyPress}
                className="bg-background/50"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="update-note">Note (Optional)</Label>
              <Input
                id="update-note"
                placeholder="e.g., Portfolio rebalance"
                value={balanceUpdate.note}
                onChange={(e) => setBalanceUpdate({...balanceUpdate, note: e.target.value})}
                onKeyPress={handleKeyPress}
                className="bg-background/50"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="update-date">Update Date</Label>
              <Input
                id="update-date"
                type="date"
                value={balanceUpdate.date}
                onChange={(e) => setBalanceUpdate({...balanceUpdate, date: e.target.value})}
                onKeyPress={handleKeyPress}
                className="bg-background/50"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleUpdateBalanceDialogClose}>
              Cancel
            </Button>
            <Button 
              className="bg-gradient-primary hover:opacity-90" 
              onClick={() => updatingAccount && handleUpdateBalance(updatingAccount.id)}
              disabled={isUpdatingBalance === updatingAccount?.id}
            >
              {isUpdatingBalance === updatingAccount?.id ? "Updating..." : "Update Balance"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit History Dialog */}
      <Dialog open={isEditHistoryDialogOpen} onOpenChange={setIsEditHistoryDialogOpen}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground">Edit Balance History</DialogTitle>
            <DialogDescription>
              Update the balance history entry.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-history-balance">Balance</Label>
              <Input
                id="edit-history-balance"
                type="number"
                value={historyEdit.balance || ""}
                onChange={(e) => setHistoryEdit({...historyEdit, balance: parseFloat(e.target.value) || 0})}
                className="bg-background/50"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-history-note">Note</Label>
              <Input
                id="edit-history-note"
                placeholder="e.g., Portfolio rebalance"
                value={historyEdit.note}
                onChange={(e) => setHistoryEdit({...historyEdit, note: e.target.value})}
                className="bg-background/50"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-history-date">Date</Label>
              <Input
                id="edit-history-date"
                type="date"
                value={historyEdit.date}
                onChange={(e) => setHistoryEdit({...historyEdit, date: e.target.value})}
                className="bg-background/50"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleEditHistoryDialogClose}>
              Cancel
            </Button>
            <Button 
              className="bg-gradient-primary hover:opacity-90" 
              onClick={handleUpdateHistory}
            >
              Update History
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AccountsView;