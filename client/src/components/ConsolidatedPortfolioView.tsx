import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Loader2, RefreshCw, TrendingUp, TrendingDown, DollarSign } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiClient } from "@/services/api";
import OtherPortfolioView from "./OtherPortfolioView";

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
  realizedPnL: number;
  currency: string;
}

interface CashBalance {
  currency: string;
  balance: number;
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
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState<Record<number, boolean>>({});
  const [portfolioData, setPortfolioData] = useState<Record<number, {
    portfolio: PortfolioPosition[];
    cash: CashBalance[];
    totalValue: number;
    lastUpdated?: string;
  }>>({});

  useEffect(() => {
    loadAccounts();
  }, []);

  const loadAccounts = async () => {
    try {
      setLoading(true);
      // Clear existing portfolio data
      setPortfolioData({});
      
      const response = await apiClient.getAccounts();
      
      if (response.data) {
        // Filter accounts that have integrations configured
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
                            <th className="text-left p-2 font-medium">Symbol</th>
                            <th className="text-right p-2 font-medium">Day Change</th>
                            <th className="text-right p-2 font-medium">Avg Cost</th>
                            <th className="text-right p-2 font-medium">Position</th>
                            <th className="text-right p-2 font-medium">Current Price</th>
                            <th className="text-right p-2 font-medium">Unrealized P&L</th>
                            <th className="text-right p-2 font-medium">Market Value</th>
                            <th className="text-center p-2 font-medium">Type</th>
                          </tr>
                        </thead>
                        <tbody>
                          {data.portfolio.map((position: any, index: number) => {
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
                            <th className="text-right p-2 font-medium">Amount</th>
                          </tr>
                        </thead>
                        <tbody>
                          {data.cash.map((cash: any, index: number) => (
                            <tr key={`${account.id}-cash-${cash.currency}-${index}`} className="border-b hover:bg-muted/50">
                              <td className="p-2 flex items-center gap-2">
                                <DollarSign className="h-4 w-4 text-muted-foreground" />
                                <span className="font-medium">{cash.currency}</span>
                              </td>
                              <td className="text-right p-2 font-medium">
                                {formatCurrency(cash.balance || cash.amount, cash.currency)}
                              </td>
                            </tr>
                          ))}
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
            accounts={accounts}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
