import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Import routes
import authRoutes from './routes/auth.js';
import accountRoutes from './routes/accounts.js';
import currencyRoutes from './routes/currencies.js';
import performanceRoutes from './routes/performance.js';
import twoFactorRoutes from './routes/twoFactor.js';
import integrationRoutes from './routes/integration.js';
import manualInvestmentRoutes from './routes/manualInvestments.js';
import otherAssetsRoutes from './routes/otherAssets.js';
import { SchedulerService } from './services/schedulerService.js';
import { IBService } from './services/ibService.js';
import { OtherPortfolioService } from './services/otherPortfolioService.js';
import { Logger, LogLevel } from './utils/logger.js';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3002;

// Get current directory for serving static files
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
app.use('/api/integration', integrationRoutes);
app.use('/api/manual-investments', manualInvestmentRoutes);
app.use('/api/other-assets', otherAssetsRoutes);

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
    
    // Initialize services
    await SchedulerService.initialize();
    await IBService.initialize();
    // Ensure unified portfolios table is initialized at startup
    await OtherPortfolioService.initializeDatabase();

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
      await IBService.shutdown();
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
