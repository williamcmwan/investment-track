import express from 'express';
import { z } from 'zod';
import { AccountModel, CreateAccountData, UpdateAccountData } from '../models/Account.js';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth.js';
import { PerformanceHistoryService } from '../services/performanceHistoryService.js';

const router = express.Router();

// Apply authentication to all routes
router.use(authenticateToken);

// Validation schemas
const createAccountSchema = z.object({
  name: z.string().min(1),
  currency: z.string().min(3).max(3),
  accountType: z.enum(['INVESTMENT', 'BANK']).default('INVESTMENT'),
  originalCapital: z.number().nonnegative(),
  currentBalance: z.number().nonnegative()
});

const updateAccountSchema = z.object({
  name: z.string().min(1).optional(),
  accountType: z.enum(['INVESTMENT', 'BANK']).optional(),
  originalCapital: z.number().nonnegative().optional(),
  currentBalance: z.number().nonnegative().optional()
});

// Get all accounts for user
router.get('/', async (req: AuthenticatedRequest, res) => {
  try {
    const accounts = await AccountModel.findByUserId(req.user?.id || 0);
    
    // Get history for each account
    const accountsWithHistory = await Promise.all(
      accounts.map(async (account) => {
        const history = await AccountModel.getBalanceHistory(account.id);
        return {
          ...account,
          history
        };
      })
    );
    
    return res.json(accountsWithHistory);
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
    
    // Recalculate today's performance snapshot after successful update
    try {
      await PerformanceHistoryService.calculateTodaySnapshot(req.user?.id || 0);
    } catch (e) {
      console.warn('Performance snapshot update failed after account update');
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
      // Get the date from the request body, default to today if not provided
      const updateDate = req.body.date || new Date().toISOString().split('T')[0];
      
      // Check if this date is older than the latest history entry
      const latestHistoryDate = await AccountModel.getLatestHistoryDate(accountId);
      
      if (latestHistoryDate && new Date(updateDate) < new Date(latestHistoryDate)) {
        // Don't update the account balance for older dates, just add to history
        await AccountModel.addBalanceHistory(accountId, validatedData.currentBalance, 'Balance updated', updateDate);
        
        // Revert the account balance to the most recent history entry
        const latestHistory = await AccountModel.getBalanceHistory(accountId);
        if (latestHistory.length > 0 && latestHistory[0]) {
          await AccountModel.update(accountId, req.user?.id || 0, { 
            currentBalance: latestHistory[0].balance 
          });
        }
      } else {
        // Normal update - update balance and add to history
        await AccountModel.addBalanceHistory(accountId, validatedData.currentBalance, 'Balance updated', updateDate);
      }
    }
    
    // Recalculate today's performance snapshot after any account update
    try {
      await PerformanceHistoryService.calculateTodaySnapshot(req.user?.id || 0);
    } catch (e) {
      console.warn('Performance snapshot update failed after account update');
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
    
    const { balance, note, date } = req.body;
    if (typeof balance !== 'number' || !note) {
      return res.status(400).json({ error: 'Balance and note are required' });
    }
    
    // Verify account belongs to user
    const account = await AccountModel.findById(accountId, req.user?.id || 0);
    if (!account) {
      return res.status(404).json({ error: 'Account not found' });
    }
    
    await AccountModel.addBalanceHistory(accountId, balance, note, date);

    // Recalculate today's performance snapshot after history add
    try {
      await PerformanceHistoryService.calculateTodaySnapshot(req.user?.id || 0);
    } catch (e) {
      console.warn('Performance snapshot update failed after adding history');
    }

    return res.status(201).json({ message: 'Balance history entry added' });
  } catch (error) {
    console.error('Add balance history error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Update balance history entry
router.put('/:id/history/:historyId', async (req: AuthenticatedRequest, res) => {
  try {
    const accountId = parseInt(req.params.id || '0');
    const historyId = parseInt(req.params.historyId || '0');
    
    if (isNaN(accountId) || isNaN(historyId)) {
      return res.status(400).json({ error: 'Invalid account or history ID' });
    }
    
    const { balance, note, date } = req.body;
    if (typeof balance !== 'number' || !note || !date) {
      return res.status(400).json({ error: 'Balance, note, and date are required' });
    }
    
    // Verify account belongs to user
    const account = await AccountModel.findById(accountId, req.user?.id || 0);
    if (!account) {
      return res.status(404).json({ error: 'Account not found' });
    }
    
    await AccountModel.updateBalanceHistory(historyId, accountId, balance, note, date);

    // Recalculate today's performance snapshot after history update
    try {
      await PerformanceHistoryService.calculateTodaySnapshot(req.user?.id || 0);
    } catch (e) {
      console.warn('Performance snapshot update failed after updating history');
    }

    return res.json({ message: 'Balance history entry updated' });
  } catch (error) {
    console.error('Update balance history error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete balance history entry
router.delete('/:id/history/:historyId', async (req: AuthenticatedRequest, res) => {
  try {
    const accountId = parseInt(req.params.id || '0');
    const historyId = parseInt(req.params.historyId || '0');
    
    if (isNaN(accountId) || isNaN(historyId)) {
      return res.status(400).json({ error: 'Invalid account or history ID' });
    }
    
    // Verify account belongs to user
    const account = await AccountModel.findById(accountId, req.user?.id || 0);
    if (!account) {
      return res.status(404).json({ error: 'Account not found' });
    }
    
    await AccountModel.deleteBalanceHistory(historyId, accountId);

    // Recalculate today's performance snapshot after history delete
    try {
      await PerformanceHistoryService.calculateTodaySnapshot(req.user?.id || 0);
    } catch (e) {
      console.warn('Performance snapshot update failed after deleting history');
    }

    return res.json({ message: 'Balance history entry deleted' });
  } catch (error) {
    console.error('Delete balance history error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
