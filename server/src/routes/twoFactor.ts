import express from 'express';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { TwoFactorAuthService } from '../services/twoFactorAuth.js';
import { authenticateToken } from '../middleware/auth.js';
import { UserModel } from '../models/User.js';

const router = express.Router();

// Validation schemas
const setupSchema = z.object({
  userId: z.number()
});

const verifySchema = z.object({
  token: z.string().min(6).max(6)
});

const disableSchema = z.object({
  userId: z.number()
});

// Setup 2FA - Generate secret and QR code
router.post('/setup', authenticateToken, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const setup = await TwoFactorAuthService.generateSecret(userId, req.user.email);
    
    return res.json({
      message: '2FA setup generated successfully',
      secret: setup.secret,
      qrCodeUrl: setup.qrCodeUrl,
      manualEntryKey: setup.manualEntryKey
    });
  } catch (error) {
    console.error('2FA setup error:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      message: 'Failed to generate 2FA setup'
    });
  }
});

// Verify and enable 2FA
router.post('/verify', authenticateToken, async (req, res) => {
  try {
    const validatedData = verifySchema.parse(req.body);
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const result = await TwoFactorAuthService.verifyAndEnable(userId, validatedData.token);
    
    if (result.isValid) {
      return res.json({
        message: '2FA enabled successfully',
        backupCodes: result.backupCodes
      });
    } else {
      return res.status(400).json({ 
        error: 'Invalid token',
        message: 'The verification code is invalid or expired'
      });
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        error: 'Invalid input', 
        message: 'Token must be 6 digits'
      });
    }
    
    console.error('2FA verification error:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      message: 'Failed to verify 2FA token'
    });
  }
});

// Verify 2FA token during login
router.post('/verify-login', async (req, res) => {
  try {
    const { userId, token } = req.body;
    
    if (!userId || !token) {
      return res.status(400).json({ 
        error: 'Missing required fields',
        message: 'User ID and token are required'
      });
    }

    const isValid = await TwoFactorAuthService.verifyToken(userId, token);
    
    if (isValid) {
      // Get user information
      const user = await UserModel.findById(userId);
      if (!user) {
        return res.status(404).json({ 
          error: 'User not found',
          message: 'User does not exist'
        });
      }

      // Generate JWT token
      const secret = process.env.JWT_SECRET;
      if (!secret) {
        throw new Error('JWT_SECRET not configured');
      }

      const jwtToken = jwt.sign(
        { userId: user.id },
        secret as string,
        { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
      );

      return res.json({
        message: '2FA verification successful',
        verified: true,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          baseCurrency: user.baseCurrency,
          twoFactorEnabled: true
        },
        token: jwtToken
      });
    } else {
      return res.status(400).json({ 
        error: 'Invalid token',
        message: 'The verification code is invalid or expired'
      });
    }
  } catch (error) {
    console.error('2FA login verification error:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      message: 'Failed to verify 2FA token'
    });
  }
});

// Check if user has 2FA enabled
router.get('/status', authenticateToken, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const isEnabled = await TwoFactorAuthService.isEnabled(userId);
    
    return res.json({
      enabled: isEnabled
    });
  } catch (error) {
    console.error('2FA status check error:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      message: 'Failed to check 2FA status'
    });
  }
});

// Disable 2FA
router.post('/disable', authenticateToken, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    await TwoFactorAuthService.disable(userId);
    
    return res.json({
      message: '2FA disabled successfully'
    });
  } catch (error) {
    console.error('2FA disable error:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      message: 'Failed to disable 2FA'
    });
  }
});

export default router;
