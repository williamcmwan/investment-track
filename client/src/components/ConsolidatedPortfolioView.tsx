import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Loader2, RefreshCw, TrendingUp, TrendingDown, DollarSign, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiClient } from "@/services/api";
import OtherPortfolioView from "./OtherPortfolioView";

type SortField = 'symbol' | 'dayChange' | 'averageCost' | 'position' | 'marketPrice' | 'unrealizedPnL' | 'marketValue' | 'secType';
type SortDirection = 'asc' | 'desc';

interface Account {
  id: number;
  userId: number;
  name: string;
  currency: string;
  accountType?: string;
  originalCapital: number;
  currentBalance: number;
  lastUpdated: string;
  createdAt: string;
  updatedAt: string;
  profitLoss: number;
  profitLossPercent: number;
  integrationType?: string;
  integrationConfig?: string;
}

interface PortfolioPosition {
  symbol: string;
  position: number;
  marketPrice: number;
  marketValue: number;
  averageCost: number;
  unrealizedPnL: number;
  unrealizedPNL?: number;
  realizedPnL: number;
  currency: string;
  dayChange?: number;
  dayChangePercent?: number;
  secType?: string;
  conId?: number;
}

interface CashBalance {
  currency: string;
  balance?: number;
  amount?: number;
}

interface ConsolidatedPortfolioViewProps {
  baseCurrency: string;
  onAccountUpdate?: () => void;
}

export default function ConsolidatedPortfolioView({ 
  baseCurrency,
  onAccountUpdate 
}: ConsolidatedPortfolioViewProps) {
  const { toast } = useToast();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [allAccounts, setAllAccounts] = useState<Account[]>([]); // All accounts for Other Portfolio
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState<Record<number, boolean>>({});
  const [portfolioData, setPortfolioData] = useState<Record<number, {
    portfolio: PortfolioPosition[];
    cash: CashBalance[];
    totalValue: number;
    lastUpdated?: string;
  }>>({});
  const [exchangeRates, setExchangeRates] = useState<Record<string, number>>({});
  const [sortConfig, setSortConfig] = useState<Record<number, { field: SortField; direction: SortDirection }>>({});

  useEffect(() => {
    loadAccounts();
    fetchExchangeRates();
  }, []);

  // Handle sorting
  const handleSort = (accountId: number, field: SortField) => {
    setSortConfig(prev => {
      const current = prev[accountId];
      if (current?.field === field) {
        // Toggle direction
        return {
          ...prev,
          [accountId]: {
            field,
            direction: current.direction === 'asc' ? 'desc' : 'asc'
          }
        };
      }
      // New field, default to descending for numeric fields, ascending for symbol
      return {
        ...prev,
        [accountId]: {
          field,
          direction: field === 'symbol' ? 'asc' : 'desc'
        }
      };
    });
  };

  // Get sorted portfolio for an account
  const getSortedPortfolio = (accountId: number, portfolio: PortfolioPosition[]) => {
    const config = sortConfig[accountId];
    if (!config) return portfolio;

    return [...portfolio].sort((a, b) => {
      let aVal: number | string;
      let bVal: number | string;

      switch (config.field) {
        case 'symbol':
          aVal = a.symbol;
          bVal = b.symbol;
          break;
        case 'dayChange':
          aVal = a.dayChange || 0;
          bVal = b.dayChange || 0;
          break;
        case 'averageCost':
          aVal = a.averageCost || 0;
          bVal = b.averageCost || 0;
          break;
        case 'position':
          aVal = a.position || 0;
          bVal = b.position || 0;
          break;
        case 'marketPrice':
          aVal = a.marketPrice || 0;
          bVal = b.marketPrice || 0;
          break;
        case 'unrealizedPnL':
          aVal = a.unrealizedPNL || a.unrealizedPnL || 0;
          bVal = b.unrealizedPNL || b.unrealizedPnL || 0;
          break;
        case 'marketValue':
          aVal = a.marketValue || 0;
          bVal = b.marketValue || 0;
          break;
        case 'secType':
          aVal = a.secType || '';
          bVal = b.secType || '';
          break;
        default:
          return 0;
      }

      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return config.direction === 'asc' 
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      }

      return config.direction === 'asc' 
        ? (aVal as number) - (bVal as number)
        : (bVal as number) - (aVal as number);
    });
  };

  // Render sort icon
  const renderSortIcon = (accountId: number, field: SortField) => {
    const config = sortConfig[accountId];
    if (config?.field !== field) {
      return <ArrowUpDown className="h-3 w-3 ml-1 opacity-50" />;
    }
    return config.direction === 'asc' 
      ? <ArrowUp className="h-3 w-3 ml-1" />
      : <ArrowDown className="h-3 w-3 ml-1" />;
  };

  const fetchExchangeRates = async () => {
    try {
      // Get unique currencies from portfolio data
      const currencies = new Set<string>();
      Object.values(portfolioData).forEach(data => {
        data.portfolio.forEach(pos => currencies.add(pos.currency));
        data.cash.forEach(cash => currencies.add(cash.currency));
      });

      const rates: Record<string, number> = {};
      for (const currency of currencies) {
        if (currency === baseCurrency) {
          rates[currency] = 1;
        } else {
          try {
            const response = await apiClient.getExchangeRate(`${currency}/${baseCurrency}`);
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

  // Refetch exchange rates when portfolio data changes
  useEffect(() => {
    if (Object.keys(portfolioData).length > 0) {
      fetchExchangeRates();
    }
  }, [portfolioData]);

  const loadAccounts = async () => {
    try {
      setLoading(true);
      // Clear existing portfolio data
      setPortfolioData({});
      
      const response = await apiClient.getAccounts();
      
      if (response.data) {
        // Filter investment accounts only (exclude bank accounts) for Other Portfolio tab
        const investmentAccounts = response.data.filter(
          (acc: Account) => !acc.accountType || acc.accountType === 'INVESTMENT'
        );
        setAllAccounts(investmentAccounts);
        
        // Filter accounts that have integrations configured for IB/Schwab tabs
        const integratedAccounts = response.data.filter(
          (acc: Account) => acc.integrationType && acc.integrationType !== null
        );
        
        // Sort by current balance (largest first)
        integratedAccounts.sort((a, b) => b.currentBalance - a.currentBalance);
        
        setAccounts(integratedAccounts);
        
        // Load portfolio data for each integrated account
        for (const account of integratedAccounts) {
          await loadAccountPortfolio(account.id);
        }
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to load accounts',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const loadAccountPortfolio = async (accountId: number) => {
    try {
      // Fetch portfolio positions and cash balances in parallel
      const [portfolioResponse, cashResponse, accountsResponse] = await Promise.all([
        apiClient.getAccountPortfolio(accountId),
        apiClient.getAccountCash(accountId),
        apiClient.getAccounts()
      ]);

      const account = accountsResponse.data?.find((a: Account) => a.id === accountId);
      const portfolio = portfolioResponse.data?.portfolio || [];
      const cash = cashResponse.data?.cash || [];

      // Use currentBalance from account (most accurate - from broker API)
      const totalValue = account?.currentBalance || 0;

      setPortfolioData(prev => ({
        ...prev,
        [accountId]: {
          portfolio: portfolio,
          cash: cash,
          totalValue: totalValue,
          lastUpdated: new Date().toISOString()
        }
      }));
    } catch (error) {
      console.error(`Failed to load portfolio for account ${accountId}:`, error);
      
      // Fallback to account balance if portfolio fetch fails
      try {
        const response = await apiClient.getAccounts();
        const account = response.data?.find((a: Account) => a.id === accountId);
        
        if (account) {
          setPortfolioData(prev => ({
            ...prev,
            [accountId]: {
              portfolio: [],
              cash: [{ currency: account.currency, balance: account.currentBalance }],
              totalValue: account.currentBalance,
              lastUpdated: new Date().toISOString()
            }
          }));
        }
      } catch (fallbackError) {
        console.error(`Fallback also failed for account ${accountId}:`, fallbackError);
      }
    }
  };

  const handleRefreshAccount = async (accountId: number) => {
    try {
      setRefreshing(prev => ({ ...prev, [accountId]: true }));
      
      const response = await apiClient.refreshAccountIntegration(accountId);
      
      if (response.data?.success) {
        toast({
          title: 'Success',
          description: `Account refreshed: ${new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: response.data.currency || baseCurrency
          }).format(response.data.balance)}`
        });
        
        // Reload portfolio data
        await loadAccountPortfolio(accountId);
        
        if (onAccountUpdate) {
          onAccountUpdate();
        }
      } else {
        toast({
          title: 'Refresh Failed',
          description: response.error || 'Failed to refresh account',
          variant: 'destructive'
        });
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to refresh account',
        variant: 'destructive'
      });
    } finally {
      setRefreshing(prev => ({ ...prev, [accountId]: false }));
    }
  };

  const convertToBaseCurrency = (amount: number, fromCurrency: string): number => {
    if (fromCurrency === baseCurrency) return amount;
    const rate = exchangeRates[fromCurrency] || 1;
    return amount * rate;
  };

  const formatCurrency = (amount: number, currency: string = baseCurrency) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency
    }).format(amount);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (accounts.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Portfolio</CardTitle>
          <CardDescription>
            No accounts with integrations configured
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Configure IB or Schwab integration for your accounts in the Accounts page to see portfolio data here.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Tabs defaultValue={accounts[0]?.id.toString() || 'other'} className="space-y-4">
        <TabsList>
          {accounts.map(account => (
            <TabsTrigger key={account.id} value={account.id.toString()}>
              {account.name}
            </TabsTrigger>
          ))}
          <TabsTrigger value="other">
            Others
          </TabsTrigger>
        </TabsList>

        {accounts.map(account => {
          const data = portfolioData[account.id];
          
          return (
            <TabsContent key={account.id} value={account.id.toString()} className="space-y-4">
              {/* Account Summary Card */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>{account.name}</CardTitle>
                      <CardDescription>
                        {account.integrationType} Integration
                      </CardDescription>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleRefreshAccount(account.id)}
                      disabled={refreshing[account.id]}
                    >
                      {refreshing[account.id] ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <RefreshCw className="h-4 w-4" />
                      )}
                      <span className="ml-2">Refresh</span>
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-muted-foreground">Total Account Value</p>
                      <p className="text-2xl font-bold">
                        {formatCurrency(data?.totalValue || account.currentBalance, account.currency)}
                      </p>
                    </div>
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-muted-foreground">Portfolio Positions</p>
                      <p className="text-2xl font-bold">
                        {data?.portfolio?.length || 0}
                      </p>
                    </div>
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-muted-foreground">Last Updated</p>
                      <p className="text-sm text-muted-foreground">
                        {data?.lastUpdated 
                          ? new Date(data.lastUpdated).toLocaleString()
                          : 'Never'
                        }
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Portfolio Positions */}
              {data?.portfolio && data.portfolio.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Portfolio Positions</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b">
                            <th 
                              className="text-left p-2 font-medium cursor-pointer hover:bg-muted/50 select-none"
                              onClick={() => handleSort(account.id, 'symbol')}
                            >
                              <div className="flex items-center">Symbol{renderSortIcon(account.id, 'symbol')}</div>
                            </th>
                            <th 
                              className="text-right p-2 font-medium cursor-pointer hover:bg-muted/50 select-none"
                              onClick={() => handleSort(account.id, 'dayChange')}
                            >
                              <div className="flex items-center justify-end">Day Change{renderSortIcon(account.id, 'dayChange')}</div>
                            </th>
                            <th 
                              className="text-right p-2 font-medium cursor-pointer hover:bg-muted/50 select-none"
                              onClick={() => handleSort(account.id, 'averageCost')}
                            >
                              <div className="flex items-center justify-end">Avg Cost{renderSortIcon(account.id, 'averageCost')}</div>
                            </th>
                            <th 
                              className="text-right p-2 font-medium cursor-pointer hover:bg-muted/50 select-none"
                              onClick={() => handleSort(account.id, 'position')}
                            >
                              <div className="flex items-center justify-end">Position{renderSortIcon(account.id, 'position')}</div>
                            </th>
                            <th 
                              className="text-right p-2 font-medium cursor-pointer hover:bg-muted/50 select-none"
                              onClick={() => handleSort(account.id, 'marketPrice')}
                            >
                              <div className="flex items-center justify-end">Current Price{renderSortIcon(account.id, 'marketPrice')}</div>
                            </th>
                            <th 
                              className="text-right p-2 font-medium cursor-pointer hover:bg-muted/50 select-none"
                              onClick={() => handleSort(account.id, 'unrealizedPnL')}
                            >
                              <div className="flex items-center justify-end">Unrealized P&L{renderSortIcon(account.id, 'unrealizedPnL')}</div>
                            </th>
                            <th 
                              className="text-right p-2 font-medium cursor-pointer hover:bg-muted/50 select-none"
                              onClick={() => handleSort(account.id, 'marketValue')}
                            >
                              <div className="flex items-center justify-end">Market Value{renderSortIcon(account.id, 'marketValue')}</div>
                            </th>
                            <th 
                              className="text-center p-2 font-medium cursor-pointer hover:bg-muted/50 select-none"
                              onClick={() => handleSort(account.id, 'secType')}
                            >
                              <div className="flex items-center justify-center">Type{renderSortIcon(account.id, 'secType')}</div>
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {getSortedPortfolio(account.id, data.portfolio).map((position: any, index: number) => {
                            const pnlPercentage = position.marketValue > 0 
                              ? ((position.unrealizedPNL || position.unrealizedPnL || 0) / (position.marketValue - (position.unrealizedPNL || position.unrealizedPnL || 0))) * 100
                              : 0;
                            const isPositive = (position.unrealizedPNL || position.unrealizedPnL || 0) >= 0;
                            const isDayChangePositive = (position.dayChange || 0) >= 0;

                            return (
                              <tr key={`${account.id}-${position.symbol}-${position.conId || index}`} className="border-b hover:bg-muted/50">
                                <td className="p-2 font-medium">{position.symbol}</td>
                                <td className={`text-right p-2 ${isDayChangePositive ? 'text-green-600' : 'text-red-600'}`}>
                                  {position.dayChange !== undefined && position.dayChange !== null && position.dayChangePercent !== undefined && position.dayChangePercent !== null ? (
                                    <div className="flex flex-col items-end">
                                      <div className="flex items-center gap-1">
                                        {isDayChangePositive ? (
                                          <TrendingUp className="h-3 w-3" />
                                        ) : (
                                          <TrendingDown className="h-3 w-3" />
                                        )}
                                        {formatCurrency(position.dayChange, position.currency)}
                                      </div>
                                      <div>{position.dayChangePercent.toFixed(2)}%</div>
                                    </div>
                                  ) : (
                                    'N/A'
                                  )}
                                </td>
                                <td className="text-right p-2">
                                  {formatCurrency(position.averageCost, position.currency)}
                                </td>
                                <td className="text-right p-2">{position.position?.toLocaleString()}</td>
                                <td className="text-right p-2">
                                  {formatCurrency(position.marketPrice, position.currency)}
                                </td>
                                <td className={`text-right p-2 font-medium ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
                                  <div className="flex flex-col items-end">
                                    <div className="flex items-center gap-1">
                                      {isPositive ? (
                                        <TrendingUp className="h-3 w-3" />
                                      ) : (
                                        <TrendingDown className="h-3 w-3" />
                                      )}
                                      {formatCurrency(position.unrealizedPNL || position.unrealizedPnL || 0, position.currency)}
                                    </div>
                                    <div>{pnlPercentage.toFixed(2)}%</div>
                                  </div>
                                </td>
                                <td className="text-right p-2 font-medium">
                                  {formatCurrency(position.marketValue, position.currency)}
                                </td>
                                <td className="text-center p-2">{position.secType || 'N/A'}</td>
                              </tr>
                            );
                          })}
                          {/* Totals Row */}
                          {data.portfolio.length > 0 && (
                            <tr className="border-t-2 border-primary/20 bg-muted/30 font-bold">
                              <td className="p-2" colSpan={1}>TOTAL</td>
                              <td className="text-right p-2">
                                {(() => {
                                  const totalDayChange = data.portfolio.reduce((sum, pos) => {
                                    const dayChange = pos.dayChange || 0;
                                    return sum + convertToBaseCurrency(dayChange, pos.currency);
                                  }, 0);
                                  const isPositive = totalDayChange >= 0;
                                  return (
                                    <div className={`flex flex-col items-end ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
                                      <div className="flex items-center gap-1">
                                        {isPositive ? (
                                          <TrendingUp className="h-3 w-3" />
                                        ) : (
                                          <TrendingDown className="h-3 w-3" />
                                        )}
                                        {formatCurrency(totalDayChange, baseCurrency)}
                                      </div>
                                    </div>
                                  );
                                })()}
                              </td>
                              <td className="p-2" colSpan={3}></td>
                              <td className="text-right p-2">
                                {(() => {
                                  const totalUnrealizedPnL = data.portfolio.reduce((sum, pos) => {
                                    const pnl = pos.unrealizedPNL || pos.unrealizedPnL || 0;
                                    return sum + convertToBaseCurrency(pnl, pos.currency);
                                  }, 0);
                                  const isPositive = totalUnrealizedPnL >= 0;
                                  return (
                                    <div className={`flex flex-col items-end ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
                                      <div className="flex items-center gap-1">
                                        {isPositive ? (
                                          <TrendingUp className="h-3 w-3" />
                                        ) : (
                                          <TrendingDown className="h-3 w-3" />
                                        )}
                                        {formatCurrency(totalUnrealizedPnL, baseCurrency)}
                                      </div>
                                    </div>
                                  );
                                })()}
                              </td>
                              <td className="text-right p-2">
                                {(() => {
                                  const totalMarketValue = data.portfolio.reduce((sum, pos) => {
                                    return sum + convertToBaseCurrency(pos.marketValue, pos.currency);
                                  }, 0);
                                  return formatCurrency(totalMarketValue, baseCurrency);
                                })()}
                              </td>
                              <td className="p-2"></td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Cash Balances - Always show */}
              <Card>
                <CardHeader>
                  <CardTitle>Cash Balances</CardTitle>
                </CardHeader>
                <CardContent>
                  {data?.cash && data.cash.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b">
                            <th className="text-left p-2 font-medium">Currency</th>
                            <th className="text-right p-2 font-medium">Amount (Original)</th>
                            <th className="text-right p-2 font-medium">Amount (USD)</th>
                            <th className="text-right p-2 font-medium">Amount (HKD)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {data.cash.map((cash: any, index: number) => {
                            const amount = cash.balance || cash.amount;
                            const amountInHKD = convertToBaseCurrency(amount, cash.currency);
                            // Convert to USD: first to HKD, then HKD to USD
                            const usdRate = exchangeRates['USD'] || 1;
                            const amountInUSD = usdRate > 0 ? amountInHKD / usdRate : 0;
                            
                            return (
                              <tr key={`${account.id}-cash-${cash.currency}-${index}`} className="border-b hover:bg-muted/50">
                                <td className="p-2 flex items-center gap-2">
                                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                                  <span className="font-medium">{cash.currency}</span>
                                </td>
                                <td className="text-right p-2 font-medium">
                                  {formatCurrency(amount, cash.currency)}
                                </td>
                                <td className="text-right p-2">
                                  {formatCurrency(amountInUSD, 'USD')}
                                </td>
                                <td className="text-right p-2">
                                  {formatCurrency(amountInHKD, 'HKD')}
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
                                const totalUSD = data.cash.reduce((sum, cash) => {
                                  const amount = cash.balance || cash.amount;
                                  const amountInHKD = convertToBaseCurrency(amount, cash.currency);
                                  const usdRate = exchangeRates['USD'] || 1;
                                  const amountInUSD = usdRate > 0 ? amountInHKD / usdRate : 0;
                                  return sum + amountInUSD;
                                }, 0);
                                return formatCurrency(totalUSD, 'USD');
                              })()}
                            </td>
                            <td className="text-right p-2">
                              {(() => {
                                const totalHKD = data.cash.reduce((sum, cash) => {
                                  const amount = cash.balance || cash.amount;
                                  return sum + convertToBaseCurrency(amount, cash.currency);
                                }, 0);
                                return formatCurrency(totalHKD, 'HKD');
                              })()}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No cash balance data available</p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          );
        })}

        {/* Other Portfolio Tab */}
        <TabsContent value="other">
          <OtherPortfolioView 
            accounts={allAccounts}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
