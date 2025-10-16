import express from 'express';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { UserModel, CreateUserData, LoginData } from '../models/User.js';
import { TwoFactorAuthService } from '../services/twoFactorAuth.js';

const router = express.Router();

// Validation schemas
const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().min(1),
  baseCurrency: z.string().optional()
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  twoFactorToken: z.string().optional()
});

// Register new user
router.post('/register', async (req, res) => {
  try {
    console.log('Registration request body:', req.body);
    console.log('Request headers:', req.headers);
    console.log('Content-Type:', req.get('Content-Type'));
    const validatedData = registerSchema.parse(req.body);
    
    // Check if user already exists
    console.log('Checking for existing user with email:', validatedData.email);
    const existingUser = await UserModel.findByEmail(validatedData.email);
    if (existingUser) {
      console.log('User already exists:', existingUser);
      return res.status(400).json({ 
        error: 'User already exists',
        message: 'An account with this email address already exists. Please try logging in instead.'
      });
    }
    
    const user = await UserModel.create(validatedData as CreateUserData);
    
    // Generate JWT token
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new Error('JWT_SECRET not configured');
    }
    
    const token = jwt.sign(
      { userId: user.id },
      secret as string
      // No expiration - token valid indefinitely
    );
    
    return res.status(201).json({
      message: 'User created successfully',
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        baseCurrency: user.baseCurrency
      },
      token
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.log('Validation error:', error.errors);
      const errorMessages = error.errors.map(err => {
        if (err.path[0] === 'email') return 'Please enter a valid email address';
        if (err.path[0] === 'password') return 'Password must be at least 6 characters long';
        if (err.path[0] === 'name') return 'Name is required';
        return `${err.path[0]}: ${err.message}`;
      });
      return res.status(400).json({ 
        error: 'Invalid input', 
        message: errorMessages.join(', '),
        details: error.errors 
      });
    }
    
    console.error('Registration error:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      message: 'Something went wrong. Please try again later.'
    });
  }
});

// Login user
router.post('/login', async (req, res) => {
  try {
    const validatedData = loginSchema.parse(req.body);
    
    const user = await UserModel.validatePassword(validatedData.email, validatedData.password);
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    // Check if user has 2FA enabled
    const has2FA = await TwoFactorAuthService.isEnabled(user.id);
    
    if (has2FA) {
      // If 2FA is enabled but no token provided, require 2FA
      if (!validatedData.twoFactorToken) {
        return res.status(200).json({
          message: '2FA required',
          requiresTwoFactor: true,
          userId: user.id
        });
      }
      
      // Verify 2FA token
      const isValid2FA = await TwoFactorAuthService.verifyToken(user.id, validatedData.twoFactorToken);
      if (!isValid2FA) {
        return res.status(401).json({ 
          error: 'Invalid 2FA token',
          message: 'The verification code is invalid or expired'
        });
      }
    }
    
    // Generate JWT token
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new Error('JWT_SECRET not configured');
    }
    
    const token = jwt.sign(
      { userId: user.id },
      secret as string
      // No expiration - token valid indefinitely
    );
    
    return res.json({
      message: 'Login successful',
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        baseCurrency: user.baseCurrency,
        twoFactorEnabled: has2FA
      },
      token
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors });
    }
    
    console.error('Login error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
