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
  TrendingDown
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiClient } from "@/services/api";

interface IntegrationViewProps {
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

type SortField = 'symbol' | 'secType' | 'currency' | 'position' | 'averageCost' | 'marketPrice' | 'pnlPercent' | 'unrealizedPNL' | 'marketValue' | 'country' | 'industry' | 'category' | 'dayChange' | 'dayChangePercent';
type SortDirection = 'asc' | 'desc';

const IntegrationView = ({ baseCurrency, onAccountUpdate }: IntegrationViewProps) => {
  const { toast } = useToast();
  const [isConnecting, setIsConnecting] = useState(false);
  const [accountBalance, setAccountBalance] = useState<number | null>(null);
  const [netLiquidation, setNetLiquidation] = useState<number | null>(null);
  const [totalCashValue, setTotalCashValue] = useState<number | null>(null);
  const [accountCurrency, setAccountCurrency] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [portfolio, setPortfolio] = useState<PortfolioPosition[]>([]);
  const [isLoadingPortfolio, setIsLoadingPortfolio] = useState(false);
  const [exchangeRates, setExchangeRates] = useState<Record<string, number>>({});
  const [sortField, setSortField] = useState<SortField>('symbol');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [connectionSettings, setConnectionSettings] = useState({
    host: 'localhost',
    port: 7497,
    clientId: 1
  });

  // Load connection settings and initial data from server on mount
  useEffect(() => {
    const loadConnectionSettings = async () => {
      try {
        const response = await apiClient.getIBSettings();
        if (response.data) {
          setConnectionSettings(response.data);
        }
      } catch (error) {
        console.error('Failed to load IB settings:', error);
      }
    };
    loadConnectionSettings();
  }, []);

  // Load cached portfolio data on mount
  useEffect(() => {
    const loadInitialData = async () => {
      console.log('🔄 Loading initial cached data...');
      
      try {
        console.log('📊 Trying to load cached balance...');
        const balanceResponse = await apiClient.getIBBalance();
        if (balanceResponse.data) {
          console.log('✅ Found cached balance:', balanceResponse.data);
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
        console.log('Portfolio response:', portfolioResponse);
        
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
      throw error;
    } finally {
      setIsConnecting(false);
    }
  };

  const handleRefreshAll = async () => {
    setIsConnecting(true);
    setIsLoadingPortfolio(true);
    
    try {
      // Force refresh both balance and portfolio to get fresh data
      const [balanceResponse, portfolioResponse] = await Promise.all([
        apiClient.forceRefreshIBBalance(),
        apiClient.forceRefreshIBPortfolio()
      ]);
      
      console.log('Balance response:', balanceResponse);
      console.log('Portfolio response:', portfolioResponse);
      
      // Check for errors in responses - check error first before checking data
      if (balanceResponse.error) {
        console.error('Balance error detected:', balanceResponse.error);
        throw new Error(balanceResponse.error);
      }
      
      if (portfolioResponse.error) {
        console.error('Portfolio error detected:', portfolioResponse.error);
        throw new Error(portfolioResponse.error);
      }
      
      // Verify we have data
      if (!balanceResponse.data) {
        throw new Error("No balance data received from server");
      }
      
      if (!portfolioResponse.data) {
        throw new Error("No portfolio data received from server");
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

  // Helper function to update the Interactive Broker account balance
  const updateIBAccountBalance = async (balance: number, currency: string) => {
    try {
      console.log('🔄 Updating Interactive Broker HK account balance...');
      // Get all accounts to find the Interactive Broker HK account
      const accountsResponse = await apiClient.getAccounts();
      if (accountsResponse.data) {
        // Find the Interactive Broker HK account (case-insensitive search)
        const ibAccount = accountsResponse.data.find((acc: any) => 
          acc.name.toLowerCase().includes('interactive broker') && 
          acc.name.toLowerCase().includes('hk')
        );
        
        if (ibAccount) {
          console.log(`📝 Found IB account (ID: ${ibAccount.id}), current balance: ${ibAccount.currentBalance}, new balance: ${balance}`);
          console.log(`📅 Current lastUpdated: ${ibAccount.lastUpdated}`);
          
          // Update the account balance (this will automatically update last_updated timestamp)
          const updateResponse = await apiClient.updateAccount(ibAccount.id, {
            currentBalance: balance
          });
          
          console.log(`✅ Updated Interactive Broker HK account balance to ${balance} ${currency}`);
          console.log(`📅 New lastUpdated: ${updateResponse.data?.lastUpdated}`);
          
          // Trigger account update callback if provided
          if (onAccountUpdate) {
            console.log('🔄 Triggering account update callback...');
            await onAccountUpdate();
            console.log('✅ Account update callback completed');
          }
        } else {
          console.log('ℹ️ Interactive Broker HK account not found in accounts list');
        }
      }
    } catch (error) {
      console.error('❌ Failed to update Interactive Broker account balance:', error);
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
    <TableHead 
      className="cursor-pointer hover:bg-muted/50 select-none"
      onClick={() => handleSort(field)}
    >
      <div className="flex items-center gap-1">
        {children}
        {sortField === field && (
          <span className="text-xs">
            {sortDirection === 'asc' ? '↑' : '↓'}
          </span>
        )}
      </div>
    </TableHead>
  );

  return (
    <div className="space-y-6">
      {/* Account Overview & Portfolio */}
      <Card className="bg-gradient-card border-border shadow-card">
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-primary" />
                Interactive Broker Portfolio
              </CardTitle>
              <CardDescription>
                Account summary and holdings
              </CardDescription>
            </div>
            <div className="flex flex-col items-end gap-2">
              <Button
                onClick={handleRefreshAll}
                disabled={isConnecting || isLoadingPortfolio}
                size="sm"
                className="flex items-center gap-2 w-full sm:w-auto"
              >
                {(isConnecting || isLoadingPortfolio) ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                {(isConnecting || isLoadingPortfolio) ? 'Refreshing...' : 'Refresh Portfolio'}
              </Button>
              {lastUpdated && (
                <p className="text-xs text-muted-foreground">
                  Last updated: {lastUpdated}
                </p>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6 px-4 sm:px-6">
          {/* Account Balance Summary */}
          {accountBalance !== null ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex items-center justify-between p-4 bg-background/30 rounded-lg">
                <div className="flex items-center gap-3">
                  <DollarSign className="h-5 w-5 text-primary" />
                  <div>
                    <p className="font-medium text-foreground">Total Account Value</p>
                    <p className="text-xs text-muted-foreground">Net Liquidation</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xl font-bold text-foreground">
                    {formatCurrency(netLiquidation || accountBalance, accountCurrency || baseCurrency)}
                  </p>
                  {accountCurrency && accountCurrency !== baseCurrency && (
                    <p className="text-xs text-muted-foreground">{accountCurrency}</p>
                  )}
                </div>
              </div>

              {totalCashValue !== null && (
                <div className="flex items-center justify-between p-4 bg-background/30 rounded-lg">
                  <div className="flex items-center gap-3">
                    <DollarSign className="h-5 w-5 text-primary" />
                    <div>
                      <p className="font-medium text-foreground">Cash Balance</p>
                      <p className="text-xs text-muted-foreground">Available cash</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-bold text-foreground">
                      {formatCurrency(totalCashValue, accountCurrency || baseCurrency)}
                    </p>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-6 text-center bg-background/30 rounded-lg">
              <DollarSign className="h-10 w-10 text-muted-foreground mb-3" />
              <h3 className="text-base font-medium text-foreground mb-1">No Account Data</h3>
              <p className="text-sm text-muted-foreground">
                Click "Refresh Portfolio" to load your account information
              </p>
            </div>
          )}

          {/* Portfolio Positions */}
          <div className="border-t pt-6 -mx-4 sm:mx-0">
            <div className="flex items-center justify-between mb-4 px-4 sm:px-0">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Activity className="h-5 w-5 text-primary" />
                Positions
              </h3>
              <p className="text-xs text-muted-foreground sm:hidden">
                Scroll →
              </p>
            </div>
            {portfolio.length > 0 ? (
            <div className="w-full overflow-x-auto">
              <Table className="w-full text-sm sm:text-base">
                <TableHeader>
                  <TableRow className="text-xs sm:text-sm">
                    <SortableHeader field="symbol">Symbol</SortableHeader>
                    <SortableHeader field="dayChange">
                      <div className="text-right w-full">Chg</div>
                    </SortableHeader>
                    <SortableHeader field="dayChangePercent">
                      <div className="text-right w-full">Chg %</div>
                    </SortableHeader>
                    <SortableHeader field="secType">Type</SortableHeader>
                    <SortableHeader field="country">Country</SortableHeader>
                    <SortableHeader field="industry">Industry</SortableHeader>
                    <SortableHeader field="category">Category</SortableHeader>
                    <SortableHeader field="currency">Curr.</SortableHeader>
                    <SortableHeader field="position">
                      <div className="text-right w-full">Qty</div>
                    </SortableHeader>
                    <SortableHeader field="averageCost">
                      <div className="text-right w-full">Avg Cost</div>
                    </SortableHeader>
                    <SortableHeader field="marketPrice">
                      <div className="text-right w-full">Current Price</div>
                    </SortableHeader>
                    <SortableHeader field="pnlPercent">
                      <div className="text-right w-full">P&L %</div>
                    </SortableHeader>
                    <SortableHeader field="unrealizedPNL">
                      <div className="text-right w-full">P&L (Currency)</div>
                    </SortableHeader>
                    <TableHead className="text-right">P&L ({baseCurrency})</TableHead>
                    <SortableHeader field="marketValue">
                      <div className="text-right w-full">Market Value ({baseCurrency})</div>
                    </SortableHeader>
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
                      <TableRow key={index} className="text-xs sm:text-sm">
                        <TableCell className="font-medium whitespace-nowrap">{position.symbol}</TableCell>
                        <TableCell className={`text-right font-medium whitespace-nowrap ${isDayChangePositive ? 'text-profit' : 'text-loss'}`}>
                          {position.dayChange !== undefined ? (
                            <div className="flex items-center justify-end gap-1 whitespace-nowrap">
                              {isDayChangePositive ? (
                                <TrendingUp className="h-3 w-3" />
                              ) : (
                                <TrendingDown className="h-3 w-3" />
                              )}
                              {formatCurrency(position.dayChange, position.currency)}
                            </div>
                          ) : (
                            'N/A'
                          )}
                        </TableCell>
                        <TableCell className={`text-right font-medium whitespace-nowrap ${isDayChangePositive ? 'text-profit' : 'text-loss'}`}>
                          {position.dayChangePercent !== undefined ? (
                            <div className="flex items-center justify-end gap-1 whitespace-nowrap">
                              {isDayChangePositive ? (
                                <TrendingUp className="h-3 w-3" />
                              ) : (
                                <TrendingDown className="h-3 w-3" />
                              )}
                              {position.dayChangePercent.toFixed(2)}%
                            </div>
                          ) : (
                            'N/A'
                          )}
                        </TableCell>
                        <TableCell className="font-medium">{position.secType}</TableCell>
                        <TableCell className="whitespace-nowrap">{getCountryFromExchange(position)}</TableCell>
                        <TableCell className="text-xs sm:text-sm max-w-[120px] truncate" title={position.industry || 'N/A'}>{position.industry || 'N/A'}</TableCell>
                        <TableCell className="text-xs sm:text-sm max-w-[120px] truncate" title={position.category || 'N/A'}>{position.category || 'N/A'}</TableCell>
                        <TableCell className="whitespace-nowrap">{position.currency}</TableCell>
                        <TableCell className="text-right whitespace-nowrap">{position.position.toLocaleString()}</TableCell>
                        <TableCell className="text-right whitespace-nowrap">
                          {formatCurrency(position.averageCost, position.currency)}
                        </TableCell>
                        <TableCell className="text-right whitespace-nowrap">
                          {formatCurrency(position.marketPrice, position.currency)}
                        </TableCell>
                        <TableCell className={`text-right font-medium whitespace-nowrap ${isPositive ? 'text-profit' : 'text-loss'}`}>
                          <div className="flex items-center justify-end gap-1 whitespace-nowrap">
                            {isPositive ? (
                              <TrendingUp className="h-4 w-4" />
                            ) : (
                              <TrendingDown className="h-4 w-4" />
                            )}
                            {pnlPercentage.toFixed(2)}%
                          </div>
                        </TableCell>
                        <TableCell className={`text-right font-medium whitespace-nowrap ${isPositive ? 'text-profit' : 'text-loss'}`}>
                          {formatCurrency(position.unrealizedPNL, position.currency)}
                        </TableCell>
                        <TableCell className={`text-right font-medium whitespace-nowrap ${isPositive ? 'text-profit' : 'text-loss'}`}>
                          {formatCurrency(pnlInHKD, baseCurrency)}
                        </TableCell>
                        <TableCell className="text-right font-medium whitespace-nowrap">
                          {formatCurrency(marketValueInHKD, baseCurrency)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                    {/* Totals Row */}
                    <TableRow className="bg-muted/50 font-semibold border-t-2 text-xs sm:text-sm">
                      <TableCell className="text-left whitespace-nowrap font-bold">Total:</TableCell>
                      <TableCell className={`text-right font-bold whitespace-nowrap ${calculateTotals().totalDayChangeHKD >= 0 ? 'text-profit' : 'text-loss'}`}>
                        <div className="flex items-center justify-end gap-1 whitespace-nowrap">
                          {calculateTotals().totalDayChangeHKD >= 0 ? (
                            <TrendingUp className="h-4 w-4" />
                          ) : (
                            <TrendingDown className="h-4 w-4" />
                          )}
                          {formatCurrency(calculateTotals().totalDayChangeHKD, baseCurrency)}
                        </div>
                      </TableCell>
                      <TableCell className={`text-right font-bold whitespace-nowrap ${calculateTotals().totalDayChangePercent >= 0 ? 'text-profit' : 'text-loss'}`}>
                        <div className="flex items-center justify-end gap-1 whitespace-nowrap">
                          {calculateTotals().totalDayChangePercent >= 0 ? (
                            <TrendingUp className="h-4 w-4" />
                          ) : (
                            <TrendingDown className="h-4 w-4" />
                          )}
                          {calculateTotals().totalDayChangePercent.toFixed(2)}%
                        </div>
                      </TableCell>
                      <TableCell colSpan={10}></TableCell>
                      <TableCell className={`text-right font-bold whitespace-nowrap ${calculateTotals().totalPnLHKD >= 0 ? 'text-profit' : 'text-loss'}`}>
                        {formatCurrency(calculateTotals().totalPnLHKD, baseCurrency)}
                      </TableCell>
                      <TableCell className="text-right font-bold whitespace-nowrap">
                        {formatCurrency(calculateTotals().totalMarketValueHKD, baseCurrency)}
                      </TableCell>
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
        </CardContent>
      </Card>
    </div>
  );
};

export default IntegrationView;