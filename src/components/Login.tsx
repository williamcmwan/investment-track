import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TrendingUp, Shield, DollarSign } from "lucide-react";

interface LoginProps {
  onLogin: () => void;
}

const Login = ({ onLogin }: LoginProps) => {
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    // Simulate login delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    setIsLoading(false);
    onLogin();
  };

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
          
          <Tabs defaultValue="login" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mx-6">
              <TabsTrigger value="login">Login</TabsTrigger>
              <TabsTrigger value="signup">Sign Up</TabsTrigger>
            </TabsList>
            
            <TabsContent value="login">
              <form onSubmit={handleSubmit}>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
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
                      type="password"
                      placeholder="Enter your password"
                      required
                      className="bg-background/50"
                    />
                  </div>
                </CardContent>
                <CardFooter>
                  <Button 
                    type="submit" 
                    className="w-full bg-gradient-primary hover:opacity-90 transition-smooth"
                    disabled={isLoading}
                  >
                    {isLoading ? "Signing in..." : "Sign In"}
                  </Button>
                </CardFooter>
              </form>
            </TabsContent>
            
            <TabsContent value="signup">
              <form onSubmit={handleSubmit}>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signup-name">Full Name</Label>
                    <Input
                      id="signup-name"
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
                      type="password"
                      placeholder="Create a password"
                      required
                      className="bg-background/50"
                    />
                  </div>
                </CardContent>
                <CardFooter>
                  <Button 
                    type="submit" 
                    className="w-full bg-gradient-primary hover:opacity-90 transition-smooth"
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