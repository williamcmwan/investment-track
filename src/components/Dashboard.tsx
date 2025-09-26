import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent } from "@/components/ui/chart";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from "recharts";
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  PlusCircle, 
  BarChart3, 
  ArrowUpRight, 
  ArrowDownRight,
  Wallet,
  ArrowLeftRight
} from "lucide-react";
import Sidebar from "./Sidebar";
import AccountsView from "./AccountsView";
import CurrencyView from "./CurrencyView";

// Mock data
const mockData = {
  totalCapital: 1500000, // HKD
  currentBalance: 1687500, // HKD
  totalProfitLoss: 187500, // HKD
  currencyProfitLoss: 25000, // HKD
  investmentProfitLoss: 162500, // HKD
  performanceHistory: [
    { date: "2024-01-01", totalPL: 0, investmentPL: 0, currencyPL: 0, dailyPL: 0 },
    { date: "2024-01-02", totalPL: 5000, investmentPL: 3500, currencyPL: 1500, dailyPL: 5000 },
    { date: "2024-01-03", totalPL: 12000, investmentPL: 8500, currencyPL: 3500, dailyPL: 7000 },
    { date: "2024-01-04", totalPL: 8000, investmentPL: 7000, currencyPL: 1000, dailyPL: -4000 },
    { date: "2024-01-05", totalPL: 15000, investmentPL: 12000, currencyPL: 3000, dailyPL: 7000 },
    { date: "2024-01-08", totalPL: 22000, investmentPL: 18000, currencyPL: 4000, dailyPL: 7000 },
    { date: "2024-01-09", totalPL: 18000, investmentPL: 16000, currencyPL: 2000, dailyPL: -4000 },
    { date: "2024-01-10", totalPL: 25000, investmentPL: 21000, currencyPL: 4000, dailyPL: 7000 },
    { date: "2024-01-11", totalPL: 35000, investmentPL: 28000, currencyPL: 7000, dailyPL: 10000 },
    { date: "2024-01-12", totalPL: 42000, investmentPL: 35000, currencyPL: 7000, dailyPL: 7000 },
    { date: "2024-01-15", totalPL: 187500, investmentPL: 162500, currencyPL: 25000, dailyPL: 145500 }
  ],
  accounts: [
    {
      id: 1,
      name: "Interactive Brokers",
      currency: "USD",
      originalCapital: 100000,
      currentBalance: 125000,
      lastUpdated: "2024-01-15",
      profitLoss: 25000,
      profitLossPercent: 25,
      history: [
        { date: "2024-01-15", balance: 125000, note: "Current balance" },
        { date: "2024-01-10", balance: 122000, note: "Weekly update" },
        { date: "2024-01-05", balance: 118000, note: "Portfolio rebalance" },
        { date: "2024-01-01", balance: 115000, note: "New year update" },
        { date: "2023-12-20", balance: 110000, note: "Year-end position" },
        { date: "2023-12-01", balance: 100000, note: "Initial deposit" }
      ]
    },
    {
      id: 2,
      name: "Saxo Bank",
      currency: "EUR",
      originalCapital: 80000,
      currentBalance: 85000,
      lastUpdated: "2024-01-14",
      profitLoss: 5000,
      profitLossPercent: 6.25,
      history: [
        { date: "2024-01-14", balance: 85000, note: "Current balance" },
        { date: "2024-01-08", balance: 83500, note: "Market adjustment" },
        { date: "2024-01-02", balance: 82000, note: "New year position" },
        { date: "2023-12-15", balance: 80000, note: "Initial deposit" }
      ]
    },
    {
      id: 3,
      name: "Futu Securities",
      currency: "HKD",
      originalCapital: 500000,
      currentBalance: 485000,
      lastUpdated: "2024-01-15",
      profitLoss: -15000,
      profitLossPercent: -3,
      history: [
        { date: "2024-01-15", balance: 485000, note: "Current balance" },
        { date: "2024-01-12", balance: 490000, note: "Market volatility" },
        { date: "2024-01-08", balance: 495000, note: "Weekly review" },
        { date: "2024-01-01", balance: 500000, note: "Initial deposit" }
      ]
    }
  ],
  currencies: [
    { pair: "USD/HKD", rate: 7.85, avgCost: 7.75, profitLoss: 12800, amount: 128000 },
    { pair: "EUR/HKD", rate: 8.45, avgCost: 8.50, profitLoss: -4000, amount: 80000 },
    { pair: "GBP/HKD", rate: 9.95, avgCost: 9.80, profitLoss: 3000, amount: 20000 }
  ]
};

interface DashboardProps {
  onLogout: () => void;
  sidebarOpen: boolean;
  onSidebarToggle: () => void;
}

const Dashboard = ({ onLogout, sidebarOpen, onSidebarToggle }: DashboardProps) => {
  const [currentView, setCurrentView] = useState("overview");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [baseCurrency, setBaseCurrency] = useState("HKD");

  // Exchange rates for currency conversion (mock data - in real app, fetch from API)
  const exchangeRates: { [key: string]: number } = {
    "USD": 7.85, // USD to HKD
    "EUR": 8.45, // EUR to HKD  
    "GBP": 9.95, // GBP to HKD
    "CAD": 5.85, // CAD to HKD
    "SGD": 5.75, // SGD to HKD
    "JPY": 0.053, // JPY to HKD
    "HKD": 1.0
  };

  const convertToBaseCurrency = (amount: number, fromCurrency: string) => {
    if (fromCurrency === baseCurrency) return amount;
    
    // Convert to HKD first, then to base currency
    const amountInHKD = fromCurrency === "HKD" ? amount : amount * exchangeRates[fromCurrency];
    const baseRate = exchangeRates[baseCurrency];
    
    return baseCurrency === "HKD" ? amountInHKD : amountInHKD / baseRate;
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
    // Convert all amounts to base currency
    const totalCapitalConverted = convertToBaseCurrency(mockData.totalCapital, "HKD");
    const currentBalanceConverted = convertToBaseCurrency(mockData.currentBalance, "HKD");
    const totalProfitLossConverted = convertToBaseCurrency(mockData.totalProfitLoss, "HKD");
    const currencyProfitLossConverted = convertToBaseCurrency(mockData.currencyProfitLoss, "HKD");
    const investmentProfitLossConverted = convertToBaseCurrency(mockData.investmentProfitLoss, "HKD");

    // Convert historical data to base currency
    const chartData = mockData.performanceHistory.map(item => ({
      date: item.date,
      totalPL: convertToBaseCurrency(item.totalPL, "HKD"),
      investmentPL: convertToBaseCurrency(item.investmentPL, "HKD"),
      currencyPL: convertToBaseCurrency(item.currencyPL, "HKD"),
      dailyPL: convertToBaseCurrency(item.dailyPL, "HKD")
    }));

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

    return (
      <div className="space-y-6">
        {/* Performance Chart */}
        <Card className="bg-gradient-card border-border shadow-card">
          <CardHeader className="pb-2 md:pb-6">
            <CardTitle className="text-sm md:text-base text-foreground">Performance Overview</CardTitle>
            <CardDescription className="text-xs md:text-sm">Profit & Loss trends over time</CardDescription>
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
                  tickFormatter={(value) => {
                    const date = new Date(value);
                    return window.innerWidth < 768 
                      ? date.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' })
                      : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                  }}
                  fontSize={10}
                  tickMargin={5}
                  interval="preserveStartEnd"
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis 
                  tickFormatter={(value) => {
                    const formatted = formatCurrency(value).replace(/[A-Z$€£¥]/g, '');
                    return window.innerWidth < 768 ? formatted.replace(/,/g, '') : formatted;
                  }}
                  fontSize={10}
                  tickMargin={5}
                  width={window.innerWidth < 768 ? 45 : 60}
                  axisLine={false}
                  tickLine={false}
                />
                <ChartTooltip 
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="bg-background border border-border rounded-lg p-2 shadow-lg max-w-[280px] md:max-w-xs">
                          <p className="font-medium text-foreground mb-1 text-[10px] md:text-xs">
                            {new Date(label).toLocaleDateString('en-US', { 
                              month: 'short', 
                              day: 'numeric',
                              year: window.innerWidth < 768 ? undefined : 'numeric'
                            })}
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
                                  {formatCurrency(entry.value as number)}
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
        </Card>
        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 md:gap-6">
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

          <Card className="bg-gradient-card border-border shadow-card">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total P&L</CardTitle>
              {totalProfitLossConverted > 0 ? (
                <TrendingUp className="h-4 w-4 text-profit" />
              ) : (
                <TrendingDown className="h-4 w-4 text-loss" />
              )}
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${totalProfitLossConverted > 0 ? 'text-profit' : 'text-loss'}`}>
                {formatCurrency(totalProfitLossConverted)}
              </div>
              <p className="text-xs text-muted-foreground">
                {formatPercent((totalProfitLossConverted / totalCapitalConverted) * 100)}
              </p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-card border-border shadow-card">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Currency P&L</CardTitle>
              <ArrowLeftRight className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${currencyProfitLossConverted > 0 ? 'text-profit' : 'text-loss'}`}>
                {formatCurrency(currencyProfitLossConverted)}
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

      {/* Recent Accounts */}
      <Card className="bg-gradient-card border-border shadow-card">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-foreground">Investment Accounts</CardTitle>
            <CardDescription>Recent account balances</CardDescription>
          </div>
          <Button 
            variant="outline" 
            onClick={() => setCurrentView("accounts")}
            className="border-primary text-primary hover:bg-primary/10"
          >
            View All
          </Button>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {mockData.accounts.slice(0, 3).map((account) => (
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
      />
      
      <main className="flex-1 overflow-auto">
        <div className="p-4 md:p-6">
          <div className="mb-6">
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

          {currentView === "overview" && renderOverview()}
          {currentView === "accounts" && <AccountsView accounts={mockData.accounts} />}
          {currentView === "currency" && (
            <CurrencyView 
              currencies={mockData.currencies} 
              baseCurrency={baseCurrency}
              onBaseCurrencyChange={setBaseCurrency}
            />
          )}
        </div>
      </main>
    </div>
  );
};

export default Dashboard;