import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Edit, Trash2, RefreshCw, TrendingUp, TrendingDown, DollarSign } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiClient } from "@/services/api";

interface ManualPosition {
  id: number;
  mainAccountId: number;
  symbol: string;
  secType: string;
  currency: string;
  quantity: number;
  averageCost: number;
  marketPrice?: number;
  marketValue?: number;
  dayChange?: number;
  dayChangePercent?: number;
  unrealizedPnl?: number;
  accountName?: string;
}

interface CashBalance {
  id: number;
  mainAccountId: number;
  currency: string;
  amount: number;
  accountName: string;
}

interface MainAccount {
  id: number;
  name: string;
  currency: string;
}

interface OtherPortfolioViewProps {
  accounts: MainAccount[];
}

export default function OtherPortfolioView({ accounts }: OtherPortfolioViewProps) {
  const { toast } = useToast();
  const [positions, setPositions] = useState<ManualPosition[]>([]);
  const [cashBalances, setCashBalances] = useState<CashBalance[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [exchangeRates, setExchangeRates] = useState<Record<string, number>>({});
  
  // Position dialog state
  const [positionDialogOpen, setPositionDialogOpen] = useState(false);
  const [editingPosition, setEditingPosition] = useState<ManualPosition | null>(null);
  const [positionForm, setPositionForm] = useState({
    accountId: '',
    symbol: '',
    secType: 'STK',
    currency: 'USD',
    quantity: '',
    averageCost: ''
  });

  // Cash dialog state
  const [cashDialogOpen, setCashDialogOpen] = useState(false);
  const [editingCash, setEditingCash] = useState<CashBalance | null>(null);
  const [cashForm, setCashForm] = useState({
    accountId: '',
    currency: 'USD',
    amount: ''
  });

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (positions.length > 0 || cashBalances.length > 0) {
      fetchExchangeRates();
    }
  }, [positions, cashBalances]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [positionsRes, cashRes] = await Promise.all([
        apiClient.getManualPositions(),
        apiClient.getCashBalances()
      ]);
      
      if (positionsRes.data) setPositions(positionsRes.data);
      if (cashRes.data) setCashBalances(cashRes.data);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to load data',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchExchangeRates = async () => {
    try {
      const currencies = new Set<string>();
      positions.forEach(pos => currencies.add(pos.currency));
      cashBalances.forEach(cash => currencies.add(cash.currency));

      const rates: Record<string, number> = {};
      for (const currency of currencies) {
        if (currency === 'HKD') {
          rates[currency] = 1;
        } else {
          try {
            const response = await apiClient.getExchangeRate(`${currency}/HKD`);
            rates[currency] = response.data?.rate || 1;
          } catch {
            rates[currency] = 1;
          }
        }
      }
      setExchangeRates(rates);
    } catch (error) {
      console.error('Failed to fetch exchange rates:', error);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await apiClient.refreshManualMarketData('default');
      await loadData();
      toast({
        title: 'Success',
        description: 'Portfolio data refreshed successfully'
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to refresh data',
        variant: 'destructive'
      });
    } finally {
      setRefreshing(false);
    }
  };

  const convertToHKD = (amount: number | undefined, fromCurrency: string): number => {
    if (!amount) return 0;
    if (fromCurrency === 'HKD') return amount;
    const rate = exchangeRates[fromCurrency] || 1;
    return amount * rate;
  };

  const convertToUSD = (amountInHKD: number): number => {
    const usdRate = exchangeRates['USD'] || 1;
    return usdRate > 0 ? amountInHKD / usdRate : 0;
  };

  const formatCurrency = (amount: number, currency: string = 'HKD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency
    }).format(amount);
  };

  // Position CRUD operations
  const handleAddPosition = () => {
    setEditingPosition(null);
    setPositionForm({
      accountId: accounts[0]?.id.toString() || '',
      symbol: '',
      secType: 'STK',
      currency: 'USD',
      quantity: '',
      averageCost: ''
    });
    setPositionDialogOpen(true);
  };

  const handleEditPosition = (position: ManualPosition) => {
    setEditingPosition(position);
    setPositionForm({
      accountId: position.mainAccountId.toString(),
      symbol: position.symbol,
      secType: position.secType,
      currency: position.currency,
      quantity: position.quantity.toString(),
      averageCost: position.averageCost.toString()
    });
    setPositionDialogOpen(true);
  };

  const handleSavePosition = async () => {
    try {
      const data = {
        mainAccountId: parseInt(positionForm.accountId),
        symbol: positionForm.symbol.toUpperCase(),
        secType: positionForm.secType,
        currency: positionForm.currency,
        quantity: parseFloat(positionForm.quantity),
        averageCost: parseFloat(positionForm.averageCost)
      };

      if (editingPosition) {
        await apiClient.updateManualPosition(editingPosition.id, data);
        toast({ title: 'Success', description: 'Position updated successfully' });
      } else {
        await apiClient.createManualPosition(data);
        toast({ title: 'Success', description: 'Position added successfully' });
      }

      setPositionDialogOpen(false);
      await loadData();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to save position',
        variant: 'destructive'
      });
    }
  };

  const handleDeletePosition = async (id: number) => {
    if (!confirm('Are you sure you want to delete this position?')) return;
    
    try {
      await apiClient.deleteManualPosition(id);
      toast({ title: 'Success', description: 'Position deleted successfully' });
      await loadData();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete position',
        variant: 'destructive'
      });
    }
  };

  // Cash CRUD operations
  const handleAddCash = () => {
    setEditingCash(null);
    setCashForm({
      accountId: accounts[0]?.id.toString() || '',
      currency: 'USD',
      amount: ''
    });
    setCashDialogOpen(true);
  };

  const handleEditCash = (cash: CashBalance) => {
    setEditingCash(cash);
    setCashForm({
      accountId: cash.mainAccountId.toString(),
      currency: cash.currency,
      amount: cash.amount.toString()
    });
    setCashDialogOpen(true);
  };

  const handleSaveCash = async () => {
    try {
      const data = {
        accountId: parseInt(cashForm.accountId),
        currency: cashForm.currency,
        amount: parseFloat(cashForm.amount)
      };

      if (editingCash) {
        await apiClient.updateCashBalance(editingCash.id, data);
        toast({ title: 'Success', description: 'Cash balance updated successfully' });
      } else {
        await apiClient.createCashBalance(data);
        toast({ title: 'Success', description: 'Cash balance added successfully' });
      }

      setCashDialogOpen(false);
      await loadData();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to save cash balance',
        variant: 'destructive'
      });
    }
  };

  const handleDeleteCash = async (id: number) => {
    if (!confirm('Are you sure you want to delete this cash balance?')) return;
    
    try {
      await apiClient.deleteCashBalance(id);
      toast({ title: 'Success', description: 'Cash balance deleted successfully' });
      await loadData();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete cash balance',
        variant: 'destructive'
      });
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center py-12">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Portfolio Positions */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Portfolio Positions</CardTitle>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={refreshing}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button size="sm" onClick={handleAddPosition}>
              <Plus className="h-4 w-4 mr-2" />
              Add Position
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {positions.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2 font-medium">Symbol</th>
                    <th className="text-right p-2 font-medium">Day Change</th>
                    <th className="text-right p-2 font-medium">Avg Cost</th>
                    <th className="text-right p-2 font-medium">Position</th>
                    <th className="text-right p-2 font-medium">Current Price</th>
                    <th className="text-right p-2 font-medium">Unrealized P&L</th>
                    <th className="text-right p-2 font-medium">Market Value</th>
                    <th className="text-center p-2 font-medium">Type</th>
                    <th className="text-center p-2 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {positions.map((position) => {
                    const pnlPercentage = position.marketValue && position.marketValue > 0
                      ? ((position.unrealizedPnl || 0) / (position.marketValue - (position.unrealizedPnl || 0))) * 100
                      : 0;
                    const isPositive = (position.unrealizedPnl || 0) >= 0;
                    const isDayChangePositive = (position.dayChange || 0) >= 0;

                    return (
                      <tr key={position.id} className="border-b hover:bg-muted/50">
                        <td className="p-2 font-medium">{position.symbol}</td>
                        <td className={`text-right p-2 ${isDayChangePositive ? 'text-green-600' : 'text-red-600'}`}>
                          {position.dayChange !== undefined && position.dayChange !== null ? (
                            <div className="flex flex-col items-end">
                              <div className="flex items-center gap-1">
                                {isDayChangePositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                                {formatCurrency(position.dayChange, position.currency)}
                              </div>
                              {position.dayChangePercent !== undefined && (
                                <div>{position.dayChangePercent.toFixed(2)}%</div>
                              )}
                            </div>
                          ) : 'N/A'}
                        </td>
                        <td className="text-right p-2">{formatCurrency(position.averageCost, position.currency)}</td>
                        <td className="text-right p-2">{position.quantity.toLocaleString()}</td>
                        <td className="text-right p-2">
                          {position.marketPrice ? formatCurrency(position.marketPrice, position.currency) : 'N/A'}
                        </td>
                        <td className={`text-right p-2 font-medium ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
                          <div className="flex flex-col items-end">
                            <div className="flex items-center gap-1">
                              {isPositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                              {formatCurrency(position.unrealizedPnl || 0, position.currency)}
                            </div>
                            <div>{pnlPercentage.toFixed(2)}%</div>
                          </div>
                        </td>
                        <td className="text-right p-2 font-medium">
                          {position.marketValue ? formatCurrency(position.marketValue, position.currency) : 'N/A'}
                        </td>
                        <td className="text-center p-2">{position.secType}</td>
                        <td className="text-center p-2">
                          <div className="flex items-center justify-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEditPosition(position)}
                            >
                              <Edit className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeletePosition(position.id)}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {/* Totals Row */}
                  {positions.length > 0 && (
                    <tr className="border-t-2 border-primary/20 bg-muted/30 font-bold">
                      <td className="p-2">TOTAL</td>
                      <td className="text-right p-2">
                        {(() => {
                          const totalDayChange = positions.reduce((sum, pos) => {
                            return sum + convertToHKD(pos.dayChange || 0, pos.currency);
                          }, 0);
                          const isPositive = totalDayChange >= 0;
                          return (
                            <div className={`flex flex-col items-end ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
                              <div className="flex items-center gap-1">
                                {isPositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                                {formatCurrency(totalDayChange, 'HKD')}
                              </div>
                            </div>
                          );
                        })()}
                      </td>
                      <td className="p-2" colSpan={3}></td>
                      <td className="text-right p-2">
                        {(() => {
                          const totalUnrealizedPnL = positions.reduce((sum, pos) => {
                            return sum + convertToHKD(pos.unrealizedPnl || 0, pos.currency);
                          }, 0);
                          const isPositive = totalUnrealizedPnL >= 0;
                          return (
                            <div className={`flex flex-col items-end ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
                              <div className="flex items-center gap-1">
                                {isPositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                                {formatCurrency(totalUnrealizedPnL, 'HKD')}
                              </div>
                            </div>
                          );
                        })()}
                      </td>
                      <td className="text-right p-2">
                        {(() => {
                          const totalMarketValue = positions.reduce((sum, pos) => {
                            return sum + convertToHKD(pos.marketValue || 0, pos.currency);
                          }, 0);
                          return formatCurrency(totalMarketValue, 'HKD');
                        })()}
                      </td>
                      <td className="p-2" colSpan={2}></td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">
              No positions yet. Click "Add Position" to get started.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Cash Balances */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Cash Balances</CardTitle>
          <Button size="sm" onClick={handleAddCash}>
            <Plus className="h-4 w-4 mr-2" />
            Add Cash
          </Button>
        </CardHeader>
        <CardContent>
          {cashBalances.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2 font-medium">Currency</th>
                    <th className="text-right p-2 font-medium">Amount (Original)</th>
                    <th className="text-right p-2 font-medium">Amount (USD)</th>
                    <th className="text-right p-2 font-medium">Amount (HKD)</th>
                    <th className="text-center p-2 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {cashBalances.map((cash) => {
                    const amountInHKD = convertToHKD(cash.amount, cash.currency);
                    const amountInUSD = convertToUSD(amountInHKD);

                    return (
                      <tr key={cash.id} className="border-b hover:bg-muted/50">
                        <td className="p-2 flex items-center gap-2">
                          <DollarSign className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">{cash.currency}</span>
                        </td>
                        <td className="text-right p-2 font-medium">
                          {formatCurrency(cash.amount, cash.currency)}
                        </td>
                        <td className="text-right p-2">
                          {formatCurrency(amountInUSD, 'USD')}
                        </td>
                        <td className="text-right p-2">
                          {formatCurrency(amountInHKD, 'HKD')}
                        </td>
                        <td className="text-center p-2">
                          <div className="flex items-center justify-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEditCash(cash)}
                            >
                              <Edit className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteCash(cash.id)}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {/* Totals Row */}
                  <tr className="border-t-2 border-primary/20 bg-muted/30 font-bold">
                    <td className="p-2">TOTAL</td>
                    <td className="p-2"></td>
                    <td className="text-right p-2">
                      {(() => {
                        const totalUSD = cashBalances.reduce((sum, cash) => {
                          const amountInHKD = convertToHKD(cash.amount, cash.currency);
                          return sum + convertToUSD(amountInHKD);
                        }, 0);
                        return formatCurrency(totalUSD, 'USD');
                      })()}
                    </td>
                    <td className="text-right p-2">
                      {(() => {
                        const totalHKD = cashBalances.reduce((sum, cash) => {
                          return sum + convertToHKD(cash.amount, cash.currency);
                        }, 0);
                        return formatCurrency(totalHKD, 'HKD');
                      })()}
                    </td>
                    <td className="p-2"></td>
                  </tr>
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">
              No cash balances yet. Click "Add Cash" to get started.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Position Dialog */}
      <Dialog open={positionDialogOpen} onOpenChange={setPositionDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingPosition ? 'Edit Position' : 'Add Position'}</DialogTitle>
            <DialogDescription>
              {editingPosition ? 'Update the position details' : 'Add a new position to your portfolio'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Account</Label>
              <Select value={positionForm.accountId} onValueChange={(value) => setPositionForm({ ...positionForm, accountId: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select account" />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map((account) => (
                    <SelectItem key={account.id} value={account.id.toString()}>
                      {account.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Symbol</Label>
              <Input
                value={positionForm.symbol}
                onChange={(e) => setPositionForm({ ...positionForm, symbol: e.target.value })}
                placeholder="e.g., AAPL"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Type</Label>
                <Select value={positionForm.secType} onValueChange={(value) => setPositionForm({ ...positionForm, secType: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="STK">Stock</SelectItem>
                    <SelectItem value="ETF">ETF</SelectItem>
                    <SelectItem value="BOND">Bond</SelectItem>
                    <SelectItem value="CRYPTO">Crypto</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Currency</Label>
                <Select value={positionForm.currency} onValueChange={(value) => setPositionForm({ ...positionForm, currency: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="USD">USD</SelectItem>
                    <SelectItem value="HKD">HKD</SelectItem>
                    <SelectItem value="CAD">CAD</SelectItem>
                    <SelectItem value="EUR">EUR</SelectItem>
                    <SelectItem value="GBP">GBP</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Quantity</Label>
                <Input
                  type="number"
                  value={positionForm.quantity}
                  onChange={(e) => setPositionForm({ ...positionForm, quantity: e.target.value })}
                  placeholder="0"
                />
              </div>
              <div>
                <Label>Average Cost</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={positionForm.averageCost}
                  onChange={(e) => setPositionForm({ ...positionForm, averageCost: e.target.value })}
                  placeholder="0.00"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPositionDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSavePosition}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cash Dialog */}
      <Dialog open={cashDialogOpen} onOpenChange={setCashDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingCash ? 'Edit Cash Balance' : 'Add Cash Balance'}</DialogTitle>
            <DialogDescription>
              {editingCash ? 'Update the cash balance' : 'Add a new cash balance'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Account</Label>
              <Select value={cashForm.accountId} onValueChange={(value) => setCashForm({ ...cashForm, accountId: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select account" />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map((account) => (
                    <SelectItem key={account.id} value={account.id.toString()}>
                      {account.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Currency</Label>
              <Select value={cashForm.currency} onValueChange={(value) => setCashForm({ ...cashForm, currency: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="USD">USD</SelectItem>
                  <SelectItem value="HKD">HKD</SelectItem>
                  <SelectItem value="CAD">CAD</SelectItem>
                  <SelectItem value="EUR">EUR</SelectItem>
                  <SelectItem value="GBP">GBP</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Amount</Label>
              <Input
                type="number"
                step="0.01"
                value={cashForm.amount}
                onChange={(e) => setCashForm({ ...cashForm, amount: e.target.value })}
                placeholder="0.00"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCashDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveCash}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
