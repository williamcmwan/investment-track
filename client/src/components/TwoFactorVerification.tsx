import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { useToast } from '../hooks/use-toast';

interface TwoFactorVerificationProps {
  userId: number;
  onSuccess: (token: string) => void;
  onCancel: () => void;
}

const TwoFactorVerification: React.FC<TwoFactorVerificationProps> = ({ 
  userId, 
  onSuccess, 
  onCancel 
}) => {
  const [verificationCode, setVerificationCode] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleVerification = async () => {
    if (!verificationCode || verificationCode.length !== 6) {
      toast({
        title: "Invalid Code",
        description: "Please enter a 6-digit verification code.",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsLoading(true);
      
      // Pass the verification code to the parent component
      // The parent will handle the API call
      onSuccess(verificationCode);
    } catch (error) {
      console.error('2FA verification error:', error);
      toast({
        title: "Verification Failed",
        description: "Invalid verification code. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && verificationCode.length === 6 && !isLoading) {
      handleVerification();
    }
  };

  return (
    <div className="min-h-screen w-full bg-gradient-hero flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Two-Factor Authentication</CardTitle>
        <CardDescription>
          Enter the 6-digit code from your authenticator app
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="verification-code">Verification Code</Label>
          <Input
            id="verification-code"
            type="text"
            placeholder="123456"
            value={verificationCode}
            onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            onKeyPress={handleKeyPress}
            maxLength={6}
            className="text-center text-lg tracking-widest"
            autoFocus
          />
        </div>

        <div className="text-center text-sm text-muted-foreground">
          Open your authenticator app and enter the 6-digit code
        </div>

        <div className="flex gap-2">
          <Button 
            onClick={handleVerification} 
            disabled={isLoading || verificationCode.length !== 6}
            className="flex-1"
          >
            {isLoading ? 'Verifying...' : 'Verify'}
          </Button>
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </CardContent>
      </Card>
    </div>
  );
};

export default TwoFactorVerification;
