import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent } from "@/components/ui/chart";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  PlusCircle, 
  BarChart3, 
  ArrowUpRight, 
  ArrowDownRight,
  Wallet,
  ArrowLeftRight,
  Zap,
  PiggyBank,
  Landmark,
  Building,
  PieChart as PieChartIcon,
  RefreshCw
} from "lucide-react";
import Sidebar from "./Sidebar";
import AccountsView from "./AccountsView";
import CurrencyView from "./CurrencyView";
import IBPortfolioView from "./IBPortfolioView";
import OtherPortfolioView from "./OtherPortfolioView";
import OtherAssetsView from "./OtherAssetsView";
import { useAuth } from "@/contexts/AuthContext";
import { apiClient } from "@/services/api";
import { useToast } from "@/hooks/use-toast";

// Interface definitions
interface Account {
  id: number;
  userId: number;
  name: string;
  currency: string;
  accountType: string;
  accountNumber?: string;
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

interface DashboardProps {
  onLogout: () => void;
  sidebarOpen: boolean;
  onSidebarToggle: () => void;
}

const Dashboard = ({ onLogout, sidebarOpen, onSidebarToggle }: DashboardProps) => {
  // Call hooks first, before any conditional logic
  const { user } = useAuth();
  const { toast } = useToast();
  
  // Initialize currentView from localStorage or default to "overview"
  const [currentView, setCurrentView] = useState(() => {
    const savedView = localStorage.getItem('dashboard-current-view');
    return savedView || "overview";
  });
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [isLoadingAccounts, setIsLoadingAccounts] = useState(false);
  const [exchangeRates, setExchangeRates] = useState<Record<string, number>>({});
  const [currencies, setCurrencies] = useState<any[]>([]);
  const [otherAssets, setOtherAssets] = useState<any[]>([]);
  const [ibPortfolio, setIbPortfolio] = useState<any[]>([]);
  const [ibCashBalances, setIbCashBalances] = useState<any[]>([]);
  const [otherPortfolio, setOtherPortfolio] = useState<any[]>([]);
  const [otherCashBalances, setOtherCashBalances] = useState<any[]>([]);
  const [performanceHistory, setPerformanceHistory] = useState<any[]>([]);
  const [isLoadingPerformance, setIsLoadingPerformance] = useState(false);
  const [showPerformanceDetails, setShowPerformanceDetails] = useState(true);
  const [performancePage, setPerformancePage] = useState(0);
  const [allPerformanceData, setAllPerformanceData] = useState<any[]>([]);
  const [performanceDays, setPerformanceDays] = useState(() => {
    const saved = localStorage.getItem('dashboard-performance-days');
    return saved ? parseInt(saved, 10) : 30;
  });
  
  // Pagination constants
  const ITEMS_PER_PAGE = 30;
  
  // Get filtered performance data based on selected days
  const getFilteredPerformanceData = () => {
    if (performanceDays === 0) return allPerformanceData; // Show all data
    return allPerformanceData.slice(0, performanceDays);
  };

  // Get paginated performance data with previous day data
  const getPaginatedPerformanceData = () => {
    const filteredData = getFilteredPerformanceData();
    const startIndex = performancePage * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    
    // Create a map for quick lookup of previous day data
    const dataByDate = new Map();
    allPerformanceData.forEach(item => {
      dataByDate.set(item.date, item);
    });
    
    return filteredData.slice(startIndex, endIndex).map(row => {
      // Find the chronologically previous day
      const currentDate = new Date(row.date);
      let prev = null;
      
      // Look for the most recent previous day in the data
      for (const item of allPerformanceData) {
        const itemDate = new Date(item.date);
        if (itemDate.getTime() < currentDate.getTime()) {
          if (!prev || new Date(item.date).getTime() > new Date(prev.date).getTime()) {
            prev = item;
          }
        }
      }
      
      return { ...row, prev };
    });
  };
  
  const filteredDataLength = getFilteredPerformanceData().length;
  const totalPages = Math.ceil(filteredDataLength / ITEMS_PER_PAGE);
  const canGoPrevious = performancePage > 0;
  const canGoNext = performancePage < totalPages - 1;
  
  const [showQuickUpdateDialog, setShowQuickUpdateDialog] = useState(false);
  const [quickUpdateAmounts, setQuickUpdateAmounts] = useState<Record<number, string>>({});
  const [isUpdatingBalances, setIsUpdatingBalances] = useState(false);
  const baseCurrency = user?.baseCurrency || "HKD"; // Use user's base currency

  // Update localStorage whenever currentView changes
  useEffect(() => {
    localStorage.setItem('dashboard-current-view', currentView);
  }, [currentView]);

  // Update localStorage whenever performanceDays changes
  useEffect(() => {
    localStorage.setItem('dashboard-performance-days', performanceDays.toString());
  }, [performanceDays]);

  // Load accounts when component mounts and user is authenticated
  useEffect(() => {
    if (user) {
      loadAccounts();
      loadCurrencies();
      loadOtherAssets();
      loadIBPortfolio();
      loadIBCashBalances();
      loadOtherPortfolio();
      loadOtherCashBalances();
    }
  }, [user]);

  // Fetch exchange rates when any data source changes and user is authenticated
  useEffect(() => {
    if (user && (accounts.length > 0 || ibPortfolio.length > 0 || ibCashBalances.length > 0 ||
        otherPortfolio.length > 0 || otherCashBalances.length > 0 || otherAssets.length > 0)) {
      fetchExchangeRates();
    }
  }, [accounts, ibPortfolio, ibCashBalances, otherPortfolio, otherCashBalances, otherAssets, baseCurrency, user]);

  // Removed auto-refresh functionality - users can manually refresh from Currency Exchange page

  // Load performance history function
  const loadPerformanceHistory = async () => {
    try {
      setIsLoadingPerformance(true);
      // Request more data than the max days we'll show (365) to ensure we have enough
      const response = await apiClient.getPerformanceChartData(365); // Get up to 365 days of data
      if (response.data) {
        // Calculate Daily P&L (current day Investment P&L - previous day Investment P&L)
        const sortedForDailyCalc = [...response.data].sort((a: any, b: any) => {
          const da = new Date(a.date).getTime();
          const db = new Date(b.date).getTime();
          return da - db; // Ascending order for calculation
        });
        
        const dataWithDailyPL = sortedForDailyCalc.map((entry: any, index: number) => {
          if (index === 0) {
            // First entry has no previous day, so Daily P&L is 0
            return { ...entry, dailyPL: 0 };
          } else {
            // Daily P&L = current Investment P&L - previous Investment P&L
            const previousEntry = sortedForDailyCalc[index - 1];
            const dailyPL = entry.investmentPL - previousEntry.investmentPL;
            return { ...entry, dailyPL };
          }
        });
        
        // Sort in descending order (newest first) for table display
        const sortedDesc = [...dataWithDailyPL].sort((a: any, b: any) => {
          const da = new Date(a.date).getTime();
          const db = new Date(b.date).getTime();
          return db - da; // Descending order
        });
        setAllPerformanceData(sortedDesc);
        
        // For chart, we still want chronological order (oldest to newest)
        const sortedAsc = [...dataWithDailyPL].sort((a: any, b: any) => {
          const da = new Date(a.date).getTime();
          const db = new Date(b.date).getTime();
          return da - db; // Ascending order for chart
        });
        // Chart will use performanceDays filter, so store all data
        setPerformanceHistory(sortedAsc);
      }
    } catch (error) {
      console.error('Error loading performance history:', error);
      // No fallback - use only server data to avoid overriding correct values
    } finally {
      setIsLoadingPerformance(false);
    }
  };

  // Update today's performance data with current summary data
  // DISABLED: This function is disabled to prevent overriding correct performance data
  const updateTodaysPerformanceData = () => {
    // Function disabled to prevent data override on refresh
    console.log('updateTodaysPerformanceData called but disabled to preserve server data');
    return;
  };

  // Load performance history when component mounts or when user changes
  useEffect(() => {
    if (user) {
      loadPerformanceHistory();
    }
  }, [user]);

  // Note: updateTodaysPerformanceData() is now only called manually when needed
  // to avoid overriding correct performance data on refresh

  // Reset page when performance data or days filter changes
  useEffect(() => {
    setPerformancePage(0);
  }, [allPerformanceData.length, performanceDays]);

  // Load accounts from API
  const loadAccounts = async () => {
    setIsLoadingAccounts(true);
    try {
      const response = await apiClient.getAccounts();
      if (response.data) {
        setAccounts(response.data);
      } else {
        toast({
          title: "Error",
          description: response.error || "Failed to load accounts",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load accounts",
        variant: "destructive",
      });
    } finally {
      setIsLoadingAccounts(false);
    }
  };

  // After an account change, force server to compute today's snapshot then reload chart
  const handlePostAccountUpdate = async () => {
    try {
      await apiClient.calculateTodaySnapshot();
    } catch (e) {
      console.warn('Failed to calculate today snapshot on server, will still refresh chart.');
    } finally {
      await loadPerformanceHistory();
    }
  };

  // Refresh Schwab account balances
  const refreshSchwabAccounts = async () => {
    try {
      // Get Schwab settings to check if configured
      const settingsResponse = await apiClient.getSchwabSettings();
      if (!settingsResponse.data?.has_tokens) {
        // Schwab not configured, skip silently
        console.log('Schwab not configured or no tokens, skipping refresh');
        return;
      }

      console.log('Refreshing Schwab accounts...');

      // Get all Schwab accounts
      const accountsResponse = await apiClient.getSchwabAccounts();
      if (!accountsResponse.data || accountsResponse.data.length === 0) {
        console.log('No Schwab accounts found');
        return;
      }

      console.log(`Found ${accountsResponse.data.length} Schwab accounts`);

      // For each Schwab account, find matching account in our system and refresh
      let refreshedCount = 0;
      for (const schwabAccount of accountsResponse.data) {
        // Find matching account by account number
        const matchingAccount = accounts.find(
          acc => acc.accountNumber === schwabAccount.accountNumber
        );

        if (matchingAccount) {
          console.log(`Refreshing balance for account ${matchingAccount.name} (${schwabAccount.accountNumber})`);
          // Refresh balance for this account
          const balanceResponse = await apiClient.getSchwabAccountBalance(
            schwabAccount.hashValue,
            matchingAccount.id
          );
          
          if (balanceResponse.data) {
            refreshedCount++;
            console.log(`✅ Updated ${matchingAccount.name}: ${balanceResponse.data.currentBalance}`);
          }
        } else {
          console.log(`No matching account found for Schwab account ${schwabAccount.accountNumber}`);
        }
      }

      if (refreshedCount > 0) {
        console.log(`✅ Schwab: Refreshed ${refreshedCount} account(s)`);
      }
    } catch (error) {
      console.warn('Schwab refresh failed:', error);
      // Don't throw - allow other refreshes to continue
    }
  };

  // Handle Quick Update of account balances
  const handleQuickUpdate = async () => {
    setIsUpdatingBalances(true);
    try {
      const updates = [];
      
      // Process each account with a non-empty amount
      for (const account of accounts) {
        const amountStr = quickUpdateAmounts[account.id];
        if (amountStr && amountStr.trim() !== '') {
          const amount = parseFloat(amountStr);
          if (!isNaN(amount)) {
            // Update the account's current balance (this will also add a history entry)
            const response = await apiClient.updateAccount(account.id, {
              currentBalance: amount,
              date: new Date().toISOString().split('T')[0] // Today's date in YYYY-MM-DD format
            });
            
            if (response.error) {
              toast({
                title: "Error",
                description: `Failed to update ${account.name}: ${response.error}`,
                variant: "destructive",
              });
            } else {
              updates.push(account.name);
            }
          }
        }
      }
      
      if (updates.length > 0) {
        toast({
          title: "Success",
          description: `Updated balances for ${updates.length} account(s): ${updates.join(', ')}`,
        });
        
        // Reload accounts and update performance data
        await loadAccounts();
        await handlePostAccountUpdate();
        // Update today's performance data only when accounts are actually updated
        updateTodaysPerformanceData();
        
        // Clear the form and close dialog
        setQuickUpdateAmounts({});
        setShowQuickUpdateDialog(false);
      } else {
        toast({
          title: "No Updates",
          description: "Please enter valid amounts for at least one account.",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update account balances",
        variant: "destructive",
      });
    } finally {
      setIsUpdatingBalances(false);
    }
  };

  // Handle amount input change
  const handleAmountChange = (accountId: number, value: string) => {
    setQuickUpdateAmounts(prev => ({
      ...prev,
      [accountId]: value
    }));
  };

  // Load currencies data
  const loadCurrencies = async () => {
    try {
      const response = await apiClient.getCurrencyPairs(false);
      if (response.data) {
        setCurrencies(response.data);
      } else {
        console.error('Failed to load currencies:', response.error);
      }
    } catch (error) {
      console.error('Error loading currencies:', error);
    }
  };

  // Load other assets data
  const loadOtherAssets = async () => {
    try {
      const response = await apiClient.getOtherAssets();
      if (response.data) {
        setOtherAssets(response.data);
      } else {
        console.error('Failed to load other assets:', response.error);
      }
    } catch (error) {
      console.error('Error loading other assets:', error);
    }
  };

  // Load IB portfolio data
  const loadIBPortfolio = async () => {
    try {
      const response = await apiClient.getIBPortfolio();
      if (response.data) {
        setIbPortfolio(response.data);
      } else {
        console.error('Failed to load IB portfolio:', response.error);
      }
    } catch (error) {
      console.error('Error loading IB portfolio:', error);
      // Set empty array if IB is not configured
      setIbPortfolio([]);
    }
  };

  // Load IB cash balances data
  const loadIBCashBalances = async () => {
    try {
      const response = await apiClient.getIBCashBalances();
      if (response.data && response.data.data) {
        setIbCashBalances(response.data.data);
      } else {
        console.error('Failed to load IB cash balances:', response.error);
      }
    } catch (error) {
      console.error('Error loading IB cash balances:', error);
      setIbCashBalances([]);
    }
  };

  // Load other portfolio data
  const loadOtherPortfolio = async () => {
    try {
      const response = await apiClient.getManualPositions();
      if (response.data) {
        setOtherPortfolio(response.data);
      } else {
        console.error('Failed to load other portfolio:', response.error);
      }
    } catch (error) {
      console.error('Error loading other portfolio:', error);
      setOtherPortfolio([]);
    }
  };

  // Load other portfolio cash balances data
  const loadOtherCashBalances = async () => {
    try {
      const response = await apiClient.getCashBalances();
      if (response.data) {
        setOtherCashBalances(response.data);
      } else {
        console.error('Failed to load other cash balances:', response.error);
      }
    } catch (error) {
      console.error('Error loading other cash balances:', error);
      setOtherCashBalances([]);
    }
  };

  // Calculate currency P&L using the same logic as CurrencyView
  const calculateCurrencyPL = () => {
    const totalPL = currencies.reduce((sum, currency) => {
      const [fromCurrency, toCurrency] = currency.pair.split('/');
      
      // Calculate current value and cost basis in the original pair's target currency
      const currentValue = currency.amount * currency.currentRate;
      const costBasis = currency.amount * currency.avgCost;
      const profitLossInOriginalCurrency = currentValue - costBasis;
      
      // Convert profit/loss to base currency
      if (toCurrency === baseCurrency) {
        // Already in base currency
        return sum + profitLossInOriginalCurrency;
      } else if (fromCurrency === baseCurrency) {
        // The profit/loss is in the target currency, need to convert to base currency
        // Use the inverse of the current rate to convert from target currency to base currency
        return sum + (profitLossInOriginalCurrency / currency.currentRate);
      } else {
        // For cross-currency pairs, we need to convert to base currency
        // This is a simplified approach - in reality we'd need the rate from toCurrency to baseCurrency
        return sum + profitLossInOriginalCurrency;
      }
    }, 0);
    
    
    return totalPL;
  };

  // Fetch exchange rates for currency conversion
  const fetchExchangeRates = async () => {
    try {
      // Get unique currencies from all sources
      const currenciesSet = new Set<string>();

      // Add currencies from accounts
      accounts.forEach(acc => currenciesSet.add(acc.currency));

      // Add currencies from IB portfolio
      ibPortfolio.forEach(pos => {
        if (pos.currency) currenciesSet.add(pos.currency);
      });

      // Add currencies from IB cash balances
      ibCashBalances.forEach(cash => {
        if (cash.currency) currenciesSet.add(cash.currency);
      });

      // Add currencies from other portfolio
      otherPortfolio.forEach(pos => {
        if (pos.currency) currenciesSet.add(pos.currency);
      });

      // Add currencies from other cash balances
      otherCashBalances.forEach(cash => {
        if (cash.currency) currenciesSet.add(cash.currency);
      });

      // Add currencies from other assets
      otherAssets.forEach(asset => {
        if (asset.currency) currenciesSet.add(asset.currency);
      });

      const currencies = Array.from(currenciesSet);

      // Fetch real exchange rates from API
      const ratePromises = currencies.map(async (currency) => {
        if (currency === baseCurrency) {
          return { currency, rate: 1 };
        }
        
        try {
          const pair = `${currency}/${baseCurrency}`;
          const response = await apiClient.getExchangeRate(pair);
          return { currency, rate: response.data?.rate || 1 };
        } catch (error) {
          console.warn(`Failed to fetch rate for ${currency}/${baseCurrency}, using fallback rate 1`);
          return { currency, rate: 1 };
        }
      });
      
      const rates = await Promise.all(ratePromises);
      const rateMap = rates.reduce((acc, { currency, rate }) => {
        acc[currency] = rate;
        return acc;
      }, {} as Record<string, number>);
      
      setExchangeRates(rateMap);
    } catch (error) {
      console.error("Failed to fetch exchange rates:", error);
    }
  };

  // Currency conversion function
  const convertToBaseCurrency = (amount: number, fromCurrency: string): number => {
    if (fromCurrency === baseCurrency) {
      return amount;
    }
    const rate = exchangeRates[fromCurrency] || 1;
    return amount * rate;
  };

  // Calculate summary data from accounts
  const calculateSummaryData = () => {
    if (accounts.length === 0) {
      return {
        totalCapital: 0,
        currentBalance: 0,
        totalProfitLoss: 0,
        totalProfitLossPercent: 0,
        investmentProfitLoss: 0,
        currencyProfitLoss: 0
      };
    }

    // Filter to only include investment accounts for P&L calculations
    // Handle accounts that might not have accountType set (default to INVESTMENT for backward compatibility)
    const investmentAccounts = accounts.filter(acc => !acc.accountType || acc.accountType === 'INVESTMENT');
    
    const totalCapital = investmentAccounts.reduce((sum, acc) => 
      sum + convertToBaseCurrency(acc.originalCapital, acc.currency), 0
    );
    
    const currentBalance = investmentAccounts.reduce((sum, acc) => 
      sum + convertToBaseCurrency(acc.currentBalance, acc.currency), 0
    );
    
    // Get Total P&L from Investment Accounts (matches Investment Accounts page)
    const totalProfitLoss = investmentAccounts.reduce((sum, acc) => 
      sum + convertToBaseCurrency(acc.profitLoss, acc.currency), 0
    );
    
    // Get Currency P&L from Currency Exchange page
    const currencyProfitLoss = calculateCurrencyPL();
    
    // Investment P&L = Total P&L - Currency P&L (pure investment performance)
    const investmentProfitLoss = totalProfitLoss - currencyProfitLoss;
    const totalProfitLossPercent = totalCapital > 0 ? (totalProfitLoss / totalCapital) * 100 : 0;

    return {
      totalCapital,
      currentBalance,
      totalProfitLoss,
      totalProfitLossPercent,
      investmentProfitLoss,
      currencyProfitLoss
    };
  };

  // Removed handleEnhancedRefreshRates function - refresh functionality moved to Currency Exchange page

  const formatCurrency = (amount: number, currency = baseCurrency) => {
    return new Intl.NumberFormat("en-HK", {
      style: "currency",
      currency: currency,
    }).format(amount);
  };

  const formatPercent = (percent: number) => {
    return `${percent > 0 ? "+" : ""}${percent.toFixed(2)}%`;
  };

  // Removed generatePerformanceHistoryOnTheFly function to prevent data override on refresh

  // Comprehensive refresh function that updates all data sources
  const handleComprehensiveRefresh = async () => {
    try {
      setIsLoadingPerformance(true);
      
      toast({
        title: "Refreshing Data",
        description: "Updating all portfolio data sources...",
      });

      // 1. Refresh Currency Exchange rates and pairs
      try {
        await apiClient.updateEnhancedExchangeRates();
        await loadCurrencies();
      } catch (error) {
        console.warn('Failed to refresh currency data:', error);
      }

      // 2. Refresh IB Portfolio data
      try {
        await apiClient.forceRefreshIBBalance();
        await apiClient.forceRefreshIBPortfolio();
        await apiClient.forceRefreshIBCashBalances();
        await loadIBPortfolio();
        await loadIBCashBalances();
      } catch (error) {
        console.warn('Failed to refresh IB data:', error);
      }

      // 3. Refresh Other Portfolio data
      try {
        await apiClient.refreshManualMarketData('default');
        await loadOtherPortfolio();
        await loadOtherCashBalances();
      } catch (error) {
        console.warn('Failed to refresh other portfolio data:', error);
      }

      // 4. Refresh Other Assets data
      try {
        await loadOtherAssets();
      } catch (error) {
        console.warn('Failed to refresh other assets data:', error);
      }

      // 5. Refresh Schwab account balances (if configured)
      try {
        await refreshSchwabAccounts();
      } catch (error) {
        console.warn('Failed to refresh Schwab data:', error);
      }

      // 6. Refresh Accounts data (including IB account balance updates)
      try {
        await loadAccounts();
      } catch (error) {
        console.warn('Failed to refresh accounts data:', error);
      }

      // 7. Update exchange rates for currency conversion
      await fetchExchangeRates();

      // 8. Force server to compute today's snapshot and reload performance history
      await handlePostAccountUpdate();

      toast({
        title: "Success",
        description: "All portfolio data has been refreshed successfully",
      });

    } catch (error) {
      console.error('Comprehensive refresh error:', error);
      toast({
        title: "Refresh Warning",
        description: "Some data sources may not have updated completely. Please check individual sections if needed.",
        variant: "destructive",
      });
    } finally {
      setIsLoadingPerformance(false);
    }
  };

  const renderOverview = () => {
    const summaryData = calculateSummaryData();

    const calculateAndStoreTodaySnapshot = async () => {
      try {
        await apiClient.calculateTodaySnapshot();
        // Reload performance history after storing today's snapshot
        loadPerformanceHistory();
      } catch (error) {
        console.error('Error calculating today snapshot:', error);
      }
    };
    
    

    const chartConfig = {
      totalPL: {
        label: "Total P&L",
        color: "hsl(var(--primary))",
      },
      investmentPL: {
        label: "Investment P&L",
        color: "hsl(var(--chart-2))",
      },
      currencyPL: {
        label: "Currency P&L",
        color: "hsl(var(--chart-3))",
      },
      dailyPL: {
        label: "Daily P&L",
        color: "hsl(var(--chart-4))",
      },
    };

    // Calculate converted values for display
    const totalCapitalConverted = summaryData.totalCapital;
    const currentBalanceConverted = summaryData.currentBalance;
    const totalProfitLossConverted = summaryData.totalProfitLoss;
    const investmentProfitLossConverted = summaryData.investmentProfitLoss;
    const currencyProfitLossConverted = summaryData.currencyProfitLoss;
    
    // Filter chart data based on selected days
    const chartData = performanceHistory.slice(-performanceDays);

    // Calculate Total Assets breakdown
    const investmentAccountsValue = accounts
      .filter(acc => !acc.accountType || acc.accountType === 'INVESTMENT')
      .reduce((sum, acc) => sum + convertToBaseCurrency(acc.currentBalance, acc.currency), 0);
    
    const bankAccountsValue = accounts
      .filter(acc => acc.accountType === 'BANK')
      .reduce((sum, acc) => sum + convertToBaseCurrency(acc.currentBalance, acc.currency), 0);
    
    const otherAssetsValue = otherAssets.reduce((sum, asset) => 
      sum + convertToBaseCurrency(asset.marketValue, asset.currency), 0
    );
    
    const totalAssetsValue = investmentAccountsValue + bankAccountsValue + otherAssetsValue;

    // Generate Portfolio Analytics CSV Log
    const generatePortfolioAnalyticsCSV = () => {
      const csvData: Array<{category: string, source: string, itemName: string, valueInBase: number}> = [];

      // Flatten all items from portfolioChartData
      portfolioChartData.forEach(categoryData => {
        categoryData.items.forEach(item => {
          csvData.push({
            category: categoryData.label,
            source: item.source,
            itemName: item.name,
            valueInBase: item.value
          });
        });
      });

      // Sort by category, then by source
      csvData.sort((a, b) => {
        if (a.category !== b.category) {
          return a.category.localeCompare(b.category);
        }
        return a.source.localeCompare(b.source);
      });

      // Generate CSV content
      const csvHeader = `Category,Source,Item Name,Value (${baseCurrency})\n`;
      const csvRows = csvData.map(row =>
        `"${row.category}","${row.source}","${row.itemName}",${row.valueInBase.toFixed(2)}`
      ).join('\n');

      const csvContent = csvHeader + csvRows;

      // Create and download CSV file
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `portfolio_analytics_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast({
        title: "Success",
        description: "Portfolio analytics CSV file downloaded successfully",
      });
    };

    // Generate Currency Analytics CSV Log
    const generateCurrencyAnalyticsCSV = () => {
      const csvData: Array<{currency: string, source: string, itemName: string, amount: number}> = [];

      // Add bank accounts
      accounts.filter(acc => acc.accountType === 'BANK').forEach(acc => {
        csvData.push({
          currency: acc.currency,
          source: 'Bank Account',
          itemName: acc.name,
          amount: acc.currentBalance
        });
      });
      
      // Add IB portfolio positions
      ibPortfolio.forEach(position => {
        if (position.marketValue && position.currency) {
          csvData.push({
            currency: position.currency,
            source: 'IB Portfolio',
            itemName: `${position.symbol} (${position.secType})`,
            amount: position.marketValue
          });
        }
      });
      
      // Add IB cash balances
      ibCashBalances.forEach(cash => {
        if (cash.amount && cash.currency) {
          csvData.push({
            currency: cash.currency,
            source: 'IB Cash Balance',
            itemName: `Cash - ${cash.currency}`,
            amount: cash.amount
          });
        }
      });
      
      // Add other portfolio positions
      otherPortfolio.forEach(position => {
        if (position.marketPrice && position.quantity && position.currency) {
          csvData.push({
            currency: position.currency,
            source: 'Other Portfolio',
            itemName: `${position.symbol} (${position.quantity} shares)`,
            amount: position.marketPrice * position.quantity
          });
        }
      });
      
      // Add other portfolio cash balances
      otherCashBalances.forEach(cash => {
        if (cash.amount && cash.currency) {
          csvData.push({
            currency: cash.currency,
            source: 'Other Portfolio Cash',
            itemName: `Cash - ${cash.currency}`,
            amount: cash.amount
          });
        }
      });
      
      // Add other assets
      otherAssets.forEach(asset => {
        csvData.push({
          currency: asset.currency,
          source: 'Other Assets',
          itemName: `${asset.asset} (${asset.assetType})`,
          amount: asset.marketValue
        });
      });
      
      // Sort by currency, then by source
      csvData.sort((a, b) => {
        if (a.currency !== b.currency) {
          return a.currency.localeCompare(b.currency);
        }
        return a.source.localeCompare(b.source);
      });
      
      // Generate CSV content
      const csvHeader = 'Currency,Source,Item Name,Amount\n';
      const csvRows = csvData.map(row => 
        `${row.currency},"${row.source}","${row.itemName}",${row.amount.toFixed(2)}`
      ).join('\n');
      
      const csvContent = csvHeader + csvRows;
      
      // Create and download CSV file
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `currency_analytics_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      toast({
        title: "Success",
        description: "Currency analytics CSV file downloaded successfully",
      });
    };

    // Helper function to categorize portfolio positions
    const categorizePosition = (position: any): string => {
      const symbol = position.symbol?.toUpperCase() || '';
      const secType = position.secType?.toUpperCase() || '';
      let country = position.country?.toUpperCase() || '';
      const category = position.category?.toUpperCase() || '';
      const industry = position.industry?.toUpperCase() || '';
      const exchange = position.exchange?.toUpperCase() || position.primaryExchange?.toUpperCase() || '';
      const currency = position.currency?.toUpperCase() || '';

      // If country is null/empty, use currency as fallback to determine region
      if (!country && currency) {
        if (currency === 'USD') {
          country = 'US';
        } else if (currency === 'HKD') {
          country = 'HK';
        } else if (currency === 'CAD') {
          country = 'CA';
        } else if (currency === 'SGD') {
          country = 'SG';
        } else if (currency === 'EUR') {
          country = 'EUROPE';
        } else if (currency === 'GBP') {
          country = 'GB';
        }
      }

      // Cash category
      if (secType === 'CASH') {
        return 'CASH';
      }

      // Crypto category
      if (secType === 'CRYPTO' || symbol.includes('BTC') || symbol.includes('ETH') ||
          symbol.includes('USDT') || symbol.includes('USDC')) {
        return 'CRYPTO';
      }

      // Bonds category
      if (secType === 'BOND' || symbol.includes('TLT') || symbol.includes('IEF') ||
          symbol.includes('AGG') || symbol.includes('BND')) {
        return 'BOND_USA';
      }

      // REIT detection - check category, industry, or symbol patterns
      const isREIT = category.includes('REIT') ||
                     category.includes('REITS') ||
                     industry.includes('REIT') ||
                     symbol.includes('REIT') ||
                     symbol.endsWith('.UN');

      // For stocks (STK or ETF), categorize by region
      if (secType === 'STK' || secType === 'ETF') {
        // First check if it's a REIT, then categorize by country
        if (isREIT) {
          if (country === 'CANADA' || country === 'CA' ||
              symbol.endsWith('.TO') || symbol.endsWith('.UN') || exchange.includes('TSX')) {
            return 'REIT_CANADA';
          } else if (country === 'SINGAPORE' || country === 'SG' ||
                     symbol.endsWith('.SG') || exchange.includes('SGX')) {
            return 'REIT_SINGAPORE';
          } else if (country === 'UK' || country === 'GB' || country === 'UNITED KINGDOM' ||
                     country === 'FRANCE' || country === 'FR' ||
                     country === 'GERMANY' || country === 'DE' ||
                     country === 'ITALY' || country === 'IT' ||
                     country === 'SPAIN' || country === 'ES' ||
                     country === 'EUROPE' ||
                     exchange.includes('LSE') || exchange.includes('EURONEXT')) {
            return 'REIT_EUROPE';
          } else if (country === 'USA' || country === 'US' || country === 'UNITED STATES' ||
                     exchange.includes('NYSE') || exchange.includes('NASDAQ')) {
            return 'REIT_USA';
          }
        } else {
          // Not a REIT, categorize as stock by country
          if (country === 'HONG KONG' || country === 'HK' ||
              exchange.includes('HKEX') || exchange.includes('SEHK')) {
            return 'STOCK_HK';
          } else if (country === 'CANADA' || country === 'CA' ||
                     symbol.endsWith('.TO') || exchange.includes('TSX')) {
            return 'STOCK_CANADA';
          } else if (country === 'USA' || country === 'US' || country === 'UNITED STATES' ||
                     exchange.includes('NYSE') || exchange.includes('NASDAQ') ||
                     exchange.includes('AMEX')) {
            return 'STOCK_USA';
          }
        }
      }

      return 'OTHER';
    };

    // Calculate Portfolio Distribution
    const portfolioDistribution = new Map<string, { value: number, items: Array<{name: string, category: string, value: number, source: string}> }>();

    // Helper to add to distribution
    const addToPortfolio = (category: string, value: number, itemName: string, source: string) => {
      const current = portfolioDistribution.get(category) || { value: 0, items: [] };
      current.value += value;
      current.items.push({ name: itemName, category, value, source });
      portfolioDistribution.set(category, current);
    };

    // Add IB portfolio positions
    ibPortfolio.forEach(position => {
      if (position.marketValue && position.marketValue > 0) {
        const category = categorizePosition(position);
        const valueInBase = convertToBaseCurrency(position.marketValue, position.currency);
        addToPortfolio(category, valueInBase,
          `${position.symbol} (${position.secType || 'Unknown'})`, 'IB Portfolio');
      }
    });

    // Add other portfolio positions
    otherPortfolio.forEach(position => {
      if (position.marketPrice && position.quantity) {
        const category = categorizePosition(position);
        const marketValue = position.marketPrice * position.quantity;
        const valueInBase = convertToBaseCurrency(marketValue, position.currency);
        addToPortfolio(category, valueInBase,
          `${position.symbol} (${position.secType || 'Unknown'})`, 'Other Portfolio');
      }
    });

    // Add IB cash balances
    ibCashBalances.forEach(cash => {
      if (cash.amount && cash.amount > 0) {
        const valueInBase = convertToBaseCurrency(cash.amount, cash.currency);
        addToPortfolio('CASH', valueInBase, `Cash - ${cash.currency}`, 'IB Cash Balance');
      }
    });

    // Add other cash balances
    otherCashBalances.forEach(cash => {
      if (cash.amount && cash.amount > 0) {
        const valueInBase = convertToBaseCurrency(cash.amount, cash.currency);
        addToPortfolio('CASH', valueInBase, `Cash - ${cash.currency}`, 'Other Cash Balance');
      }
    });

    // Add bank account balances
    accounts.filter(acc => acc.accountType === 'BANK').forEach(acc => {
      if (acc.currentBalance && acc.currentBalance > 0) {
        const valueInBase = convertToBaseCurrency(acc.currentBalance, acc.currency);
        addToPortfolio('CASH', valueInBase, `${acc.name} (Bank Account)`, 'Bank Account');
      }
    });

    // Add other assets
    otherAssets.forEach(asset => {
      const valueInBase = convertToBaseCurrency(asset.marketValue, asset.currency);
      if (asset.assetType?.toLowerCase().includes('real estate') ||
          asset.assetType?.toLowerCase().includes('property')) {
        addToPortfolio('REAL_ESTATE', valueInBase,
          `${asset.asset} (${asset.assetType})`, 'Other Assets');
      } else {
        addToPortfolio('OTHER', valueInBase,
          `${asset.asset} (${asset.assetType})`, 'Other Assets');
      }
    });

    // Category labels mapping
    const categoryLabels: Record<string, string> = {
      'REIT_CANADA': 'REITs - Canada',
      'REIT_SINGAPORE': 'REITs - Singapore',
      'REIT_EUROPE': 'REITs - Europe',
      'REIT_USA': 'REITs - USA',
      'STOCK_HK': 'Stocks - HK',
      'STOCK_CANADA': 'Stocks - Canada',
      'STOCK_USA': 'Stocks - USA',
      'BOND_USA': 'Bonds - USA',
      'CRYPTO': 'Crypto',
      'CASH': 'Cash',
      'REAL_ESTATE': 'Real Estate',
      'OTHER': 'Others'
    };

    // Convert to chart data with colors
    const portfolioChartData = Array.from(portfolioDistribution.entries())
      .map(([category, data]) => ({
        category,
        label: categoryLabels[category] || category,
        value: data.value,
        percentage: 0, // Will be calculated below
        items: data.items
      }))
      .filter(item => item.value > 0)
      .sort((a, b) => b.value - a.value);

    // Calculate percentages
    const totalPortfolioValue = portfolioChartData.reduce((sum, item) => sum + item.value, 0);
    portfolioChartData.forEach(item => {
      item.percentage = totalPortfolioValue > 0 ? (item.value / totalPortfolioValue) * 100 : 0;
    });

    // Define colors for portfolio categories
    const portfolioColors = [
      "hsl(var(--chart-1))",
      "hsl(var(--chart-2))",
      "hsl(var(--chart-3))",
      "hsl(var(--chart-4))",
      "hsl(var(--chart-5))",
      "#8884d8",
      "#82ca9d",
      "#ffc658",
      "#ff7300",
      "#00ff00",
      "#ff00ff",
      "#00ffff"
    ];

    // Calculate Currency Distribution
    const currencyDistribution = new Map<string, number>();

    // Add bank accounts
    accounts.filter(acc => acc.accountType === 'BANK').forEach(acc => {
      const current = currencyDistribution.get(acc.currency) || 0;
      currencyDistribution.set(acc.currency, current + acc.currentBalance);
    });
    
    // Add IB portfolio positions
    ibPortfolio.forEach(position => {
      if (position.marketValue && position.currency) {
        const current = currencyDistribution.get(position.currency) || 0;
        currencyDistribution.set(position.currency, current + position.marketValue);
      }
    });
    
    // Add IB cash balances
    ibCashBalances.forEach(cash => {
      if (cash.amount && cash.currency) {
        const current = currencyDistribution.get(cash.currency) || 0;
        currencyDistribution.set(cash.currency, current + cash.amount);
      }
    });
    
    // Add other portfolio positions
    otherPortfolio.forEach(position => {
      if (position.marketPrice && position.quantity && position.currency) {
        const current = currencyDistribution.get(position.currency) || 0;
        currencyDistribution.set(position.currency, current + (position.marketPrice * position.quantity));
      }
    });
    
    // Add other portfolio cash balances
    otherCashBalances.forEach(cash => {
      if (cash.amount && cash.currency) {
        const current = currencyDistribution.get(cash.currency) || 0;
        currencyDistribution.set(cash.currency, current + cash.amount);
      }
    });
    
    // Add other assets
    otherAssets.forEach(asset => {
      const current = currencyDistribution.get(asset.currency) || 0;
      currencyDistribution.set(asset.currency, current + asset.marketValue);
    });
    
    // Convert to chart data with colors
    const currencyChartData = Array.from(currencyDistribution.entries())
      .map(([currency, value]) => ({
        currency,
        value,
        valueHKD: convertToBaseCurrency(value, currency),
        percentage: 0 // Will be calculated below
      }))
      .filter(item => item.valueHKD > 0)
      .sort((a, b) => b.valueHKD - a.valueHKD);
    
    // Calculate percentages
    const totalValue = currencyChartData.reduce((sum, item) => sum + item.valueHKD, 0);
    currencyChartData.forEach(item => {
      item.percentage = totalValue > 0 ? (item.valueHKD / totalValue) * 100 : 0;
    });
    
    // Define colors for currencies
    const currencyColors = [
      "hsl(var(--chart-1))",
      "hsl(var(--chart-2))", 
      "hsl(var(--chart-3))",
      "hsl(var(--chart-4))",
      "hsl(var(--chart-5))",
      "#8884d8",
      "#82ca9d",
      "#ffc658",
      "#ff7300",
      "#00ff00"
    ];

    return (
      <div className="space-y-6">
        {/* Performance Chart */}
        <Card className="bg-gradient-card border-border shadow-card">
          <CardHeader className="pb-2 md:pb-6 flex flex-col gap-3">
            <div className="flex flex-row items-start md:items-center justify-between gap-3">
              <CardTitle className="text-sm md:text-base text-foreground">Performance Overview</CardTitle>
              <div className="flex items-center gap-2 ml-auto">
                <CardDescription className="text-xs md:text-sm hidden md:block">Profit & Loss trends over time</CardDescription>
                <Button
                  variant="outline"
                  size="sm"
                  className="border-green-500 text-green-500 hover:bg-green-500/10"
                  onClick={handleComprehensiveRefresh}
                  disabled={isLoadingPerformance}
                >
                  {isLoadingPerformance ? (
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4 mr-2" />
                  )}
                  Refresh
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="border-primary text-primary hover:bg-primary/10"
                  onClick={() => setShowPerformanceDetails(v => !v)}
                >
                  {showPerformanceDetails ? 'Hide Details' : 'View Details'}
                </Button>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-muted-foreground">Show:</span>
              {[30, 60, 90, 180, 365].map((days) => (
                <Button
                  key={days}
                  variant={performanceDays === days ? "default" : "outline"}
                  size="sm"
                  className="h-7 px-3 text-xs"
                  onClick={() => setPerformanceDays(days)}
                >
                  {days}d
                </Button>
              ))}
            </div>
          </CardHeader>
          <CardContent className="p-2 md:p-6">
            <ChartContainer config={chartConfig} className="h-[250px] md:h-[400px] w-full" key={`chart-${performanceDays}-${chartData.length}`}>
              <LineChart 
                data={chartData} 
                margin={{ 
                  top: 10, 
                  right: 5, 
                  left: 0, 
                  bottom: 10 
                }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                <XAxis 
                  dataKey="date" 
                  type="category"
                  tickFormatter={(value, index) => {
                    // Handle date string properly - value should already be in YYYY-MM-DD format
                    if (!value) return '';
                    
                    try {
                      // Parse the date string (YYYY-MM-DD format)
                    const date = new Date(value);
                      
                      // Check if date is valid
                      if (isNaN(date.getTime())) {
                        return value; // Return original value if parsing fails
                      }
                      
                      // Show fewer ticks to avoid overcrowding
                      const shouldShow = index === 0 || index === Math.floor(chartData.length / 2) || index === chartData.length - 1;
                      if (!shouldShow) return '';
                      
                    return window.innerWidth < 768 
                      ? date.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' })
                      : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                    } catch (error) {
                      return value; // Return original value if there's an error
                    }
                  }}
                  fontSize={10}
                  tickMargin={5}
                  interval={0}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis 
                  tickFormatter={(value) => {
                    return value.toLocaleString('en-US', {
                      minimumFractionDigits: 0,
                      maximumFractionDigits: 0
                    });
                  }}
                  fontSize={10}
                  tickMargin={5}
                  width={window.innerWidth < 768 ? 80 : 120}
                  axisLine={false}
                  tickLine={false}
                />
                <ChartTooltip 
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="bg-background border border-border rounded-lg p-2 shadow-lg max-w-[280px] md:max-w-xs">
                          <p className="font-medium text-foreground mb-1 text-[10px] md:text-xs">
                            {(() => {
                              try {
                                const date = new Date(label);
                                if (isNaN(date.getTime())) {
                                  return label; // Return original if invalid
                                }
                                return date.toLocaleDateString('en-US', { 
                              month: 'short', 
                              day: 'numeric',
                              year: window.innerWidth < 768 ? undefined : 'numeric'
                                });
                              } catch (error) {
                                return label; // Return original if error
                              }
                            })()}
                          </p>
                          <div className="space-y-0.5">
                            {payload.map((entry, index) => (
                              <div key={index} className="flex items-center gap-1">
                                <div 
                                  className="w-2 h-2 rounded-sm flex-shrink-0" 
                                  style={{ backgroundColor: entry.color }}
                                />
                                <span className="text-[10px] md:text-xs text-muted-foreground truncate max-w-[80px] md:max-w-none">
                                  {chartConfig[entry.dataKey as keyof typeof chartConfig]?.label}:
                                </span>
                                <span className="text-[10px] md:text-xs font-medium text-foreground ml-auto">
                                  {(() => {
                                    const value = entry.value as number;
                                    return value.toLocaleString('en-US', {
                                      minimumFractionDigits: 0,
                                      maximumFractionDigits: 2
                                    });
                                  })()}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <ChartLegend 
                  content={<ChartLegendContent className="text-[10px] md:text-xs flex-wrap" />}
                  wrapperStyle={{ paddingTop: '10px' }}
                />
                <Line 
                  type="monotone" 
                  dataKey="totalPL" 
                  stroke="var(--color-totalPL)" 
                  strokeWidth={window.innerWidth < 768 ? 1.5 : 2}
                  dot={{ r: window.innerWidth < 768 ? 2 : 3, fill: "var(--color-totalPL)" }}
                  activeDot={{ r: window.innerWidth < 768 ? 3 : 4, stroke: "var(--color-totalPL)", strokeWidth: 2 }}
                />
                <Line 
                  type="monotone" 
                  dataKey="investmentPL" 
                  stroke="var(--color-investmentPL)" 
                  strokeWidth={window.innerWidth < 768 ? 1.5 : 2}
                  dot={{ r: window.innerWidth < 768 ? 1.5 : 2, fill: "var(--color-investmentPL)" }}
                  activeDot={{ r: window.innerWidth < 768 ? 2.5 : 3, stroke: "var(--color-investmentPL)", strokeWidth: 2 }}
                />
                <Line 
                  type="monotone" 
                  dataKey="currencyPL" 
                  stroke="var(--color-currencyPL)" 
                  strokeWidth={window.innerWidth < 768 ? 1.5 : 2}
                  dot={{ r: window.innerWidth < 768 ? 1.5 : 2, fill: "var(--color-currencyPL)" }}
                  activeDot={{ r: window.innerWidth < 768 ? 2.5 : 3, stroke: "var(--color-currencyPL)", strokeWidth: 2 }}
                />
                <Line 
                  type="monotone" 
                  dataKey="dailyPL" 
                  stroke="var(--color-dailyPL)" 
                  strokeWidth={window.innerWidth < 768 ? 1.5 : 2}
                  dot={{ r: window.innerWidth < 768 ? 1.5 : 2, fill: "var(--color-dailyPL)" }}
                  activeDot={{ r: window.innerWidth < 768 ? 2.5 : 3, stroke: "var(--color-dailyPL)", strokeWidth: 2 }}
                  strokeDasharray="3 3"
                />
              </LineChart>
            </ChartContainer>
          </CardContent>
          {showPerformanceDetails && (
            <CardContent className="pt-0 pb-4 md:pb-6">
              <div className="overflow-x-auto border-t border-border/50 mt-2 pt-4">
                <table className="w-full text-xs md:text-sm">
                  <thead>
                    <tr className="text-muted-foreground text-left border-b border-border/50">
                      <th className="py-2 pr-3">Date</th>
                      <th className="py-2 pr-3 text-right">Total P&L</th>
                      <th className="py-2 pr-3 text-right">Investment P&L</th>
                      <th className="py-2 pr-3 text-right">Currency P&L</th>
                      <th className="py-2 pr-3 text-right">Daily P&L</th>
                    </tr>
                  </thead>
                  <tbody>
                    {getPaginatedPerformanceData().map((row, idx) => {
                      const prev = row.prev; // Use pre-calculated previous day data
                      
                      const pct = (curr: number, prevVal: number) => {
                        if (!prev || prevVal === 0 || prevVal === undefined || prevVal === null) return '-';
                        const v = ((curr - prevVal) / Math.abs(prevVal)) * 100;
                        if (!isFinite(v)) return '-';
                        return `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`;
                      };
                      const pctClass = (curr: number, prevVal: number) => {
                        if (!prev || prevVal === 0 || prevVal === undefined || prevVal === null) return 'text-muted-foreground';
                        const v = curr - prevVal;
                        return v >= 0 ? 'text-profit' : 'text-loss';
                      };
                      return (
                        <tr key={row.date} className="border-b border-border/30">
                          <td className="py-2 pr-3 text-foreground">
                            {(() => {
                              try {
                                const d = new Date(row.date);
                                return isNaN(d.getTime()) ? row.date : d.toLocaleDateString('en-GB', { month: 'short', day: 'numeric' });
                              } catch {
                                return row.date;
                              }
                            })()}
                          </td>
                          <td className="py-2 pr-3 text-right">
                            <div className="font-medium">{Number(row.totalPL).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                            <div className={`text-[10px] md:text-xs ${prev ? pctClass(Number(row.totalPL), Number(prev.totalPL)) : 'text-muted-foreground'}`}>
                              {prev ? pct(Number(row.totalPL), Number(prev.totalPL)) : '-'}
                            </div>
                          </td>
                          <td className="py-2 pr-3 text-right">
                            <div className="font-medium">{Number(row.investmentPL).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                            <div className={`text-[10px] md:text-xs ${prev ? pctClass(Number(row.investmentPL), Number(prev.investmentPL)) : 'text-muted-foreground'}`}>
                              {prev ? pct(Number(row.investmentPL), Number(prev.investmentPL)) : '-'}
                            </div>
                          </td>
                          <td className="py-2 pr-3 text-right">
                            <div className="font-medium">{Number(row.currencyPL).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                            <div className={`text-[10px] md:text-xs ${prev ? pctClass(Number(row.currencyPL), Number(prev.currencyPL)) : 'text-muted-foreground'}`}>
                              {prev ? pct(Number(row.currencyPL), Number(prev.currencyPL)) : '-'}
                            </div>
                          </td>
                          <td className="py-2 pr-3 text-right">
                            {Number(row.dailyPL).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                        </tr>
                      );
                    })}
                    {allPerformanceData.length === 0 && (
                      <tr>
                        <td className="py-3 text-muted-foreground" colSpan={5}>No performance data available</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              {/* Pagination Controls */}
              {filteredDataLength > ITEMS_PER_PAGE && (
                <div className="flex items-center justify-between px-4 py-3 border-t border-border/30">
                  <div className="text-xs text-muted-foreground">
                    Showing {performancePage * ITEMS_PER_PAGE + 1} to {Math.min((performancePage + 1) * ITEMS_PER_PAGE, filteredDataLength)} of {filteredDataLength} entries
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPerformancePage(p => p - 1)}
                      disabled={!canGoPrevious}
                      className="h-8 px-3"
                    >
                      Previous
                    </Button>
                    <span className="text-xs text-muted-foreground px-2">
                      Page {performancePage + 1} of {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPerformancePage(p => p + 1)}
                      disabled={!canGoNext}
                      className="h-8 px-3"
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          )}
        </Card>

      {/* Profit/Loss Breakdown */}
      <Card className="bg-gradient-card border-border shadow-card">
        <CardHeader>
          <CardTitle className="text-foreground">Profit & Loss Breakdown</CardTitle>
          <CardDescription>Investment vs Currency performance</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Total Capital and Current Balance */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex items-center justify-end p-4 bg-background/30 rounded-lg">
              <div className="flex items-center gap-3 mr-auto">
                <Wallet className="h-5 w-5 text-primary" />
                <div>
                  <p className="font-medium text-foreground">Total Capital</p>
                  <p className="text-sm text-muted-foreground">Investment capital</p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-bold text-foreground">
                  {formatCurrency(totalCapitalConverted)}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end p-4 bg-background/30 rounded-lg">
              <div className="flex items-center gap-3 mr-auto">
                <DollarSign className="h-5 w-5 text-primary" />
                <div>
                  <p className="font-medium text-foreground">Current Balance</p>
                  <p className="text-sm text-muted-foreground">Current portfolio value</p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-bold text-foreground">
                  {formatCurrency(currentBalanceConverted)}
                </p>
              </div>
            </div>
          </div>
          <div className="flex items-center justify-end p-4 bg-background/30 rounded-lg">
            <div className="flex items-center gap-3 mr-auto">
              <TrendingUp className="h-5 w-5 text-primary" />
              <div>
                <p className="font-medium text-foreground">Total P&L</p>
                <p className="text-sm text-muted-foreground">Overall portfolio performance</p>
              </div>
            </div>
            <div className="text-right">
              <p className={`font-bold ${totalProfitLossConverted > 0 ? 'text-profit' : 'text-loss'}`}>
                {formatCurrency(totalProfitLossConverted)}
              </p>
              <p className="text-sm text-muted-foreground">
                {formatPercent((totalProfitLossConverted / totalCapitalConverted) * 100)}
              </p>
            </div>
          </div>

          <div className="flex items-center justify-end p-4 bg-background/30 rounded-lg">
            <div className="flex items-center gap-3 mr-auto">
              <BarChart3 className="h-5 w-5 text-primary" />
              <div>
                <p className="font-medium text-foreground">Investment P&L</p>
                <p className="text-sm text-muted-foreground">Excluding currency effects</p>
              </div>
            </div>
            <div className="text-right">
              <p className={`font-bold ${investmentProfitLossConverted > 0 ? 'text-profit' : 'text-loss'}`}>
                {formatCurrency(investmentProfitLossConverted)}
              </p>
              <p className="text-sm text-muted-foreground">
                {formatPercent((investmentProfitLossConverted / totalCapitalConverted) * 100)}
              </p>
            </div>
          </div>

          <div className="flex items-center justify-end p-4 bg-background/30 rounded-lg">
            <div className="flex items-center gap-3 mr-auto">
              <ArrowLeftRight className="h-5 w-5 text-primary" />
              <div>
                <p className="font-medium text-foreground">Currency P&L</p>
                <p className="text-sm text-muted-foreground">Exchange rate fluctuations</p>
              </div>
            </div>
            <div className="text-right">
              <p className={`font-bold ${currencyProfitLossConverted > 0 ? 'text-profit' : 'text-loss'}`}>
                {formatCurrency(currencyProfitLossConverted)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Total Assets Breakdown */}
      <Card className="bg-gradient-card border-border shadow-card">
        <CardHeader>
          <CardTitle className="text-foreground">Total Assets</CardTitle>
          <CardDescription>Complete asset portfolio breakdown</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-end p-4 bg-background/30 rounded-lg">
            <div className="flex items-center gap-3 mr-auto">
              <PiggyBank className="h-5 w-5 text-primary" />
              <div>
                <p className="font-medium text-foreground">Investment Accounts</p>
                <p className="text-sm text-muted-foreground">Current portfolio value</p>
              </div>
            </div>
            <div className="text-right">
              <p className="font-bold text-foreground">
                {formatCurrency(investmentAccountsValue, baseCurrency)}
              </p>
            </div>
          </div>

          <div className="flex items-center justify-end p-4 bg-background/30 rounded-lg">
            <div className="flex items-center gap-3 mr-auto">
              <Landmark className="h-5 w-5 text-primary" />
              <div>
                <p className="font-medium text-foreground">Bank Accounts</p>
                <p className="text-sm text-muted-foreground">Total bank balance</p>
              </div>
            </div>
            <div className="text-right">
              <p className="font-bold text-foreground">
                {formatCurrency(bankAccountsValue, baseCurrency)}
              </p>
            </div>
          </div>

          <div className="flex items-center justify-end p-4 bg-background/30 rounded-lg">
            <div className="flex items-center gap-3 mr-auto">
              <Building className="h-5 w-5 text-primary" />
              <div>
                <p className="font-medium text-foreground">Other Assets</p>
                <p className="text-sm text-muted-foreground">Real estate, collectibles, etc.</p>
              </div>
            </div>
            <div className="text-right">
              <p className="font-bold text-foreground">
                {formatCurrency(otherAssetsValue, baseCurrency)}
              </p>
            </div>
          </div>

          <div className="flex items-center justify-end p-4 bg-primary/10 rounded-lg border-2 border-primary/20">
            <div className="flex items-center gap-3 mr-auto">
              <TrendingUp className="h-5 w-5 text-primary" />
              <div>
                <p className="font-medium text-foreground text-lg">Total Assets</p>
                <p className="text-sm text-muted-foreground">Complete portfolio value</p>
              </div>
            </div>
            <div className="text-right">
              <p className="font-bold text-foreground text-xl">
                {formatCurrency(totalAssetsValue, baseCurrency)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Currency Analytics */}
      <Card className="bg-gradient-card border-border shadow-card">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-foreground">Currency Analytics</CardTitle>
            <CardDescription>Portfolio distribution by currency</CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={generateCurrencyAnalyticsCSV}
            className="flex items-center gap-2"
          >
            <ArrowDownRight className="h-4 w-4" />
            Export CSV
          </Button>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Pie Chart */}
            <div className="flex items-center justify-center">
              <ChartContainer config={{}} className="h-[300px] w-full">
                <PieChart>
                  <Pie
                    data={currencyChartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={120}
                    paddingAngle={2}
                    dataKey="valueHKD"
                    label={({ currency, percentage }) =>
                      percentage > 5 ? `${currency} ${percentage.toFixed(1)}%` : ''
                    }
                    labelLine={false}
                  >
                    {currencyChartData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={currencyColors[index % currencyColors.length]}
                      />
                    ))}
                  </Pie>
                  <ChartTooltip 
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div className="bg-background border border-border rounded-lg p-3 shadow-lg">
                            <p className="font-medium text-foreground">{data.currency}</p>
                            <p className="text-sm text-muted-foreground">
                              {formatCurrency(data.valueHKD, baseCurrency)} ({data.percentage.toFixed(1)}%)
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Original: {formatCurrency(data.value, data.currency)}
                            </p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                </PieChart>
              </ChartContainer>
            </div>

            {/* Legend and Details */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <PieChartIcon className="h-4 w-4 text-primary" />
                <h3 className="font-semibold text-sm text-foreground">Currency Breakdown</h3>
              </div>

              <div className="space-y-1.5">
                {currencyChartData.map((item, index) => (
                  <div key={item.currency} className="flex items-center justify-between p-2 bg-background/30 rounded-md">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: currencyColors[index % currencyColors.length] }}
                      />
                      <div>
                        <p className="text-sm font-medium text-foreground">{item.currency}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatCurrency(item.value, item.currency)} original
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-foreground">
                        {formatCurrency(item.valueHKD, baseCurrency)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {item.percentage.toFixed(1)}%
                      </p>
                    </div>
                  </div>
                ))}
                
                {currencyChartData.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <PieChartIcon className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No currency data available</p>
                    <p className="text-sm">Add some investments to see currency distribution</p>
                  </div>
                )}
              </div>
              
              {currencyChartData.length > 0 && (
                <div className="pt-4 border-t border-border/50">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Total Portfolio Value:</span>
                    <span className="font-bold text-foreground">
                      {formatCurrency(totalValue, baseCurrency)}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Portfolio Analytics */}
      <Card className="bg-gradient-card border-border shadow-card">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-foreground">Portfolio Analytics</CardTitle>
            <CardDescription>Investment distribution by asset category</CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={generatePortfolioAnalyticsCSV}
            className="flex items-center gap-2"
          >
            <ArrowDownRight className="h-4 w-4" />
            Export CSV
          </Button>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Pie Chart */}
            <div className="flex items-center justify-center">
              <ChartContainer config={{}} className="h-[300px] w-full">
                <PieChart>
                  <Pie
                    data={portfolioChartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={120}
                    paddingAngle={2}
                    dataKey="value"
                    label={({ label, percentage }) =>
                      percentage > 5 ? `${label} ${percentage.toFixed(1)}%` : ''
                    }
                    labelLine={false}
                  >
                    {portfolioChartData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={portfolioColors[index % portfolioColors.length]}
                      />
                    ))}
                  </Pie>
                  <ChartTooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div className="bg-background border border-border rounded-lg p-3 shadow-lg">
                            <p className="font-medium text-foreground">{data.label}</p>
                            <p className="text-sm text-muted-foreground">
                              {formatCurrency(data.value, baseCurrency)} ({data.percentage.toFixed(1)}%)
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {data.items.length} position{data.items.length !== 1 ? 's' : ''}
                            </p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                </PieChart>
              </ChartContainer>
            </div>

            {/* Legend and Details */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-primary" />
                <h3 className="font-semibold text-sm text-foreground">Category Breakdown</h3>
              </div>

              <div className="space-y-1.5">
                {portfolioChartData.map((item, index) => (
                  <div key={item.category} className="flex items-center justify-between p-2 bg-background/30 rounded-md">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: portfolioColors[index % portfolioColors.length] }}
                      />
                      <div>
                        <p className="text-sm font-medium text-foreground">{item.label}</p>
                        <p className="text-xs text-muted-foreground">
                          {item.items.length} position{item.items.length !== 1 ? 's' : ''}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-foreground">
                        {formatCurrency(item.value, baseCurrency)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {item.percentage.toFixed(1)}%
                      </p>
                    </div>
                  </div>
                ))}

                {portfolioChartData.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No portfolio data available</p>
                    <p className="text-sm">Add some investments to see category distribution</p>
                  </div>
                )}
              </div>

              {portfolioChartData.length > 0 && (
                <div className="pt-4 border-t border-border/50">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Total Portfolio Value:</span>
                    <span className="font-bold text-foreground">
                      {formatCurrency(totalPortfolioValue, baseCurrency)}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
    );
  };

  // Safety check - if user is not available, show loading
  // Temporarily disabled for testing
  // if (!user) {
  //   return (
  //     <div className="min-h-screen bg-gradient-hero flex items-center justify-center">
  //       <div className="text-center">
  //         <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
  //         <p className="text-muted-foreground">Loading...</p>
  //       </div>
  //     </div>
  //   );
  // }

  return (
    <div className="flex flex-1 bg-background">
      <Sidebar 
        currentView={currentView} 
        onViewChange={setCurrentView} 
        onLogout={onLogout}
        isOpen={sidebarOpen}
        onToggle={onSidebarToggle}
        isCollapsed={sidebarCollapsed}
        onCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        user={user}
      />
      
      <main className="flex-1 overflow-auto">
        <div className="p-4 md:p-6">
          <div className="mb-6">
            <div className="flex items-center justify-between">
              <div>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-2">
              {currentView === "overview" && "Dashboard Overview"}
              {currentView === "accounts" && "Accounts"}
              {currentView === "currency" && "Currency Exchange"}
              {currentView === "integration" && "IB Portfolio"}
              {currentView === "manual-investments" && "Other Portfolios"}
              {currentView === "other-assets" && "Other Assets"}
            </h1>
            <p className="text-muted-foreground">
              {currentView === "overview" && "Monitor your investment performance"}
              {currentView === "accounts" && "Manage your investment & bank accounts"}
              {currentView === "currency" && "Track currency exchange rates"}
              {currentView === "integration" && "Interactive Brokers portfolio and positions"}
              {currentView === "manual-investments" && "Add and manage other investment accounts manually"}
              {currentView === "other-assets" && "Track real estate, collectibles, and other investments"}
            </p>
              </div>
              {currentView === "overview" && (
                <Dialog open={showQuickUpdateDialog} onOpenChange={setShowQuickUpdateDialog}>
                  <DialogTrigger asChild>
                    <Button variant="outline" className="flex items-center gap-2">
                      <Zap className="h-4 w-4" />
                      Quick Update
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto sm:top-[50%] top-[5%] sm:translate-y-[-50%] translate-y-0">
                    <DialogHeader>
                      <DialogTitle>Quick Update Account Balances</DialogTitle>
                      <DialogDescription>
                        Update the current balance for your investment accounts. Leave empty to skip an account.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-3 py-4">
                      {(() => {
                        // Define the desired order
                        const accountOrder = [
                          'Charles Schwab',
                          'Interactive Broker HK',
                          'Futu - William',
                          'Futu - Joy',
                          'Charles Schwab - Joy'
                        ];
                        
                        // Filter investment accounts
                        const investmentAccounts = accounts.filter(acc => !acc.accountType || acc.accountType === 'INVESTMENT');
                        
                        // Sort accounts based on the defined order
                        const sortedAccounts = [...investmentAccounts].sort((a, b) => {
                          const indexA = accountOrder.indexOf(a.name);
                          const indexB = accountOrder.indexOf(b.name);
                          
                          // If both are in the order list, sort by their position
                          if (indexA !== -1 && indexB !== -1) {
                            return indexA - indexB;
                          }
                          // If only A is in the list, it comes first
                          if (indexA !== -1) return -1;
                          // If only B is in the list, it comes first
                          if (indexB !== -1) return 1;
                          // If neither is in the list, maintain original order
                          return 0;
                        });
                        
                        return sortedAccounts.map((account, index) => (
                          <div key={account.id} className="flex items-center gap-3">
                            <Label htmlFor={`account-${account.id}`} className="font-medium text-sm min-w-[180px]">
                              {account.name}
                            </Label>
                            <Input
                              id={`account-${account.id}`}
                              type="number"
                              inputMode="decimal"
                              step="0.01"
                              placeholder={account.currentBalance.toFixed(2)}
                              value={quickUpdateAmounts[account.id] || ''}
                              onChange={(e) => handleAmountChange(account.id, e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  handleQuickUpdate();
                                }
                              }}
                              className="flex-1"
                              autoFocus={index === 0}
                            />
                            <div className="text-sm text-muted-foreground font-medium min-w-[50px]">
                              {account.currency}
                            </div>
                          </div>
                        ));
                      })()}
                      {accounts.filter(acc => !acc.accountType || acc.accountType === 'INVESTMENT').length === 0 && (
                        <div className="text-center py-8 text-muted-foreground">
                          No investment accounts found. Create an account first.
                        </div>
                      )}
                    </div>
                    <DialogFooter>
                      <Button
                        variant="outline"
                        onClick={() => {
                          setQuickUpdateAmounts({});
                          setShowQuickUpdateDialog(false);
                        }}
                      >
                        Cancel
                      </Button>
                      <Button
                        onClick={handleQuickUpdate}
                        disabled={isUpdatingBalances || accounts.filter(acc => !acc.accountType || acc.accountType === 'INVESTMENT').length === 0}
                      >
                        {isUpdatingBalances ? "Updating..." : "Update Balances"}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              )}
            </div>
          </div>

          {currentView === "overview" && renderOverview()}
          {currentView === "accounts" && (
            <AccountsView 
              accounts={accounts} 
              baseCurrency={baseCurrency}
              exchangeRates={exchangeRates}
              convertToBaseCurrency={convertToBaseCurrency}
              onAccountUpdate={async () => {
                await loadAccounts();
                await handlePostAccountUpdate();
                // Update today's performance data only when accounts are actually updated
                updateTodaysPerformanceData();
              }}
            />
          )}
          {currentView === "manual-investments" && (
            <OtherPortfolioView accounts={accounts} />
          )}
          {currentView === "currency" && (
            <CurrencyView 
              baseCurrency={baseCurrency}
            />
          )}
          {currentView === "integration" && (
            <IBPortfolioView 
              baseCurrency={baseCurrency}
              onAccountUpdate={async () => {
                await loadAccounts();
                await handlePostAccountUpdate();
                // Update today's performance data only when accounts are actually updated
                updateTodaysPerformanceData();
              }}
            />
          )}
          {currentView === "other-assets" && (
            <OtherAssetsView 
              baseCurrency={baseCurrency}
              exchangeRates={exchangeRates}
              convertToBaseCurrency={convertToBaseCurrency}
            />
          )}
        </div>
      </main>
    </div>
  );
};

export default Dashboard;