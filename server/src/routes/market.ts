import express from 'express';
import { QQQService } from '../services/qqqService.js';
import { Logger } from '../utils/logger.js';

const router = express.Router();

// GET /api/market/qqq
router.get('/qqq', async (req, res) => {
    try {
        const holdings = await QQQService.getHoldings();
        res.json(holdings);
    } catch (error) {
        Logger.error('Error fetching QQQ holdings:', error);
        res.status(500).json({ error: 'Failed to fetch QQQ holdings' });
    }
});

// Manual trigger for QQQ update (admin/debug)
router.post('/qqq/update', async (req, res) => {
    try {
        await QQQService.updateHoldings();
        const holdings = await QQQService.getHoldings();
        res.json({ message: 'QQQ holdings updated', count: holdings.length });
    } catch (error) {
        Logger.error('Error updating QQQ holdings:', error);
        res.status(500).json({ error: 'Failed to update QQQ holdings' });
    }
});

export default router;
