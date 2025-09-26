import express from 'express';
import { z } from 'zod';
import { PerformanceModel, CreatePerformanceData } from '../models/Performance.js';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth.js';

const router = express.Router();

// Apply authentication to all routes
router.use(authenticateToken);

// Validation schemas
const createPerformanceSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  totalPL: z.number(),
  investmentPL: z.number(),
  currencyPL: z.number(),
  dailyPL: z.number()
});

// Get performance history for user
router.get('/', async (req: AuthenticatedRequest, res) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;
    const performance = await PerformanceModel.findByUserId(req.user?.id || 0, limit);
    return res.json(performance);
  } catch (error) {
    console.error('Get performance error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Get performance by date range
router.get('/range', async (req: AuthenticatedRequest, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'Start date and end date are required' });
    }
    
    const performance = await PerformanceModel.findByDateRange(
      req.user?.id || 0,
      startDate as string,
      endDate as string
    );
    
    return res.json(performance);
  } catch (error) {
    console.error('Get performance range error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Get latest performance data
router.get('/latest', async (req: AuthenticatedRequest, res) => {
  try {
    const performance = await PerformanceModel.getLatest(req.user?.id || 0);
    if (!performance) {
      return res.status(404).json({ error: 'No performance data found' });
    }
    
    return res.json(performance);
  } catch (error) {
    console.error('Get latest performance error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Create performance data entry
router.post('/', async (req: AuthenticatedRequest, res) => {
  try {
    const validatedData = createPerformanceSchema.parse(req.body);
    
    const performance = await PerformanceModel.create(req.user?.id || 0, validatedData as CreatePerformanceData);
    return res.status(201).json(performance);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors });
    }
    
    console.error('Create performance error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
