import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TrendingUp, Shield, DollarSign } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import TwoFactorVerification from "./TwoFactorVerification";

interface LoginProps {
  onLogin: () => void;
}

const Login = ({ onLogin }: LoginProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("login");
  const [showTwoFactor, setShowTwoFactor] = useState(false);
  const [twoFactorUserId, setTwoFactorUserId] = useState<number | null>(null);
  const [loginCredentials, setLoginCredentials] = useState<{email: string, password: string} | null>(null);
  const { login, loginWithTwoFactor, register } = useAuth();
  const { toast } = useToast();

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    
    const formData = new FormData(e.currentTarget);
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;

    // Store credentials for 2FA completion
    setLoginCredentials({ email, password });

    const result = await login(email, password);
    if (result.success) {
      onLogin();
    } else if (result.requiresTwoFactor) {
      setTwoFactorUserId(result.userId!);
      setShowTwoFactor(true);
    } else {
      toast({
        title: "Login Failed",
        description: result.error || "Invalid email or password",
        variant: "destructive",
      });
    }
    setIsLoading(false);
  };

  const handleTwoFactorSuccess = async (token: string) => {
    if (!loginCredentials || !twoFactorUserId) {
      toast({
        title: "Error",
        description: "Missing login credentials. Please try again.",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsLoading(true);
      const result = await loginWithTwoFactor(twoFactorUserId, token);
      
      if (result.success) {
        setShowTwoFactor(false);
        setTwoFactorUserId(null);
        setLoginCredentials(null);
        onLogin();
      } else {
        toast({
          title: "Login Failed",
          description: result.error || "2FA verification failed",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('2FA login error:', error);
      toast({
        title: "Login Failed",
        description: "An error occurred during login",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleTwoFactorCancel = () => {
    setShowTwoFactor(false);
    setTwoFactorUserId(null);
  };

  const handleRegister = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    
    const formData = new FormData(e.currentTarget);
    const name = formData.get('signup-name') as string;
    const email = formData.get('signup-email') as string;
    const password = formData.get('signup-password') as string;
    const passwordConfirm = formData.get('signup-password-confirm') as string;
    const baseCurrency = formData.get('base-currency') as string || 'HKD';

    // Validate password confirmation
    if (password !== passwordConfirm) {
      toast({
        title: "Registration Failed",
        description: "Passwords do not match. Please try again.",
        variant: "destructive",
      });
      setIsLoading(false);
      return;
    }

    // Validate password length
    if (password.length < 6) {
      toast({
        title: "Registration Failed",
        description: "Password must be at least 6 characters long.",
        variant: "destructive",
      });
      setIsLoading(false);
      return;
    }

    console.log('Form data:', { name, email, password, baseCurrency });

    const result = await register({ name, email, password, baseCurrency });
    if (result.success) {
      onLogin();
    } else {
      toast({
        title: "Registration Failed",
        description: result.error || "Failed to create account. Please try again.",
        variant: "destructive",
      });
    }
    setIsLoading(false);
  };

  if (showTwoFactor && twoFactorUserId) {
    return (
      <div className="min-h-screen bg-gradient-hero flex items-center justify-center p-4">
        <TwoFactorVerification
          userId={twoFactorUserId}
          onSuccess={handleTwoFactorSuccess}
          onCancel={handleTwoFactorCancel}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-hero flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-4">
            <div className="p-2 bg-gradient-primary rounded-lg">
              <TrendingUp className="h-6 w-6 text-background" />
            </div>
            <h1 className="text-2xl font-bold text-foreground">InvestTracker</h1>
          </div>
          <p className="text-muted-foreground">Track your investments with precision</p>
        </div>

        <Card className="bg-gradient-card border-border shadow-card">
          <CardHeader className="text-center">
            <CardTitle className="text-foreground">Welcome Back</CardTitle>
            <CardDescription>Sign in to access your investment dashboard</CardDescription>
          </CardHeader>
          
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid grid-cols-2 w-48 mx-auto">
              <TabsTrigger value="login">Login</TabsTrigger>
              <TabsTrigger value="signup">Sign Up</TabsTrigger>
            </TabsList>
            
            <TabsContent value="login">
              <form onSubmit={handleLogin}>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      placeholder="Enter your email"
                      required
                      className="bg-background/50"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">Password</Label>
                    <Input
                      id="password"
                      name="password"
                      type="password"
                      placeholder="Enter your password"
                      required
                      className="bg-background/50"
                    />
                  </div>
                </CardContent>
                <CardFooter className="px-6 pb-4 pt-2 flex justify-center">
                  <Button 
                    type="submit" 
                    size="sm"
                    className="w-32 h-8 bg-gradient-primary hover:opacity-90 transition-smooth text-sm"
                    disabled={isLoading}
                  >
                    {isLoading ? "Signing in..." : "Sign In"}
                  </Button>
                </CardFooter>
              </form>
            </TabsContent>
            
            <TabsContent value="signup">
              <form onSubmit={handleRegister}>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signup-name">Full Name</Label>
                    <Input
                      id="signup-name"
                      name="signup-name"
                      type="text"
                      placeholder="Enter your full name"
                      required
                      className="bg-background/50"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-email">Email</Label>
                    <Input
                      id="signup-email"
                      name="signup-email"
                      type="email"
                      placeholder="Enter your email"
                      required
                      className="bg-background/50"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-password">Password</Label>
                    <Input
                      id="signup-password"
                      name="signup-password"
                      type="password"
                      placeholder="Create a password"
                      required
                      className="bg-background/50"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-password-confirm">Confirm Password</Label>
                    <Input
                      id="signup-password-confirm"
                      name="signup-password-confirm"
                      type="password"
                      placeholder="Confirm your password"
                      required
                      className="bg-background/50"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="base-currency">Base Currency</Label>
                    <Select name="base-currency" defaultValue="HKD">
                      <SelectTrigger className="bg-background/50">
                        <SelectValue placeholder="Select base currency" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="HKD">🇭🇰 HKD - Hong Kong Dollar</SelectItem>
                        <SelectItem value="USD">🇺🇸 USD - US Dollar</SelectItem>
                        <SelectItem value="EUR">🇪🇺 EUR - Euro</SelectItem>
                        <SelectItem value="GBP">🇬🇧 GBP - British Pound</SelectItem>
                        <SelectItem value="CAD">🇨🇦 CAD - Canadian Dollar</SelectItem>
                        <SelectItem value="SGD">🇸🇬 SGD - Singapore Dollar</SelectItem>
                        <SelectItem value="JPY">🇯🇵 JPY - Japanese Yen</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
                <CardFooter className="px-6 pb-4 pt-2 flex justify-center">
                  <Button 
                    type="submit" 
                    size="sm"
                    className="w-32 h-8 bg-gradient-primary hover:opacity-90 transition-smooth text-sm"
                    disabled={isLoading}
                  >
                    {isLoading ? "Creating account..." : "Create Account"}
                  </Button>
                </CardFooter>
              </form>
            </TabsContent>
          </Tabs>
        </Card>

        <div className="mt-8 grid grid-cols-3 gap-4 text-center">
          <div className="space-y-2">
            <Shield className="h-6 w-6 text-primary mx-auto" />
            <p className="text-xs text-muted-foreground">Secure</p>
          </div>
          <div className="space-y-2">
            <TrendingUp className="h-6 w-6 text-primary mx-auto" />
            <p className="text-xs text-muted-foreground">Analytics</p>
          </div>
          <div className="space-y-2">
            <DollarSign className="h-6 w-6 text-primary mx-auto" />
            <p className="text-xs text-muted-foreground">Multi-Currency</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;