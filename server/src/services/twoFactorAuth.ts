import speakeasy from 'speakeasy';
import QRCode from 'qrcode';
import { dbRun, dbGet } from '../database/connection.js';

export interface TwoFactorSetup {
  secret: string;
  qrCodeUrl: string;
  manualEntryKey: string;
}

export interface TwoFactorVerification {
  isValid: boolean;
  backupCodes?: string[];
}

export class TwoFactorAuthService {
  /**
   * Generate a new 2FA secret for a user
   */
  static async generateSecret(userId: number, userEmail: string): Promise<TwoFactorSetup> {
    const secret = speakeasy.generateSecret({
      name: `Investment Tracker (${userEmail})`,
      issuer: 'Investment Tracker',
      length: 32
    });

    // Store the secret temporarily (not enabled yet)
    await dbRun(
      'UPDATE users SET two_factor_secret = ? WHERE id = ?',
      [secret.base32, userId]
    );

    // Generate QR code URL
    const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url!);

    return {
      secret: secret.base32!,
      qrCodeUrl,
      manualEntryKey: secret.base32!
    };
  }

  /**
   * Verify a TOTP token and enable 2FA if valid
   */
  static async verifyAndEnable(userId: number, token: string): Promise<TwoFactorVerification> {
    // Get user's 2FA secret
    const user = await dbGet(
      'SELECT two_factor_secret FROM users WHERE id = ?',
      [userId]
    );

    if (!user || !user.two_factor_secret) {
      return { isValid: false };
    }

    // Verify the token
    const verified = speakeasy.totp.verify({
      secret: user.two_factor_secret,
      encoding: 'base32',
      token,
      window: 2 // Allow 2 time steps (60 seconds) of tolerance
    });

    if (verified) {
      // Enable 2FA for the user
      await dbRun(
        'UPDATE users SET two_factor_enabled = TRUE WHERE id = ?',
        [userId]
      );

      // Generate backup codes (optional)
      const backupCodes = this.generateBackupCodes();
      
      return {
        isValid: true,
        backupCodes
      };
    }

    return { isValid: false };
  }

  /**
   * Verify a TOTP token during login
   */
  static async verifyToken(userId: number, token: string): Promise<boolean> {
    const user = await dbGet(
      'SELECT two_factor_secret, two_factor_enabled FROM users WHERE id = ?',
      [userId]
    );

    console.log('2FA verification debug:', {
      userId,
      token,
      user: user ? {
        two_factor_enabled: user.two_factor_enabled,
        has_secret: !!user.two_factor_secret,
        secret_length: user.two_factor_secret?.length
      } : null
    });

    if (!user || !user.two_factor_enabled || !user.two_factor_secret) {
      console.log('2FA verification failed: user not found or 2FA not enabled');
      return false;
    }

    const result = speakeasy.totp.verify({
      secret: user.two_factor_secret,
      encoding: 'base32',
      token,
      window: 2
    });

    console.log('2FA verification result:', result);
    return result;
  }

  /**
   * Disable 2FA for a user
   */
  static async disable(userId: number): Promise<void> {
    await dbRun(
      'UPDATE users SET two_factor_enabled = FALSE, two_factor_secret = NULL WHERE id = ?',
      [userId]
    );
  }

  /**
   * Check if user has 2FA enabled
   */
  static async isEnabled(userId: number): Promise<boolean> {
    const user = await dbGet(
      'SELECT two_factor_enabled FROM users WHERE id = ?',
      [userId]
    );

    return user?.two_factor_enabled || false;
  }

  /**
   * Generate backup codes for recovery
   */
  private static generateBackupCodes(): string[] {
    const codes: string[] = [];
    for (let i = 0; i < 10; i++) {
      codes.push(Math.random().toString(36).substring(2, 10).toUpperCase());
    }
    return codes;
  }
}
