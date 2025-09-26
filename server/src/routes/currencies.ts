import express from 'express';
import { z } from 'zod';
import { CurrencyPairModel, CreateCurrencyPairData, UpdateCurrencyPairData } from '../models/CurrencyPair.js';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth.js';

const router = express.Router();

// Apply authentication to all routes
router.use(authenticateToken);

// Validation schemas
const createCurrencyPairSchema = z.object({
  pair: z.string().min(5).max(10), // e.g., "USD/HKD"
  currentRate: z.number().positive(),
  avgCost: z.number().positive(),
  amount: z.number().positive()
});

const updateCurrencyPairSchema = z.object({
  currentRate: z.number().positive().optional(),
  avgCost: z.number().positive().optional(),
  amount: z.number().positive().optional()
});

// Get all currency pairs for user
router.get('/', async (req: AuthenticatedRequest, res) => {
  try {
    const pairs = await CurrencyPairModel.findByUserId(req.user?.id || 0);
    return res.json(pairs);
  } catch (error) {
    console.error('Get currency pairs error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Get specific currency pair
router.get('/:id', async (req: AuthenticatedRequest, res) => {
  try {
    const pairId = parseInt(req.params.id || '0');
    if (isNaN(pairId)) {
      return res.status(400).json({ error: 'Invalid currency pair ID' });
    }
    
    const pair = await CurrencyPairModel.findById(pairId, req.user?.id || 0);
    if (!pair) {
      return res.status(404).json({ error: 'Currency pair not found' });
    }
    
    return res.json(pair);
  } catch (error) {
    console.error('Get currency pair error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Create new currency pair
router.post('/', async (req: AuthenticatedRequest, res) => {
  try {
    const validatedData = createCurrencyPairSchema.parse(req.body);
    
    const pair = await CurrencyPairModel.create(req.user?.id || 0, validatedData as CreateCurrencyPairData);
    return res.status(201).json(pair);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors });
    }
    
    console.error('Create currency pair error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Update currency pair
router.put('/:id', async (req: AuthenticatedRequest, res) => {
  try {
    const pairId = parseInt(req.params.id || '0');
    if (isNaN(pairId)) {
      return res.status(400).json({ error: 'Invalid currency pair ID' });
    }
    
    const validatedData = updateCurrencyPairSchema.parse(req.body);
    
    const pair = await CurrencyPairModel.update(pairId, req.user?.id || 0, validatedData as UpdateCurrencyPairData);
    if (!pair) {
      return res.status(404).json({ error: 'Currency pair not found' });
    }
    
    return res.json(pair);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors });
    }
    
    console.error('Update currency pair error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete currency pair
router.delete('/:id', async (req: AuthenticatedRequest, res) => {
  try {
    const pairId = parseInt(req.params.id || '0');
    if (isNaN(pairId)) {
      return res.status(400).json({ error: 'Invalid currency pair ID' });
    }
    
    const deleted = await CurrencyPairModel.delete(pairId, req.user?.id || 0);
    if (!deleted) {
      return res.status(404).json({ error: 'Currency pair not found' });
    }
    
    return res.json({ message: 'Currency pair deleted successfully' });
  } catch (error) {
    console.error('Delete currency pair error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
