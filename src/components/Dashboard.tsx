import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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

  const formatCurrency = (amount: number, currency = "HKD") => {
    return new Intl.NumberFormat("en-HK", {
      style: "currency",
      currency: currency,
    }).format(amount);
  };

  const formatPercent = (percent: number) => {
    return `${percent > 0 ? "+" : ""}${percent.toFixed(2)}%`;
  };

  const renderOverview = () => (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 md:gap-6">
        <Card className="bg-gradient-card border-border shadow-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Capital</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              {formatCurrency(mockData.totalCapital)}
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
              {formatCurrency(mockData.currentBalance)}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-card border-border shadow-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total P&L</CardTitle>
            {mockData.totalProfitLoss > 0 ? (
              <TrendingUp className="h-4 w-4 text-profit" />
            ) : (
              <TrendingDown className="h-4 w-4 text-loss" />
            )}
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${mockData.totalProfitLoss > 0 ? 'text-profit' : 'text-loss'}`}>
              {formatCurrency(mockData.totalProfitLoss)}
            </div>
            <p className="text-xs text-muted-foreground">
              {formatPercent((mockData.totalProfitLoss / mockData.totalCapital) * 100)}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-card border-border shadow-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Currency P&L</CardTitle>
            <ArrowLeftRight className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${mockData.currencyProfitLoss > 0 ? 'text-profit' : 'text-loss'}`}>
              {formatCurrency(mockData.currencyProfitLoss)}
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
          <div className="flex items-center justify-between p-4 bg-background/30 rounded-lg">
            <div className="flex items-center gap-3">
              <BarChart3 className="h-5 w-5 text-primary" />
              <div>
                <p className="font-medium text-foreground">Investment P&L</p>
                <p className="text-sm text-muted-foreground">Excluding currency effects</p>
              </div>
            </div>
            <div className="text-right">
              <p className={`font-bold ${mockData.investmentProfitLoss > 0 ? 'text-profit' : 'text-loss'}`}>
                {formatCurrency(mockData.investmentProfitLoss)}
              </p>
              <p className="text-sm text-muted-foreground">
                {formatPercent((mockData.investmentProfitLoss / mockData.totalCapital) * 100)}
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between p-4 bg-background/30 rounded-lg">
            <div className="flex items-center gap-3">
              <ArrowLeftRight className="h-5 w-5 text-primary" />
              <div>
                <p className="font-medium text-foreground">Currency P&L</p>
                <p className="text-sm text-muted-foreground">Exchange rate fluctuations</p>
              </div>
            </div>
            <div className="text-right">
              <p className={`font-bold ${mockData.currencyProfitLoss > 0 ? 'text-profit' : 'text-loss'}`}>
                {formatCurrency(mockData.currencyProfitLoss)}
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
              <div key={account.id} className="flex items-center justify-between p-4 bg-background/30 rounded-lg">
                <div className="flex items-center gap-3">
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
                  <div className="flex items-center gap-1">
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
          {currentView === "currency" && <CurrencyView currencies={mockData.currencies} />}
        </div>
      </main>
    </div>
  );
};

export default Dashboard;