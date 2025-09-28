import express from 'express';
import { z } from 'zod';
import { PerformanceModel, CreatePerformanceData } from '../models/Performance.js';
import { PerformanceHistoryService } from '../services/performanceHistoryService.js';
import { SchedulerService } from '../services/schedulerService.js';
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

// Calculate and store today's performance snapshot
router.post('/calculate-today', async (req: AuthenticatedRequest, res) => {
  try {
    const snapshot = await PerformanceHistoryService.calculateTodaySnapshot(req.user?.id || 0);
    return res.json(snapshot);
  } catch (error) {
    console.error('Calculate today performance error:', error);
    return res.status(500).json({ error: 'Failed to calculate performance snapshot' });
  }
});

// Calculate and store performance snapshot for a specific date
router.post('/calculate-snapshot', async (req: AuthenticatedRequest, res) => {
  try {
    const { date } = req.body;
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ error: 'Valid date (YYYY-MM-DD) is required' });
    }
    
    const snapshot = await PerformanceHistoryService.calculateAndStoreSnapshot(req.user?.id || 0, date);
    return res.json(snapshot);
  } catch (error) {
    console.error('Calculate snapshot error:', error);
    return res.status(500).json({ error: 'Failed to calculate performance snapshot' });
  }
});

// Backfill performance history for a date range
router.post('/backfill', async (req: AuthenticatedRequest, res) => {
  try {
    const { startDate, endDate } = req.body;
    if (!startDate || !endDate || !/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
      return res.status(400).json({ error: 'Valid start date and end date (YYYY-MM-DD) are required' });
    }
    
    await PerformanceHistoryService.backfillPerformanceHistory(req.user?.id || 0, startDate, endDate);
    return res.json({ message: 'Performance history backfill completed' });
  } catch (error) {
    console.error('Backfill performance error:', error);
    return res.status(500).json({ error: 'Failed to backfill performance history' });
  }
});

// Get performance history for chart display
router.get('/chart', async (req: AuthenticatedRequest, res) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 30;
    const history = await PerformanceHistoryService.getPerformanceHistory(req.user?.id || 0, limit);
    return res.json(history);
  } catch (error) {
    console.error('Get performance chart data error:', error);
    return res.status(500).json({ error: 'Failed to get performance chart data' });
  }
});

// Scheduler management endpoints (admin only - for testing/manual triggers)
router.post('/trigger-daily-calculation', async (req: AuthenticatedRequest, res) => {
  try {
    await SchedulerService.triggerDailyCalculation();
    return res.json({ message: 'Daily calculation triggered successfully' });
  } catch (error) {
    console.error('Trigger daily calculation error:', error);
    return res.status(500).json({ error: 'Failed to trigger daily calculation' });
  }
});

router.get('/scheduler-status', async (req: AuthenticatedRequest, res) => {
  try {
    const status = SchedulerService.getStatus();
    return res.json(status);
  } catch (error) {
    console.error('Get scheduler status error:', error);
    return res.status(500).json({ error: 'Failed to get scheduler status' });
  }
});

export default router;
