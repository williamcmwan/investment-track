import express from 'express';
import { z } from 'zod';
import { AccountModel, CreateAccountData, UpdateAccountData } from '../models/Account.js';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth.js';

const router = express.Router();

// Apply authentication to all routes
router.use(authenticateToken);

// Validation schemas
const createAccountSchema = z.object({
  name: z.string().min(1),
  currency: z.string().min(3).max(3),
  originalCapital: z.number().positive(),
  currentBalance: z.number().positive()
});

const updateAccountSchema = z.object({
  name: z.string().min(1).optional(),
  currentBalance: z.number().positive().optional()
});

// Get all accounts for user
router.get('/', async (req: AuthenticatedRequest, res) => {
  try {
    const accounts = await AccountModel.findByUserId(req.user?.id || 0);
    return res.json(accounts);
  } catch (error) {
    console.error('Get accounts error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Get specific account with history
router.get('/:id', async (req: AuthenticatedRequest, res) => {
  try {
    const accountId = parseInt(req.params.id || '0');
    if (isNaN(accountId)) {
      return res.status(400).json({ error: 'Invalid account ID' });
    }
    
    const account = await AccountModel.getWithHistory(accountId, req.user?.id || 0);
    if (!account) {
      return res.status(404).json({ error: 'Account not found' });
    }
    
    return res.json(account);
  } catch (error) {
    console.error('Get account error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Create new account
router.post('/', async (req: AuthenticatedRequest, res) => {
  try {
    const validatedData = createAccountSchema.parse(req.body);
    
    const account = await AccountModel.create(req.user?.id || 0, validatedData as CreateAccountData);
    return res.status(201).json(account);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors });
    }
    
    console.error('Create account error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Update account
router.put('/:id', async (req: AuthenticatedRequest, res) => {
  try {
    const accountId = parseInt(req.params.id || '0');
    if (isNaN(accountId)) {
      return res.status(400).json({ error: 'Invalid account ID' });
    }
    
    const validatedData = updateAccountSchema.parse(req.body);
    
    const account = await AccountModel.update(accountId, req.user?.id || 0, validatedData as UpdateAccountData);
    if (!account) {
      return res.status(404).json({ error: 'Account not found' });
    }
    
    // If balance was updated, add to history
    if (validatedData.currentBalance !== undefined) {
      await AccountModel.addBalanceHistory(accountId, validatedData.currentBalance, 'Balance updated');
    }
    
    return res.json(account);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors });
    }
    
    console.error('Update account error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete account
router.delete('/:id', async (req: AuthenticatedRequest, res) => {
  try {
    const accountId = parseInt(req.params.id || '0');
    if (isNaN(accountId)) {
      return res.status(400).json({ error: 'Invalid account ID' });
    }
    
    const deleted = await AccountModel.delete(accountId, req.user?.id || 0);
    if (!deleted) {
      return res.status(404).json({ error: 'Account not found' });
    }
    
    return res.json({ message: 'Account deleted successfully' });
  } catch (error) {
    console.error('Delete account error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Add balance history entry
router.post('/:id/history', async (req: AuthenticatedRequest, res) => {
  try {
    const accountId = parseInt(req.params.id || '0');
    if (isNaN(accountId)) {
      return res.status(400).json({ error: 'Invalid account ID' });
    }
    
    const { balance, note } = req.body;
    if (typeof balance !== 'number' || !note) {
      return res.status(400).json({ error: 'Balance and note are required' });
    }
    
    // Verify account belongs to user
    const account = await AccountModel.findById(accountId, req.user?.id || 0);
    if (!account) {
      return res.status(404).json({ error: 'Account not found' });
    }
    
    await AccountModel.addBalanceHistory(accountId, balance, note);
    return res.status(201).json({ message: 'Balance history entry added' });
  } catch (error) {
    console.error('Add balance history error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
