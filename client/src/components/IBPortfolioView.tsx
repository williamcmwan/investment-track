import React, { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DollarSign,
  RefreshCw,
  Activity,
  TrendingUp,
  TrendingDown,
  Settings
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiClient } from "@/services/api";
import IBConfigDialog from "./IBConfigDialog";

interface IBPortfolioViewProps {
  baseCurrency: string;
  onAccountUpdate?: () => void;
}

interface PortfolioPosition {
  symbol: string;
  secType: string;
  currency: string;
  position: number;
  averageCost: number;
  marketPrice: number;
  marketValue: number;
  unrealizedPNL: number;
  realizedPNL: number;
  exchange?: string;
  primaryExchange?: string;
  conId?: number;
  industry?: string;
  category?: string;
  country?: string;
  closePrice?: number;
  dayChange?: number;
  dayChangePercent?: number;
}

interface CashBalance {
  currency: string;
  amount: number;
  marketValueHKD: number;
  marketValueUSD?: number;
}

type SortField = 'symbol' | 'secType' | 'currency' | 'position' | 'averageCost' | 'marketPrice' | 'pnlPercent' | 'unrealizedPNL' | 'marketValue' | 'country' | 'industry' | 'category' | 'dayChange' | 'dayChangePercent';
type SortDirection = 'asc' | 'desc';

const IBPortfolioView = ({ baseCurrency, onAccountUpdate }: IBPortfolioViewProps) => {
  const { toast } = useToast();
  const [isConnecting, setIsConnecting] = useState(false);
  const [accountBalance, setAccountBalance] = useState<number | null>(null);
  const [netLiquidation, setNetLiquidation] = useState<number | null>(null);
  const [totalCashValue, setTotalCashValue] = useState<number | null>(null);
  const [accountCurrency, setAccountCurrency] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [portfolio, setPortfolio] = useState<PortfolioPosition[]>([]);
  const [cashBalances, setCashBalances] = useState<CashBalance[]>([]);
  const [isLoadingPortfolio, setIsLoadingPortfolio] = useState(false);
  const [exchangeRates, setExchangeRates] = useState<Record<string, number>>({});
  const [sortField, setSortField] = useState<SortField>('symbol');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [connectionSettings, setConnectionSettings] = useState({
    host: 'localhost',
    port: 7497,
    clientId: 1
  });
  const [isConfigDialogOpen, setIsConfigDialogOpen] = useState(false);

  // Load connection settings and initial data from server on mount
  useEffect(() => {
    loadConnectionSettings();
  }, []);

  const loadConnectionSettings = async () => {
    try {
      const response = await apiClient.getIBSettings();
      if (response.data) {
        setConnectionSettings({
          host: response.data.host,
          port: response.data.port,
          clientId: response.data.client_id
        });
      }
    } catch (error) {
      console.error('Failed to load IB settings:', error);
    }
  };

  // Load cached portfolio data on mount
  useEffect(() => {
    const loadInitialData = async () => {
      console.log('🔄 Loading initial cached data...');

      try {
        console.log('📊 Trying to load cached balance...');
        const balanceResponse = await apiClient.getIBBalance();
        if (balanceResponse.data) {
          console.log('✅ Found cached balance:', balanceResponse.data?.balance, balanceResponse.data?.currency);
          setAccountBalance(balanceResponse.data.balance);
          setNetLiquidation(balanceResponse.data.netLiquidation ?? null);
          setTotalCashValue(balanceResponse.data.totalCashValue ?? null);
          setAccountCurrency(balanceResponse.data.currency);
          // Use timestamp from cache if available
          if (balanceResponse.data.timestamp) {
            setLastUpdated(new Date(balanceResponse.data.timestamp).toLocaleString());
          }
        } else {
          console.log('❌ No cached balance data returned');
        }
      } catch (error) {
        console.log('❌ Error loading cached balance:', error);
      }

      try {
        console.log('📈 Trying to load cached portfolio...');
        const portfolioResponse = await apiClient.getIBPortfolio();
        console.log('📈 Portfolio response received with', portfolioResponse.data?.length || 0, 'positions');

        if (portfolioResponse.data && portfolioResponse.data.length > 0) {
          console.log('✅ Found cached portfolio with', portfolioResponse.data.length, 'positions');
          setPortfolio(portfolioResponse.data);

          // Fetch exchange rates for all currencies in portfolio
          const uniqueCurrencies = [...new Set(portfolioResponse.data.map(p => p.currency))];
          const rates: Record<string, number> = {};

          for (const currency of uniqueCurrencies) {
            if (currency !== baseCurrency) {
              try {
                const pair = `${currency}/${baseCurrency}`;
                const rateResponse = await apiClient.getExchangeRate(pair);
                rates[currency] = rateResponse.data?.rate || 1;
              } catch (error) {
                console.error(`Failed to fetch rate for ${currency}:`, error);
                rates[currency] = 1;
              }
            } else {
              rates[currency] = 1;
            }
          }

          setExchangeRates(rates);
        } else {
          console.log('❌ No cached portfolio data or empty array');
        }
      } catch (error) {
        console.log('❌ Error loading cached portfolio:', error);
      }

      try {
        console.log('💰 Trying to load cached cash balances...');
        const cashResponse = await apiClient.getIBCashBalances();
        console.log('💰 Cash response received with', cashResponse.data?.data?.length || 0, 'currencies');

        if (cashResponse.data && cashResponse.data.data && cashResponse.data.data.length > 0) {
          console.log('✅ Found cached cash balances with', cashResponse.data.data.length, 'currencies');
          setCashBalances(cashResponse.data.data);
        } else {
          console.log('❌ No cached cash balance data or empty array');
          console.log('💰 Cash response structure: hasData =', !!cashResponse.data, ', error =', cashResponse.error || 'none');
        }
      } catch (error) {
        console.log('❌ Error loading cached cash balances:', error);
      }

      console.log('🏁 Initial data loading complete');
    };

    loadInitialData();
  }, [baseCurrency]);

  const handleGetBalance = async () => {
    setIsConnecting(true);
    try {
      const response = await apiClient.getIBBalance();
      if (response.data) {
        setAccountBalance(response.data.balance);
        setNetLiquidation(response.data.netLiquidation ?? null);
        setTotalCashValue(response.data.totalCashValue ?? null);
        setAccountCurrency(response.data.currency);
        // Use timestamp from cache if available
        if (response.data.timestamp) {
          setLastUpdated(new Date(response.data.timestamp).toLocaleString());
        }
      } else {
        throw new Error(response.error || "Failed to get account balance");
      }
    } catch (error) {
      console.error('Error getting balance:', error);
      throw error;
    } finally {
      setIsConnecting(false);
    }
  };

  const handleRefreshAll = async () => {
    setIsConnecting(true);
    setIsLoadingPortfolio(true);

    try {
      // Force refresh balance, portfolio, and cash balances to get fresh data
      const [balanceResponse, portfolioResponse, cashResponse] = await Promise.all([
        apiClient.forceRefreshIBBalance(),
        apiClient.forceRefreshIBPortfolio(),
        apiClient.forceRefreshIBCashBalances()
      ]);

      console.log('💰 Balance refresh completed');
      console.log('📈 Portfolio refresh completed with', portfolioResponse.data?.length || 0, 'positions');

      // Check for errors in responses - check error first before checking data
      if (balanceResponse.error) {
        console.error('Balance error detected:', balanceResponse.error);
        if (balanceResponse.error.includes('not configured')) {
          throw new Error('IB connection not configured. Please click "Configure" to set up your Interactive Brokers connection.');
        }
        throw new Error(balanceResponse.error);
      }

      if (portfolioResponse.error) {
        console.error('Portfolio error detected:', portfolioResponse.error);
        if (portfolioResponse.error.includes('not configured')) {
          throw new Error('IB connection not configured. Please click "Configure" to set up your Interactive Brokers connection.');
        }
        throw new Error(portfolioResponse.error);
      }

      if (cashResponse.error) {
        console.error('Cash balances error detected:', cashResponse.error);
        if (cashResponse.error.includes('not configured')) {
          throw new Error('IB connection not configured. Please click "Configure" to set up your Interactive Brokers connection.');
        }
        throw new Error(cashResponse.error);
      }

      // Verify we have data
      if (!balanceResponse.data) {
        throw new Error("No balance data received from server");
      }

      if (!portfolioResponse.data) {
        throw new Error("No portfolio data received from server");
      }

      if (!cashResponse.data || !cashResponse.data.data) {
        throw new Error("No cash balance data received from server");
      }

      // Update balance
      setAccountBalance(balanceResponse.data.balance);
      setNetLiquidation(balanceResponse.data.netLiquidation ?? null);
      setTotalCashValue(balanceResponse.data.totalCashValue ?? null);
      setAccountCurrency(balanceResponse.data.currency);
      // Use timestamp from cache if available
      if (balanceResponse.data.timestamp) {
        setLastUpdated(new Date(balanceResponse.data.timestamp).toLocaleString());
      }

      // Update the Interactive Broker HK account in the Accounts page
      await updateIBAccountBalance(balanceResponse.data.netLiquidation ?? balanceResponse.data.balance, balanceResponse.data.currency);

      // Update portfolio
      setPortfolio(portfolioResponse.data);

      // Update cash balances
      setCashBalances(cashResponse.data.data);

      // Fetch exchange rates for all currencies in portfolio and cash
      const portfolioCurrencies = [...new Set(portfolioResponse.data.map(p => p.currency))];
      const cashCurrencies = [...new Set(cashResponse.data.data.map(c => c.currency))];
      const uniqueCurrencies = [...new Set([...portfolioCurrencies, ...cashCurrencies])];
      const rates: Record<string, number> = {};

      for (const currency of uniqueCurrencies) {
        if (currency !== baseCurrency) {
          try {
            const pair = `${currency}/${baseCurrency}`;
            const rateResponse = await apiClient.getExchangeRate(pair);
            rates[currency] = rateResponse.data?.rate || 1;
          } catch (error) {
            console.error(`Failed to fetch rate for ${currency}:`, error);
            rates[currency] = 1;
          }
        } else {
          rates[currency] = 1;
        }
      }

      setExchangeRates(rates);

      toast({
        title: "Success",
        description: "Portfolio refreshed successfully with latest market data",
      });
    } catch (error) {
      console.error('Refresh error caught:', error);
      const errorMessage = error instanceof Error ? error.message : "Failed to refresh portfolio data";
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsConnecting(false);
      setIsLoadingPortfolio(false);
    }
  };

  // Helper function to update the configured target account balance
  const updateIBAccountBalance = async (balance: number, currency: string) => {
    try {
      console.log('🔄 Updating configured IB target account balance...');

      // Get user's IB settings to find the target account
      const settingsResponse = await apiClient.getIBSettings();
      if (!settingsResponse.data?.target_account_id) {
        console.log('ℹ️ No target account configured for IB updates');
        return;
      }

      const targetAccountId = settingsResponse.data.target_account_id;
      console.log(`📝 Updating target account ID: ${targetAccountId}, new balance: ${balance}`);

      // Update the account balance (this will automatically update last_updated timestamp)
      const updateResponse = await apiClient.updateAccount(targetAccountId, {
        currentBalance: balance
      });

      console.log(`✅ Updated target account balance to ${balance} ${currency}`);
      console.log(`📅 New lastUpdated: ${updateResponse.data?.lastUpdated}`);

      // Trigger account update callback if provided
      if (onAccountUpdate) {
        console.log('🔄 Triggering account update callback...');
        await onAccountUpdate();
        console.log('✅ Account update callback completed');
      }
    } catch (error) {
      console.error('❌ Failed to update target account balance:', error);
      // Don't show error toast as this is a background operation
    }
  };

  const formatCurrency = (amount: number, currency = baseCurrency) => {
    return new Intl.NumberFormat("en-HK", {
      style: "currency",
      currency: currency,
    }).format(amount);
  };

  const handleGetPortfolio = async () => {
    setIsLoadingPortfolio(true);
    try {
      const response = await apiClient.getIBPortfolio();
      if (response.data) {
        setPortfolio(response.data);

        // Fetch exchange rates for all currencies in portfolio
        const uniqueCurrencies = [...new Set(response.data.map(p => p.currency))];
        const rates: Record<string, number> = {};

        for (const currency of uniqueCurrencies) {
          if (currency !== baseCurrency) {
            try {
              const pair = `${currency}/${baseCurrency}`;
              const rateResponse = await apiClient.getExchangeRate(pair);
              rates[currency] = rateResponse.data?.rate || 1;
            } catch (error) {
              console.error(`Failed to fetch rate for ${currency}:`, error);
              rates[currency] = 1;
            }
          } else {
            rates[currency] = 1;
          }
        }

        setExchangeRates(rates);

        toast({
          title: "Success",
          description: "Portfolio retrieved successfully",
        });
      } else {
        toast({
          title: "Error",
          description: response.error || "Failed to get portfolio",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to retrieve portfolio from Interactive Brokers",
        variant: "destructive",
      });
    } finally {
      setIsLoadingPortfolio(false);
    }
  };

  const convertToHKD = (amount: number, currency: string) => {
    const rate = exchangeRates[currency] || 1;
    return amount * rate;
  };

  const calculatePnLPercentage = (unrealizedPNL: number, marketValue: number) => {
    if (marketValue === 0) return 0;
    const costBasis = marketValue - unrealizedPNL;
    if (costBasis === 0) return 0;
    return (unrealizedPNL / costBasis) * 100;
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const calculateTotals = () => {
    const totalPnLHKD = portfolio.reduce((sum, position) => {
      return sum + convertToHKD(position.unrealizedPNL, position.currency);
    }, 0);

    const totalMarketValueHKD = portfolio.reduce((sum, position) => {
      return sum + convertToHKD(position.marketValue, position.currency);
    }, 0);

    const totalDayChangeHKD = portfolio.reduce((sum, position) => {
      if (position.dayChange !== undefined) {
        return sum + convertToHKD(position.dayChange, position.currency);
      }
      return sum;
    }, 0);

    // Calculate total day change percentage
    // Formula: Sum of ((currentPrice - previousClose) * qty in HKD) / Sum of (previousClose * qty in HKD)
    let totalDayChangeAmountHKD = 0;
    let totalPreviousValueHKD = 0;

    portfolio.forEach(position => {
      if (position.closePrice !== undefined && position.closePrice > 0) {
        // (currentPrice - previousClose) * qty converted to HKD
        const dayChangeAmount = (position.marketPrice - position.closePrice) * position.position;
        const dayChangeAmountHKD = convertToHKD(dayChangeAmount, position.currency);

        // previousClose * qty converted to HKD
        const previousValue = position.closePrice * position.position;
        const previousValueHKD = convertToHKD(previousValue, position.currency);

        totalDayChangeAmountHKD += dayChangeAmountHKD;
        totalPreviousValueHKD += previousValueHKD;
      }
    });

    const totalDayChangePercent = totalPreviousValueHKD > 0
      ? (totalDayChangeAmountHKD / totalPreviousValueHKD) * 100
      : 0;

    return { totalPnLHKD, totalMarketValueHKD, totalDayChangeHKD, totalDayChangePercent };
  };

  const calculatePortfolioMarketValueUSD = () => {
    // First calculate total market value in HKD (same as table total)
    const totalMarketValueHKD = portfolio.reduce((sum, position) => {
      return sum + convertToHKD(position.marketValue, position.currency);
    }, 0);
    
    // Convert HKD to USD using the inverse of USD to HKD rate
    // exchangeRates['USD'] contains the USD to HKD rate, so we divide by it to get HKD to USD
    const usdToHkdRate = exchangeRates['USD'] || 7.8; // Fallback rate if not available
    return totalMarketValueHKD / usdToHkdRate;
  };

  const calculateCashMarketValueUSD = () => {
    return cashBalances.reduce((sum, cash) => {
      return sum + (cash.marketValueUSD || cash.marketValueHKD);
    }, 0);
  };

  const getSortedPortfolio = () => {
    const sorted = [...portfolio].sort((a, b) => {
      let aValue: any;
      let bValue: any;

      switch (sortField) {
        case 'pnlPercent':
          aValue = calculatePnLPercentage(a.unrealizedPNL, a.marketValue);
          bValue = calculatePnLPercentage(b.unrealizedPNL, b.marketValue);
          break;
        case 'marketValue':
          aValue = convertToHKD(a.marketValue, a.currency);
          bValue = convertToHKD(b.marketValue, b.currency);
          break;
        case 'unrealizedPNL':
          aValue = convertToHKD(a.unrealizedPNL, a.currency);
          bValue = convertToHKD(b.unrealizedPNL, b.currency);
          break;
        case 'country':
          aValue = getCountryFromExchange(a);
          bValue = getCountryFromExchange(b);
          break;
        case 'industry':
          aValue = a.industry || 'N/A';
          bValue = b.industry || 'N/A';
          break;
        case 'category':
          aValue = a.category || 'N/A';
          bValue = b.category || 'N/A';
          break;
        case 'dayChange':
          aValue = a.dayChange || 0;
          bValue = b.dayChange || 0;
          break;
        case 'dayChangePercent':
          aValue = a.dayChangePercent || 0;
          bValue = b.dayChangePercent || 0;
          break;

        default:
          aValue = a[sortField];
          bValue = b[sortField];
      }

      if (typeof aValue === 'string') {
        return sortDirection === 'asc'
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      }

      return sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
    });

    return sorted;
  };

  const getCountryFromExchange = (position: PortfolioPosition) => {
    // Use country from contract details if available
    if (position.country) {
      return position.country;
    }

    const ex = (position.primaryExchange || position.exchange || '').toUpperCase();

    const countryMap: Record<string, string> = {
      'NASDAQ': 'USA',
      'NYSE': 'USA',
      'ARCA': 'USA',
      'AMEX': 'USA',
      'BATS': 'USA',
      'IEX': 'USA',
      'ISLAND': 'USA',
      'SEHK': 'Hong Kong',
      'HKFE': 'Hong Kong',
      'LSE': 'UK',
      'TSE': 'Japan',
      'SGX': 'Singapore',
      'ASX': 'Australia',
      'TSX': 'Canada',
      'TSEJ': 'Japan',
      'FWB': 'Germany',
      'SWB': 'Germany',
      'IBIS': 'Germany',
      'AEB': 'Netherlands',
      'SBF': 'France',
      'VSE': 'Austria',
      'KSE': 'South Korea',
    };

    // Check for exact match first
    if (countryMap[ex]) {
      return countryMap[ex];
    }

    // Check for partial match
    for (const [key, country] of Object.entries(countryMap)) {
      if (ex.includes(key)) return country;
    }

    // Fallback to currency-based guess
    const currencyMap: Record<string, string> = {
      'USD': 'USA',
      'HKD': 'Hong Kong',
      'GBP': 'UK',
      'JPY': 'Japan',
      'SGD': 'Singapore',
      'AUD': 'Australia',
      'CAD': 'Canada',
      'EUR': 'Europe',
      'KRW': 'South Korea',
    };

    if (position.currency && currencyMap[position.currency]) {
      return currencyMap[position.currency];
    }

    return ex || 'N/A';
  };

  const SortableHeader = ({ field, children }: { field: SortField; children: React.ReactNode }) => (
    <div
      className="cursor-pointer hover:bg-muted/50 select-none flex items-center gap-1"
      onClick={() => handleSort(field)}
    >
      {children}
      {sortField === field && (
        <span className="text-xs">
          {sortDirection === 'asc' ? '↑' : '↓'}
        </span>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Account Overview & Portfolio */}
      <Card className="bg-gradient-card border-border shadow-card">
        <CardHeader>
          <div className="flex flex-col gap-3">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-primary" />
                Interactive Broker Portfolio
              </CardTitle>
              <div className="flex items-center gap-2">
                <Button
                  onClick={() => setIsConfigDialogOpen(true)}
                  variant="outline"
                  size="sm"
                  className="flex items-center gap-2"
                >
                  <Settings className="h-4 w-4" />
                  Configure
                </Button>

                <Button
                  onClick={handleRefreshAll}
                  disabled={isConnecting || isLoadingPortfolio}
                  size="sm"
                  className="flex items-center gap-2 w-fit"
                >
                  {(isConnecting || isLoadingPortfolio) ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4" />
                  )}
                  {(isConnecting || isLoadingPortfolio) ? 'Refreshing...' : 'Refresh Portfolio'}
                </Button>
              </div>
            </div>
            <CardDescription>
              Account summary and holdings{lastUpdated && ` (Last updated: ${lastUpdated})`}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-6 px-4 sm:px-6">
          {/* Account Balance Summary */}
          {accountBalance !== null ? (
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between p-3 bg-background/30 rounded-lg min-w-0 max-w-sm w-full">
                <div className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-primary flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="font-medium text-foreground text-sm">Total Account Value</p>
                    <p className="text-xs text-muted-foreground">Net Liquidation</p>
                  </div>
                </div>
                <div className="text-right ml-2">
                  <p className="text-lg font-bold text-foreground whitespace-nowrap">
                    {formatCurrency(netLiquidation || accountBalance, accountCurrency || baseCurrency)}
                  </p>
                  {accountCurrency && accountCurrency !== baseCurrency && (
                    <p className="text-xs text-muted-foreground">{accountCurrency}</p>
                  )}
                </div>
              </div>

              {totalCashValue !== null && (
                <div className="flex items-center justify-between p-3 bg-background/30 rounded-lg min-w-0 max-w-sm w-full">
                  <div className="flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-primary flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="font-medium text-foreground text-sm">Cash Balance</p>
                      <p className="text-xs text-muted-foreground">Available cash</p>
                    </div>
                  </div>
                  <div className="text-right ml-2">
                    <p className="text-lg font-bold text-foreground whitespace-nowrap">
                      {formatCurrency(totalCashValue, accountCurrency || baseCurrency)}
                    </p>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-4 text-center bg-background/30 rounded-lg max-w-sm w-full">
              <DollarSign className="h-8 w-8 text-muted-foreground mb-2" />
              <h3 className="text-sm font-medium text-foreground mb-1">No Account Data</h3>
              <p className="text-xs text-muted-foreground">
                Click "Refresh Portfolio" to load your account information
              </p>
            </div>
          )}

          {/* Portfolio Positions */}
          <div className="border-t pt-6 -mx-4 sm:mx-0">
            <div className="flex items-center justify-between mb-4 px-4 sm:px-0">
              <div className="flex items-center gap-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <Activity className="h-5 w-5 text-primary" />
                  Positions
                </h3>
                {portfolio.length > 0 && (
                  <div className="text-sm text-muted-foreground">
                    Market Value (USD): <span className="font-medium text-foreground">{formatCurrency(calculatePortfolioMarketValueUSD(), 'USD')}</span>
                  </div>
                )}
              </div>
              <p className="text-xs text-muted-foreground sm:hidden">
                Scroll →
              </p>
            </div>
            {portfolio.length > 0 ? (
              <div className="w-full overflow-x-auto">
                <Table className="w-full text-sm">
                  <TableHeader>
                    <TableRow className="text-xs">
                      <TableHead className="sticky left-0 z-10 border-r px-2 w-20 min-w-[80px] bg-background">
                        <SortableHeader field="symbol">Symbol</SortableHeader>
                      </TableHead>
                      <TableHead className="px-2 w-20">
                        <SortableHeader field="dayChangePercent">
                          <div className="text-right w-full">
                            <div>Chg</div>
                            <div>Chg %</div>
                          </div>
                        </SortableHeader>
                      </TableHead>
                      <TableHead className="px-2 w-24">
                        <SortableHeader field="averageCost">
                          <div className="text-right w-full">Avg Cost</div>
                        </SortableHeader>
                      </TableHead>
                      <TableHead className="px-2 w-16">
                        <SortableHeader field="position">
                          <div className="text-right w-full">Qty</div>
                        </SortableHeader>
                      </TableHead>
                      <TableHead className="px-2 w-24">
                        <SortableHeader field="marketPrice">
                          <div className="text-right w-full">Current Price</div>
                        </SortableHeader>
                      </TableHead>
                      <TableHead className="px-2">
                        <SortableHeader field="pnlPercent">
                          <div className="text-right w-full min-w-[90px]">
                            <div>Unrealized P&L</div>
                            <div>P&L %</div>
                          </div>
                        </SortableHeader>
                      </TableHead>
                      <TableHead className="px-2">
                        <div className="text-right w-full min-w-[90px]">P&L ({baseCurrency})</div>
                      </TableHead>
                      <TableHead className="px-2">
                        <SortableHeader field="marketValue">
                          <div className="text-right w-full min-w-[100px]">Market Value ({baseCurrency})</div>
                        </SortableHeader>
                      </TableHead>
                      <TableHead className="px-2 w-16">
                        <SortableHeader field="secType">
                          <div className="text-center w-full">Type</div>
                        </SortableHeader>
                      </TableHead>
                      <TableHead className="px-2 w-20">
                        <SortableHeader field="country">
                          <div className="text-center w-full">Country</div>
                        </SortableHeader>
                      </TableHead>
                      <TableHead className="px-2 w-24">
                        <SortableHeader field="industry">
                          <div className="text-center w-full">Industry</div>
                        </SortableHeader>
                      </TableHead>
                      <TableHead className="px-2 w-24">
                        <SortableHeader field="category">
                          <div className="text-center w-full">Category</div>
                        </SortableHeader>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {getSortedPortfolio().map((position, index) => {
                      const pnlPercentage = calculatePnLPercentage(position.unrealizedPNL, position.marketValue);
                      const pnlInHKD = convertToHKD(position.unrealizedPNL, position.currency);
                      const marketValueInHKD = convertToHKD(position.marketValue, position.currency);
                      const isPositive = position.unrealizedPNL >= 0;
                      const isDayChangePositive = (position.dayChange || 0) >= 0;

                      return (
                        <TableRow key={index} className="text-xs">
                          <TableCell className="sticky left-0 z-10 border-r font-medium whitespace-nowrap px-2 bg-background">
                            {position.symbol}
                          </TableCell>
                          <TableCell className={`text-right font-medium whitespace-nowrap px-2 ${isDayChangePositive ? 'text-profit' : 'text-loss'}`}>
                            {position.dayChange !== undefined && position.dayChangePercent !== undefined ? (
                              <div className="flex flex-col items-end gap-0">
                                <div className="flex items-center justify-end gap-1">
                                  {isDayChangePositive ? (
                                    <TrendingUp className="h-3 w-3" />
                                  ) : (
                                    <TrendingDown className="h-3 w-3" />
                                  )}
                                  {formatCurrency(position.dayChange, position.currency)}
                                </div>
                                <div className="flex items-center justify-end gap-1">
                                  {position.dayChangePercent.toFixed(2)}%
                                </div>
                              </div>
                            ) : (
                              'N/A'
                            )}
                          </TableCell>
                          <TableCell className="text-right whitespace-nowrap px-2">
                            {formatCurrency(position.averageCost, position.currency)}
                          </TableCell>
                          <TableCell className="text-right whitespace-nowrap px-2">{position.position.toLocaleString()}</TableCell>
                          <TableCell className="text-right whitespace-nowrap px-2">
                            {formatCurrency(position.marketPrice, position.currency)}
                          </TableCell>
                          <TableCell className={`text-right font-medium whitespace-nowrap px-2 ${isPositive ? 'text-profit' : 'text-loss'}`}>
                            <div className="flex flex-col items-end gap-0">
                              <div className="flex items-center justify-end gap-1">
                                {isPositive ? (
                                  <TrendingUp className="h-3 w-3" />
                                ) : (
                                  <TrendingDown className="h-3 w-3" />
                                )}
                                {formatCurrency(position.unrealizedPNL, position.currency)}
                              </div>
                              <div className="flex items-center justify-end gap-1">
                                {pnlPercentage.toFixed(2)}%
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className={`text-right font-medium whitespace-nowrap px-2 ${isPositive ? 'text-profit' : 'text-loss'}`}>
                            {formatCurrency(pnlInHKD, baseCurrency)}
                          </TableCell>
                          <TableCell className="text-right font-medium whitespace-nowrap px-2">
                            {formatCurrency(marketValueInHKD, baseCurrency)}
                          </TableCell>
                          <TableCell className="text-center text-xs px-2">{position.secType}</TableCell>
                          <TableCell className="text-center text-xs px-2">{getCountryFromExchange(position)}</TableCell>
                          <TableCell className="text-center text-xs px-2 truncate" title={position.industry || 'N/A'}>
                            {position.industry || 'N/A'}
                          </TableCell>
                          <TableCell className="text-center text-xs px-2 truncate" title={position.category || 'N/A'}>
                            {position.category || 'N/A'}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {/* Totals Row */}
                    <TableRow className="bg-muted/50 font-semibold border-t-2 text-xs">
                      <TableCell className="sticky left-0 z-10 border-r text-left whitespace-nowrap font-bold px-2 bg-muted/50">
                        Total:
                      </TableCell>
                      <TableCell className={`text-right font-bold whitespace-nowrap px-2 ${calculateTotals().totalDayChangeHKD >= 0 ? 'text-profit' : 'text-loss'}`}>
                        <div className="flex flex-col items-end gap-0">
                          <div className="flex items-center justify-end gap-1">
                            {calculateTotals().totalDayChangeHKD >= 0 ? (
                              <TrendingUp className="h-3 w-3" />
                            ) : (
                              <TrendingDown className="h-3 w-3" />
                            )}
                            {formatCurrency(calculateTotals().totalDayChangeHKD, baseCurrency)}
                          </div>
                          <div className="flex items-center justify-end gap-1">
                            {calculateTotals().totalDayChangePercent.toFixed(2)}%
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="px-2"></TableCell>
                      <TableCell className="px-2"></TableCell>
                      <TableCell className="px-2"></TableCell>
                      <TableCell className={`text-right font-bold whitespace-nowrap px-2 ${calculateTotals().totalPnLHKD >= 0 ? 'text-profit' : 'text-loss'}`}>
                        <div className="flex flex-col items-end gap-0">
                          <div className="flex items-center justify-end gap-1">
                            {calculateTotals().totalPnLHKD >= 0 ? (
                              <TrendingUp className="h-3 w-3" />
                            ) : (
                              <TrendingDown className="h-3 w-3" />
                            )}
                            {formatCurrency(calculateTotals().totalPnLHKD, baseCurrency)}
                          </div>
                          <div>
                            {/* P&L % calculation for total would go here if needed */}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className={`text-right font-bold whitespace-nowrap px-2 ${calculateTotals().totalPnLHKD >= 0 ? 'text-profit' : 'text-loss'}`}>
                        {formatCurrency(calculateTotals().totalPnLHKD, baseCurrency)}
                      </TableCell>
                      <TableCell className="text-right font-bold whitespace-nowrap px-2">
                        {formatCurrency(calculateTotals().totalMarketValueHKD, baseCurrency)}
                      </TableCell>
                      <TableCell className="px-2"></TableCell>
                      <TableCell className="px-2"></TableCell>
                      <TableCell className="px-2"></TableCell>
                      <TableCell className="px-2"></TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-center bg-background/30 rounded-lg">
                <Activity className="h-10 w-10 text-muted-foreground mb-3" />
                <h3 className="text-base font-medium text-foreground mb-1">No Positions</h3>
                <p className="text-sm text-muted-foreground">
                  Click "Refresh Portfolio" to load your holdings
                </p>
              </div>
            )}
          </div>

          {/* Cash Currency Balances */}
          <div className="border-t pt-6 -mx-4 sm:mx-0">
            <div className="flex items-center gap-4 mb-4 px-4 sm:px-0">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-primary" />
                Cash Balances
              </h3>
              {cashBalances.length > 0 && (
                <div className="text-sm text-muted-foreground">
                  Market Value (USD): <span className="font-medium text-foreground">{formatCurrency(calculateCashMarketValueUSD(), 'USD')}</span>
                </div>
              )}
            </div>
            {cashBalances.length > 0 ? (
              <div className="overflow-x-auto">
                <Table className="text-sm w-auto">
                  <TableHeader>
                    <TableRow className="text-xs">
                      <TableHead className="px-3 text-left">Currency</TableHead>
                      <TableHead className="px-3 text-right">Amount</TableHead>
                      <TableHead className="px-3 text-right">Market Value (USD)</TableHead>
                      <TableHead className="px-3 text-right">Market Value ({baseCurrency})</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {cashBalances.map((cash, index) => {
                      const marketValueInHKD = convertToHKD(cash.marketValueHKD, cash.currency);
                      const marketValueUSD = cash.marketValueUSD || cash.marketValueHKD;

                      return (
                        <TableRow key={index} className="text-xs">
                          <TableCell className="font-medium px-3">
                            {cash.currency}
                          </TableCell>
                          <TableCell className="text-right px-3 whitespace-nowrap">
                            {formatCurrency(cash.amount, cash.currency)}
                          </TableCell>
                          <TableCell className="text-right px-3 whitespace-nowrap">
                            {formatCurrency(marketValueUSD, 'USD')}
                          </TableCell>
                          <TableCell className="text-right font-medium px-3 whitespace-nowrap">
                            {formatCurrency(marketValueInHKD, baseCurrency)}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {/* Total Row */}
                    <TableRow className="bg-muted/50 font-semibold border-t-2 text-xs">
                      <TableCell className="text-left font-bold px-3">
                        Total:
                      </TableCell>
                      <TableCell className="px-3"></TableCell>
                      <TableCell className="text-right font-bold px-3 whitespace-nowrap">
                        {formatCurrency(
                          cashBalances.reduce((sum, cash) => {
                            return sum + (cash.marketValueUSD || cash.marketValueHKD);
                          }, 0),
                          'USD'
                        )}
                      </TableCell>
                      <TableCell className="text-right font-bold px-3 whitespace-nowrap">
                        {formatCurrency(
                          cashBalances.reduce((sum, cash) => {
                            return sum + convertToHKD(cash.marketValueHKD, cash.currency);
                          }, 0),
                          baseCurrency
                        )}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-center bg-background/30 rounded-lg">
                <DollarSign className="h-10 w-10 text-muted-foreground mb-3" />
                <h3 className="text-base font-medium text-foreground mb-1">No Cash Balances</h3>
                <p className="text-sm text-muted-foreground">
                  {portfolio.length > 0 
                    ? "Cash balances may be included in your total account value above"
                    : "Click \"Refresh Portfolio\" to load your cash positions"
                  }
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* IB Configuration Dialog */}
      <IBConfigDialog
        open={isConfigDialogOpen}
        onOpenChange={setIsConfigDialogOpen}
        onSettingsSaved={loadConnectionSettings}
      />
    </div>
  );
};

export default IBPortfolioView;