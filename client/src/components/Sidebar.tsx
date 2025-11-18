import { Button } from "@/components/ui/button";
import { 
  BarChart3, 
  Wallet, 
  DollarSign, 
  LogOut, 
  TrendingUp,
  Home,
  Menu,
  X,
  ChevronLeft,
  ChevronRight,
  Shield,
  ShieldCheck,
  PiggyBank,
  Building
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { useState } from "react";
import TwoFactorSetup from "./TwoFactorSetup";

interface User {
  id: number;
  email: string;
  name: string;
  baseCurrency: string;
  twoFactorEnabled?: boolean;
}

interface SidebarProps {
  currentView: string;
  onViewChange: (view: string) => void;
  onLogout: () => void;
  isOpen: boolean;
  onToggle: () => void;
  isCollapsed: boolean;
  onCollapse: () => void;
  user: User | null;
}

const Sidebar = ({ currentView, onViewChange, onLogout, isOpen, onToggle, isCollapsed, onCollapse, user }: SidebarProps) => {
  const isMobile = useIsMobile();
  const [showTwoFactorSetup, setShowTwoFactorSetup] = useState(false);
  const menuItems = [
    { id: "overview", label: "Overview", icon: Home },
    { id: "accounts", label: "Accounts", icon: Wallet },
    { id: "currency", label: "Currency", icon: DollarSign },
    { id: "portfolio", label: "Portfolio", icon: BarChart3 },
    { id: "integration", label: "IB Portfolio", icon: PiggyBank },
    { id: "manual-investments", label: "Other Portfolios", icon: PiggyBank },
    { id: "other-assets", label: "Other Assets", icon: Building },
  ];

  return (
    <>
      {/* 2FA Setup Modal */}
      {showTwoFactorSetup && (
        <div className="fixed inset-0 bg-gradient-hero z-50 flex items-center justify-center p-4">
          <TwoFactorSetup
            onComplete={() => {
              setShowTwoFactorSetup(false);
              // Refresh user data to show updated 2FA status
              window.location.reload();
            }}
            onCancel={() => setShowTwoFactorSetup(false)}
          />
        </div>
      )}

      {/* Mobile backdrop */}
      {isMobile && isOpen && (
        <div 
          className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40"
          onClick={onToggle}
        />
      )}
      
      {/* Sidebar */}
      <div className={cn(
        "bg-gradient-card border-r border-border flex flex-col transition-all duration-300",
        isMobile 
          ? cn(
              "fixed inset-y-0 left-0 z-50",
              isOpen ? "translate-x-0" : "-translate-x-full",
              isCollapsed ? "w-16" : "w-64"
            )
          : cn(
              "relative",
              isCollapsed ? "w-16" : "w-64"
            )
      )}>
        {/* Logo */}
        <div className={cn("border-b border-border", isCollapsed ? "p-3" : "p-6")}>
          <div className="flex items-center justify-between">
            <div className={cn("flex items-center", isCollapsed ? "justify-center" : "gap-2")}>
              <div 
                className={cn(
                  "p-2 bg-gradient-primary rounded-lg transition-smooth",
                  isCollapsed && !isMobile ? "cursor-pointer hover:opacity-80" : ""
                )}
                onClick={isCollapsed && !isMobile ? onCollapse : undefined}
                title={isCollapsed ? "Expand sidebar" : undefined}
              >
                <TrendingUp className="h-5 w-5 text-background" />
              </div>
              {!isCollapsed && (
                <span className="text-lg font-bold text-foreground">Investment Tracker</span>
              )}
            </div>
            <div className="flex items-center gap-1">
              {!isMobile && !isCollapsed && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onCollapse}
                  className="text-foreground hover:bg-background/50"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
              )}
              {isMobile && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onToggle}
                  className="text-foreground hover:bg-background/50"
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </div>

      {/* Navigation */}
      <nav className={cn("flex-1", isCollapsed ? "p-3" : "p-6")}>
        <div className="space-y-2">
          {menuItems.map((item) => {
            const Icon = item.icon;
            return (
                <Button
                  key={item.id}
                  variant={currentView === item.id ? "default" : "ghost"}
                  size={isCollapsed ? "icon" : "default"}
                  className={cn(
                    "transition-smooth",
                    isCollapsed ? "w-10 h-10" : "w-full justify-start gap-3",
                    currentView === item.id 
                      ? "bg-gradient-primary text-background shadow-elegant" 
                      : "text-muted-foreground hover:text-foreground hover:bg-background/50"
                  )}
                  onClick={() => {
                    onViewChange(item.id);
                    if (isMobile && isOpen) {
                      onToggle();
                    }
                  }}
                  title={isCollapsed ? item.label : undefined}
                >
                <Icon className="h-4 w-4" />
                {!isCollapsed && item.label}
              </Button>
            );
          })}
        </div>
      </nav>

      {/* User & Logout */}
      <div className={cn("border-t border-border", isCollapsed ? "p-3" : "p-6")}>
        <div className="space-y-3">
          {!isCollapsed && user && (
            <div className="flex items-center gap-3 px-3 py-2">
              <div className="h-8 w-8 bg-gradient-primary rounded-full flex items-center justify-center">
                <span className="text-sm font-medium text-background">
                  {user.name.charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{user.name}</p>
                <p className="text-xs text-muted-foreground truncate">{user.email}</p>
              </div>
            </div>
          )}
          
          {isCollapsed && user && (
            <div className="flex justify-center mb-3">
              <div className="h-8 w-8 bg-gradient-primary rounded-full flex items-center justify-center">
                <span className="text-sm font-medium text-background">
                  {user.name.charAt(0).toUpperCase()}
                </span>
              </div>
            </div>
          )}

          {/* 2FA Setup Button */}
          {!isCollapsed && user && (
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start gap-3 text-muted-foreground hover:text-foreground hover:bg-background/50 transition-smooth"
              onClick={() => setShowTwoFactorSetup(true)}
            >
              {user.twoFactorEnabled ? (
                <ShieldCheck className="h-4 w-4 text-green-500" />
              ) : (
                <Shield className="h-4 w-4" />
              )}
              {user.twoFactorEnabled ? "2FA Enabled" : "Setup 2FA"}
            </Button>
          )}
          
          <Button
            variant="ghost"
            size={isCollapsed ? "icon" : "default"}
            className={cn(
              "text-muted-foreground hover:text-foreground hover:bg-background/50 transition-smooth",
              isCollapsed ? "w-10 h-10" : "w-full justify-start gap-3"
            )}
            onClick={onLogout}
            title={isCollapsed ? "Logout" : undefined}
          >
            <LogOut className="h-4 w-4" />
            {!isCollapsed && "Logout"}
          </Button>
        </div>
      </div>
      </div>
    </>
  );
};

export default Sidebar;