import { Button } from "@/components/ui/button";
import { 
  BarChart3, 
  Wallet, 
  ArrowLeftRight, 
  LogOut, 
  TrendingUp,
  Home 
} from "lucide-react";
import { cn } from "@/lib/utils";

interface SidebarProps {
  currentView: string;
  onViewChange: (view: string) => void;
  onLogout: () => void;
}

const Sidebar = ({ currentView, onViewChange, onLogout }: SidebarProps) => {
  const menuItems = [
    { id: "overview", label: "Overview", icon: Home },
    { id: "accounts", label: "Accounts", icon: Wallet },
    { id: "currency", label: "Currency", icon: ArrowLeftRight },
  ];

  return (
    <div className="w-64 bg-gradient-card border-r border-border flex flex-col">
      {/* Logo */}
      <div className="p-6 border-b border-border">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-gradient-primary rounded-lg">
            <TrendingUp className="h-5 w-5 text-background" />
          </div>
          <span className="text-lg font-bold text-foreground">InvestTracker</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-6">
        <div className="space-y-2">
          {menuItems.map((item) => {
            const Icon = item.icon;
            return (
              <Button
                key={item.id}
                variant={currentView === item.id ? "default" : "ghost"}
                className={cn(
                  "w-full justify-start gap-3 transition-smooth",
                  currentView === item.id 
                    ? "bg-gradient-primary text-background shadow-elegant" 
                    : "text-muted-foreground hover:text-foreground hover:bg-background/50"
                )}
                onClick={() => onViewChange(item.id)}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Button>
            );
          })}
        </div>
      </nav>

      {/* User & Logout */}
      <div className="p-6 border-t border-border">
        <div className="space-y-3">
          <div className="flex items-center gap-3 px-3 py-2">
            <div className="h-8 w-8 bg-gradient-primary rounded-full flex items-center justify-center">
              <span className="text-sm font-medium text-background">JD</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">John Doe</p>
              <p className="text-xs text-muted-foreground truncate">john@example.com</p>
            </div>
          </div>
          
          <Button
            variant="ghost"
            className="w-full justify-start gap-3 text-muted-foreground hover:text-foreground hover:bg-background/50 transition-smooth"
            onClick={onLogout}
          >
            <LogOut className="h-4 w-4" />
            Logout
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;