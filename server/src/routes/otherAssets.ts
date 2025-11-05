import express from 'express';
import { z } from 'zod';
import { OtherAssetModel, CreateOtherAssetData, UpdateOtherAssetData } from '../models/OtherAsset.js';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth.js';
import { Logger } from '../utils/logger.js';

const router = express.Router();

// Apply authentication to all routes
router.use(authenticateToken);

// Validation schemas
const createAssetSchema = z.object({
  assetType: z.string().min(1),
  asset: z.string().min(1),
  currency: z.string().min(3).max(3),
  originalValue: z.number().nonnegative(),
  marketValue: z.number().nonnegative(),
  remarks: z.string().optional().default('')
});

const updateAssetSchema = z.object({
  assetType: z.string().min(1).optional(),
  asset: z.string().min(1).optional(),
  currency: z.string().min(3).max(3).optional(),
  originalValue: z.number().nonnegative().optional(),
  marketValue: z.number().nonnegative().optional(),
  remarks: z.string().optional()
});

// Get all assets for user
router.get('/', async (req: AuthenticatedRequest, res) => {
  try {
    const assets = await OtherAssetModel.findByUserId(req.user?.id || 0);
    return res.json(assets);
  } catch (error) {
    Logger.error('Get assets error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Get specific asset
router.get('/:id', async (req: AuthenticatedRequest, res) => {
  try {
    const assetId = parseInt(req.params.id || '0');
    if (isNaN(assetId)) {
      return res.status(400).json({ error: 'Invalid asset ID' });
    }
    
    const asset = await OtherAssetModel.findById(assetId, req.user?.id || 0);
    if (!asset) {
      return res.status(404).json({ error: 'Asset not found' });
    }
    
    return res.json(asset);
  } catch (error) {
    Logger.error('Get asset error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Create new asset
router.post('/', async (req: AuthenticatedRequest, res) => {
  try {
    const validatedData = createAssetSchema.parse(req.body);
    
    const asset = await OtherAssetModel.create(req.user?.id || 0, validatedData as CreateOtherAssetData);
    
    // Recalculate today's performance snapshot after asset creation
    try {
      const { PerformanceHistoryService } = await import('../services/performanceHistoryService.js');
      await PerformanceHistoryService.calculateTodaySnapshot(req.user?.id || 0);
      Logger.info(`📈 Updated performance snapshot after asset creation`);
    } catch (performanceError) {
      Logger.error(`❌ Failed to update performance snapshot:`, performanceError);
    }
    
    return res.status(201).json(asset);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors });
    }
    
    Logger.error('Create asset error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Update asset
router.put('/:id', async (req: AuthenticatedRequest, res) => {
  try {
    const assetId = parseInt(req.params.id || '0');
    if (isNaN(assetId)) {
      return res.status(400).json({ error: 'Invalid asset ID' });
    }
    
    const validatedData = updateAssetSchema.parse(req.body);
    
    const asset = await OtherAssetModel.update(assetId, req.user?.id || 0, validatedData as UpdateOtherAssetData);
    if (!asset) {
      return res.status(404).json({ error: 'Asset not found' });
    }
    
    // Recalculate today's performance snapshot after asset update
    try {
      const { PerformanceHistoryService } = await import('../services/performanceHistoryService.js');
      await PerformanceHistoryService.calculateTodaySnapshot(req.user?.id || 0);
      Logger.info(`📈 Updated performance snapshot after asset update`);
    } catch (performanceError) {
      Logger.error(`❌ Failed to update performance snapshot:`, performanceError);
    }
    
    return res.json(asset);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors });
    }
    
    Logger.error('Update asset error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete asset
router.delete('/:id', async (req: AuthenticatedRequest, res) => {
  try {
    const assetId = parseInt(req.params.id || '0');
    if (isNaN(assetId)) {
      return res.status(400).json({ error: 'Invalid asset ID' });
    }
    
    const deleted = await OtherAssetModel.delete(assetId, req.user?.id || 0);
    if (!deleted) {
      return res.status(404).json({ error: 'Asset not found' });
    }
    
    // Recalculate today's performance snapshot after asset deletion
    try {
      const { PerformanceHistoryService } = await import('../services/performanceHistoryService.js');
      await PerformanceHistoryService.calculateTodaySnapshot(req.user?.id || 0);
      Logger.info(`📈 Updated performance snapshot after asset deletion`);
    } catch (performanceError) {
      Logger.error(`❌ Failed to update performance snapshot:`, performanceError);
    }
    
    return res.json({ message: 'Asset deleted successfully' });
  } catch (error) {
    Logger.error('Delete asset error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;