// Load environment variables FIRST before any other imports
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Get current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from the server root directory (parent of src)
dotenv.config({ path: path.join(__dirname, '..', '.env') });

// Debug: Check if LOG_LEVEL is loaded
console.log('=== ENV CHECK ===');
console.log('CWD:', process.cwd());
console.log('ENV file path:', path.join(__dirname, '..', '.env'));
console.log('LOG_LEVEL from env:', process.env.LOG_LEVEL);
console.log('NODE_ENV from env:', process.env.NODE_ENV);
console.log('================');

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';

// Import routes
import authRoutes from './routes/auth.js';
import accountRoutes from './routes/accounts.js';
import currencyRoutes from './routes/currencies.js';
import performanceRoutes from './routes/performance.js';
import twoFactorRoutes from './routes/twoFactor.js';
import ibRoutes from './routes/ib.js';
import manualInvestmentRoutes from './routes/manualInvestments.js';
import otherAssetsRoutes from './routes/otherAssets.js';
import schwabRoutes from './routes/schwab.js';
import { SchedulerService } from './services/schedulerService.js';
import { IBServiceOptimized } from './services/ibServiceOptimized.js';
import { OtherPortfolioService } from './services/otherPortfolioService.js';
import { Logger, LogLevel } from './utils/logger.js';

const app = express();
const PORT = process.env.PORT || 3002;

// __dirname and __filename already defined at the top for .env loading

// Security middleware with CSP configuration
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      connectSrc: ["'self'", "http://localhost:3002", "https://query1.finance.yahoo.com", "https://api.exchangerate-api.com"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: [],
    },
  },
}));

// CORS configuration
const corsOptions = {
  origin: process.env.CORS_ORIGIN || 'http://localhost:3002',
  credentials: true,
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions));

// Rate limiting - DISABLED for development
// const limiter = rateLimit({
//   windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '300000'), // 5 minutes
//   max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '1000'), // limit each IP to 1000 requests per windowMs
//   message: 'Too many requests from this IP, please try again later.',
//   standardHeaders: true,
//   legacyHeaders: false,
// });
// app.use(limiter);

// Logging - only in development
if (process.env.NODE_ENV !== 'production') {
  app.use(morgan('dev'));
}

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/accounts', accountRoutes);
app.use('/api/currencies', currencyRoutes);
app.use('/api/performance', performanceRoutes);
app.use('/api/2fa', twoFactorRoutes);
app.use('/api/ib', ibRoutes);
app.use('/api/manual-investments', manualInvestmentRoutes);
app.use('/api/other-assets', otherAssetsRoutes);
app.use('/api/schwab', schwabRoutes);

// Serve static files from client build (both development and production)
const clientBuildPath = path.join(__dirname, '../../client/dist');
app.use(express.static(clientBuildPath));

// Catch-all handler: send back React's index.html file for any non-API routes
app.get('*', (req, res) => {
  // Don't serve index.html for API routes
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'API route not found' });
  }

  return res.sendFile(path.join(clientBuildPath, 'index.html'));
});

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  Logger.error('Error:', err);

  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Invalid JSON' });
  }

  return res.status(500).json({
    error: 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { details: err.message })
  });
});

// Initialize services and start server
async function startServer() {
  try {
    // Configure logger based on environment
    if (process.env.NODE_ENV === 'development' && process.env.LOG_LEVEL === 'debug') {
      Logger.setLogLevel(LogLevel.DEBUG);
    }
    
    // Temporarily enable debug logging for IB troubleshooting
    Logger.setLogLevel(LogLevel.DEBUG);
    
    // Initialize services
    await SchedulerService.initialize();
    // Ensure unified portfolios table is initialized at startup
    await OtherPortfolioService.initializeDatabase();
    
    // Initialize IB optimized service and start auto-refresh for all IB accounts
    Logger.info('🔄 Initializing IB optimized service...');
    try {
      const { IBConnectionService } = await import('./services/ibConnectionService.js');
      const { dbAll } = await import('./database/connection.js');
      
      // Get all IB accounts
      const ibAccounts = await dbAll(
        `SELECT DISTINCT u.id as user_id, ic.target_account_id, ic.host, ic.port, ic.client_id
         FROM ib_connections ic
         JOIN users u ON ic.user_id = u.id
         WHERE ic.target_account_id IS NOT NULL`
      );
      
      if (ibAccounts && ibAccounts.length > 0) {
        Logger.info(`📊 Found ${ibAccounts.length} IB account(s) to initialize`);
        
        for (const account of ibAccounts) {
          try {
            Logger.info(`🔌 Starting refresh for IB account ${account.target_account_id}...`);
            await IBServiceOptimized.refreshPortfolio({
              host: account.host,
              port: account.port,
              client_id: account.client_id,
              target_account_id: account.target_account_id
            });
            Logger.info(`✅ IB account ${account.target_account_id} refresh started successfully`);
          } catch (error) {
            Logger.error(`❌ Failed to start refresh for IB account ${account.target_account_id}:`, error);
          }
        }
      } else {
        Logger.info('ℹ️  No IB accounts configured for auto-refresh');
      }
    } catch (error) {
      Logger.error('❌ Failed to initialize IB optimized service:', error);
    }

    // Start server
    const server = app.listen(PORT, () => {
      Logger.info(`🚀 Investment Tracker running on port ${PORT}`);
      Logger.info(`📊 Health check: http://localhost:${PORT}/health`);
      Logger.info(`🔗 API Base URL: http://localhost:${PORT}/api`);
      Logger.info(`🌐 Frontend: http://localhost:${PORT}`);
      Logger.info(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
    });

    return server;
  } catch (error) {
    Logger.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

const server = await startServer();

// Graceful shutdown handling
const gracefulShutdown = async (signal: string) => {
  Logger.info(`\n${signal} received, starting graceful shutdown...`);
  
  // Stop accepting new connections
  server.close(async () => {
    Logger.info('HTTP server closed');
    
    // Shutdown services
    try {
      await IBServiceOptimized.stopRefresh();
      await IBServiceOptimized.disconnect();
      Logger.info('✅ All services shut down successfully');
      process.exit(0);
    } catch (error) {
      Logger.error('❌ Error during shutdown:', error);
      process.exit(1);
    }
  });

  // Force shutdown after 30 seconds
  setTimeout(() => {
    Logger.error('⚠️  Forced shutdown after timeout');
    process.exit(1);
  }, 30000);
};

// Handle shutdown signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  Logger.error('❌ Uncaught Exception:', error);
  gracefulShutdown('UNCAUGHT_EXCEPTION');
});

process.on('unhandledRejection', (reason, promise) => {
  Logger.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  gracefulShutdown('UNHANDLED_REJECTION');
});

export default app;
