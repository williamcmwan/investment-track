import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { useToast } from '../hooks/use-toast';
import { apiClient } from '../services/api';

interface TwoFactorSetupProps {
  onComplete: () => void;
  onCancel: () => void;
}

const TwoFactorSetup: React.FC<TwoFactorSetupProps> = ({ onComplete, onCancel }) => {
  const [step, setStep] = useState<'setup' | 'verify'>('setup');
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');
  const [manualKey, setManualKey] = useState<string>('');
  const [verificationCode, setVerificationCode] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (step === 'setup') {
      generateSetup();
    }
  }, [step]);

  const generateSetup = async () => {
    try {
      setIsLoading(true);
      const response = await apiClient.setupTwoFactor();

      if (response.data) {
        setQrCodeUrl(response.data.qrCodeUrl);
        setManualKey(response.data.manualEntryKey);
      } else {
        throw new Error(response.error || 'Failed to generate 2FA setup');
      }
    } catch (error) {
      console.error('2FA setup error:', error);
      toast({
        title: "Setup Failed",
        description: "Failed to generate 2FA setup. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const verifyAndEnable = async () => {
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
      const response = await apiClient.verifyTwoFactor(verificationCode);

      if (response.data) {
        toast({
          title: "2FA Enabled",
          description: "Two-factor authentication has been enabled successfully!",
        });
        onComplete();
      } else {
        throw new Error(response.error || 'Failed to verify 2FA code');
      }
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

  if (step === 'setup') {
    return (
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Enable Two-Factor Authentication</CardTitle>
          <CardDescription>
            Scan the QR code with your authenticator app to set up 2FA
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading ? (
            <div className="flex items-center justify-center p-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : (
            <>
              <div className="flex justify-center">
                {qrCodeUrl && (
                  <img 
                    src={qrCodeUrl} 
                    alt="2FA QR Code" 
                    className="w-48 h-48 border rounded"
                  />
                )}
              </div>
              
              <div className="text-center">
                <p className="text-sm text-muted-foreground mb-2">
                  Can't scan the QR code? Enter this key manually:
                </p>
                <code className="bg-muted px-2 py-1 rounded text-sm break-all">
                  {manualKey}
                </code>
              </div>

              <div className="flex gap-2">
                <Button onClick={() => setStep('verify')} className="flex-1">
                  I've Added the Account
                </Button>
                <Button variant="outline" onClick={onCancel}>
                  Cancel
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Verify Setup</CardTitle>
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
            maxLength={6}
            className="text-center text-lg tracking-widest"
          />
        </div>

        <div className="flex gap-2">
          <Button 
            onClick={verifyAndEnable} 
            disabled={isLoading || verificationCode.length !== 6}
            className="flex-1"
          >
            {isLoading ? 'Verifying...' : 'Verify & Enable'}
          </Button>
          <Button variant="outline" onClick={() => setStep('setup')}>
            Back
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default TwoFactorSetup;
