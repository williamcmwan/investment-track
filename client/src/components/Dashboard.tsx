import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent } from "@/components/ui/chart";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from "recharts";
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
  RefreshCw,
  Zap
} from "lucide-react";
import Sidebar from "./Sidebar";
import AccountsView from "./AccountsView";
import CurrencyView from "./CurrencyView";
import { useAuth } from "@/contexts/AuthContext";
import { apiClient } from "@/services/api";
import { useToast } from "@/hooks/use-toast";

// Interface definitions
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
  const [isRefreshingRates, setIsRefreshingRates] = useState(false);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [isLoadingAccounts, setIsLoadingAccounts] = useState(false);
  const [exchangeRates, setExchangeRates] = useState<Record<string, number>>({});
  const [currencies, setCurrencies] = useState<any[]>([]);
  const [performanceHistory, setPerformanceHistory] = useState<any[]>([]);
  const [isLoadingPerformance, setIsLoadingPerformance] = useState(false);
  const [showPerformanceDetails, setShowPerformanceDetails] = useState(true);
  const [performancePage, setPerformancePage] = useState(0);
  const [allPerformanceData, setAllPerformanceData] = useState<any[]>([]);
  
  // Pagination constants
  const ITEMS_PER_PAGE = 30;
  
  // Get paginated performance data with previous day data
  const getPaginatedPerformanceData = () => {
    const startIndex = performancePage * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    
    // Create a map for quick lookup of previous day data
    const dataByDate = new Map();
    allPerformanceData.forEach(item => {
      dataByDate.set(item.date, item);
    });
    
    return allPerformanceData.slice(startIndex, endIndex).map(row => {
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
  
  const totalPages = Math.ceil(allPerformanceData.length / ITEMS_PER_PAGE);
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

  // Load accounts when component mounts and user is authenticated
  useEffect(() => {
    if (user) {
      loadAccounts();
      loadCurrencies();
    }
  }, [user]);

  // Fetch exchange rates when accounts change and user is authenticated
  useEffect(() => {
    if (accounts.length > 0 && user) {
      fetchExchangeRates();
    }
  }, [accounts, baseCurrency, user]);

  // Auto-refresh rates silently when overview page is visited
  useEffect(() => {
    if (currentView === "overview") {
      handleEnhancedRefreshRates();
    }
  }, [currentView]);

  // Load performance history function
  const loadPerformanceHistory = async () => {
    try {
      setIsLoadingPerformance(true);
      const response = await apiClient.getPerformanceChartData(); // Get all data
      if (response.data) {
        // Sort in descending order (newest first) for table display
        const sortedDesc = [...response.data].sort((a: any, b: any) => {
          const da = new Date(a.date).getTime();
          const db = new Date(b.date).getTime();
          return db - da; // Descending order
        });
        setAllPerformanceData(sortedDesc);
        
        // For chart, we still want chronological order (oldest to newest)
        const sortedAsc = [...response.data].sort((a: any, b: any) => {
          const da = new Date(a.date).getTime();
          const db = new Date(b.date).getTime();
          return da - db; // Ascending order for chart
        });
        setPerformanceHistory(sortedAsc.slice(-30)); // Last 30 days for chart
      }
    } catch (error) {
      console.error('Error loading performance history:', error);
      // Fallback to generating on-the-fly if no stored data
      generatePerformanceHistoryOnTheFly();
    } finally {
      setIsLoadingPerformance(false);
    }
  };

  // Load performance history when component mounts or when user changes
  useEffect(() => {
    if (user) {
      loadPerformanceHistory();
    }
  }, [user]);

  // Reset page when performance data changes
  useEffect(() => {
    setPerformancePage(0);
  }, [allPerformanceData.length]);

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
      const response = await apiClient.getCurrencyPairs(true);
      if (response.data) {
        setCurrencies(response.data);
      } else {
        console.error('Failed to load currencies:', response.error);
      }
    } catch (error) {
      console.error('Error loading currencies:', error);
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
      // Get unique currencies from accounts
      const currencies = [...new Set(accounts.map(acc => acc.currency))];
      
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

    const totalCapital = accounts.reduce((sum, acc) => 
      sum + convertToBaseCurrency(acc.originalCapital, acc.currency), 0
    );
    
    const currentBalance = accounts.reduce((sum, acc) => 
      sum + convertToBaseCurrency(acc.currentBalance, acc.currency), 0
    );
    
    // Get the Total P&L from Investment Accounts page (this is the main total)
    const totalProfitLoss = accounts.reduce((sum, acc) => 
      sum + convertToBaseCurrency(acc.profitLoss, acc.currency), 0
    );
    
    // Get Currency P&L from Currency Exchange page
    const currencyProfitLoss = calculateCurrencyPL();
    
    // Investment P&L = Total P&L - Currency P&L
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

  // Function to refresh with enhanced accuracy (multiple sources) - silent
  const handleEnhancedRefreshRates = async () => {
    try {
      setIsRefreshingRates(true);
      const response = await apiClient.updateEnhancedExchangeRates();
      if (response.data) {
        // Silent update - no toast notification
        console.log('Enhanced exchange rates updated silently');
      } else {
        console.error('Failed to update enhanced exchange rates:', response.error);
      }
    } catch (error) {
      console.error('Error updating enhanced rates:', error);
    } finally {
      setIsRefreshingRates(false);
    }
  };

  const formatCurrency = (amount: number, currency = baseCurrency) => {
    return new Intl.NumberFormat("en-HK", {
      style: "currency",
      currency: currency,
    }).format(amount);
  };

  const formatPercent = (percent: number) => {
    return `${percent > 0 ? "+" : ""}${percent.toFixed(2)}%`;
  };

  const renderOverview = () => {
    const summaryData = calculateSummaryData();

    const generatePerformanceHistoryOnTheFly = () => {
      // Create a Map to store aggregated data by date
      const dateMap = new Map<string, {
        date: string;
        totalPL: number;
        investmentPL: number;
        currencyPL: number;
        dailyPL: number;
      }>();
      
      // Process all accounts and aggregate data by date
      accounts.forEach(account => {
        (account.history || []).forEach(entry => {
          if (entry.date) {
            // Extract date part from timestamp (handle both 'YYYY-MM-DD' and 'YYYY-MM-DD HH:MM:SS' formats)
            let dateStr = entry.date;
            if (dateStr.includes(' ')) {
              // Handle 'YYYY-MM-DD HH:MM:SS' format
              dateStr = dateStr.split(' ')[0];
            } else if (dateStr.includes('T')) {
              // Handle 'YYYY-MM-DDTHH:MM:SS' format
              dateStr = dateStr.split('T')[0];
            }
            // If already in 'YYYY-MM-DD' format, keep as is
            
            // Get or create entry for this date
            let dateEntry = dateMap.get(dateStr);
            if (!dateEntry) {
              dateEntry = {
                date: dateStr,
                totalPL: 0,
                investmentPL: 0,
                currencyPL: 0,
                dailyPL: 0
              };
              dateMap.set(dateStr, dateEntry);
            }
            
            // Add this account's contribution to the date
            // Calculate P&L based on the balance at this date vs original capital
            const currentBalance = convertToBaseCurrency(entry.balance, account.currency);
            const originalCapital = convertToBaseCurrency(account.originalCapital, account.currency);
            const accountPL = currentBalance - originalCapital;
            
            dateEntry.totalPL += accountPL;
            dateEntry.investmentPL += accountPL;
          }
        });
      });
      
      // Convert map to array and calculate actual currency P&L
      const history = Array.from(dateMap.values()).map(entry => {
        // Calculate actual currency P&L from currency pairs
        const currencyPL = calculateCurrencyPL();
        
        return {
          date: entry.date,
          totalPL: entry.totalPL + currencyPL,
          investmentPL: entry.investmentPL,
          currencyPL: currencyPL,
          dailyPL: 0
        };
      });
      
      // Sort by date to ensure proper chronological order for chart
      const sortedAsc = [...history].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      setPerformanceHistory(sortedAsc.slice(-30)); // Last 30 days for chart
      
      // Sort in descending order for table display
      const sortedDesc = [...history].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setAllPerformanceData(sortedDesc);
    };

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
    const chartData = performanceHistory;

    return (
      <div className="space-y-6">
        {/* Performance Chart */}
        <Card className="bg-gradient-card border-border shadow-card">
          <CardHeader className="pb-2 md:pb-6 flex flex-row items-start md:items-center justify-between gap-3">
            <CardTitle className="text-sm md:text-base text-foreground">Performance Overview</CardTitle>
            <div className="flex items-center gap-2 ml-auto">
              <CardDescription className="text-xs md:text-sm hidden md:block">Profit & Loss trends over time</CardDescription>
              <Button
                variant="outline"
                size="sm"
                className="border-primary text-primary hover:bg-primary/10"
                onClick={() => setShowPerformanceDetails(v => !v)}
              >
                {showPerformanceDetails ? 'Hide Details' : 'View Details'}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-2 md:p-6">
            <ChartContainer config={chartConfig} className="h-[250px] md:h-[400px] w-full">
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
              {allPerformanceData.length > ITEMS_PER_PAGE && (
                <div className="flex items-center justify-between px-4 py-3 border-t border-border/30">
                  <div className="text-xs text-muted-foreground">
                    Showing {performancePage * ITEMS_PER_PAGE + 1} to {Math.min((performancePage + 1) * ITEMS_PER_PAGE, allPerformanceData.length)} of {allPerformanceData.length} entries
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
        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6">
          <Card className="bg-gradient-card border-border shadow-card">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Capital</CardTitle>
              <Wallet className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">
                {formatCurrency(totalCapitalConverted)}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-card border-border shadow-card">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Current Balance</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">
                {formatCurrency(currentBalanceConverted)}
              </div>
            </CardContent>
          </Card>
        </div>

      {/* Profit/Loss Breakdown */}
      <Card className="bg-gradient-card border-border shadow-card">
        <CardHeader>
          <CardTitle className="text-foreground">Profit & Loss Breakdown</CardTitle>
          <CardDescription>Investment vs Currency performance</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
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

      {/* All Investment Accounts */}
      <Card className="bg-gradient-card border-border shadow-card">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-foreground">Investment Accounts</CardTitle>
            <CardDescription>All account balances</CardDescription>
          </div>
          <Button 
            variant="outline" 
            onClick={() => setCurrentView("accounts")}
            className="border-primary text-primary hover:bg-primary/10"
          >
            Manage Accounts
          </Button>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {accounts
              .sort((a, b) => {
                const aTotal = convertToBaseCurrency(a.currentBalance, a.currency);
                const bTotal = convertToBaseCurrency(b.currentBalance, b.currency);
                return bTotal - aTotal; // Sort by total amount descending
              })
              .map((account) => (
              <div key={account.id} className="flex items-center justify-end p-4 bg-background/30 rounded-lg">
                <div className="flex items-center gap-3 mr-auto">
                  <div className="p-2 bg-primary/20 rounded-lg">
                    <DollarSign className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">{account.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {account.currency} • Updated {account.lastUpdated}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-medium text-foreground">
                    {formatCurrency(convertToBaseCurrency(account.currentBalance, account.currency))}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatCurrency(account.currentBalance, account.currency)}
                  </p>
                  <div className="flex items-center justify-end gap-1">
                    {account.profitLoss > 0 ? (
                      <ArrowUpRight className="h-4 w-4 text-profit" />
                    ) : (
                      <ArrowDownRight className="h-4 w-4 text-loss" />
                    )}
                    <span className={`text-sm ${account.profitLoss > 0 ? 'text-profit' : 'text-loss'}`}>
                      {formatPercent(account.profitLossPercent)}
                    </span>
                  </div>
                </div>
              </div>
            ))}
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
              {currentView === "accounts" && "Investment Accounts"}
              {currentView === "currency" && "Currency Exchange"}
            </h1>
            <p className="text-muted-foreground">
              {currentView === "overview" && "Monitor your investment performance"}
              {currentView === "accounts" && "Manage your broker accounts"}
              {currentView === "currency" && "Track currency exchange rates"}
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
                  <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>Quick Update Account Balances</DialogTitle>
                      <DialogDescription>
                        Update the current balance for your investment accounts. Leave empty to skip an account.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      {accounts.map((account) => (
                        <div key={account.id} className="grid grid-cols-4 items-center gap-4">
                          <Label htmlFor={`account-${account.id}`} className="text-right font-medium">
                            {account.name}
                          </Label>
                          <div className="col-span-2">
                            <Input
                              id={`account-${account.id}`}
                              type="number"
                              step="0.01"
                              placeholder="Enter new balance"
                              value={quickUpdateAmounts[account.id] || ''}
                              onChange={(e) => handleAmountChange(account.id, e.target.value)}
                              className="w-full"
                            />
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {account.currency}
                          </div>
                        </div>
                      ))}
                      {accounts.length === 0 && (
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
                        disabled={isUpdatingBalances || accounts.length === 0}
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
              }}
            />
          )}
          {currentView === "currency" && (
            <CurrencyView 
              baseCurrency={baseCurrency}
            />
          )}
        </div>
      </main>
    </div>
  );
};

export default Dashboard;