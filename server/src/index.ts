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

// Logging
app.use(morgan('combined'));

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
  console.error('Error:', err);

  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Invalid JSON' });
  }

  return res.status(500).json({
    error: 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { details: err.message })
  });
});

// Start server
const server = app.listen(PORT, () => {
  console.log(`🚀 Investment Tracker running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`🔗 API Base URL: http://localhost:${PORT}/api`);
  console.log(`🌐 Frontend: http://localhost:${PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);

  // Initialize services
  SchedulerService.initialize();
  IBService.initialize();
  // Ensure unified portfolios table is initialized at startup
  OtherPortfolioService.initializeDatabase().catch(console.error);
});

// Graceful shutdown handling
const gracefulShutdown = async (signal: string) => {
  console.log(`\n${signal} received, starting graceful shutdown...`);
  
  // Stop accepting new connections
  server.close(async () => {
    console.log('HTTP server closed');
    
    // Shutdown services
    try {
      await IBService.shutdown();
      console.log('✅ All services shut down successfully');
      process.exit(0);
    } catch (error) {
      console.error('❌ Error during shutdown:', error);
      process.exit(1);
    }
  });

  // Force shutdown after 30 seconds
  setTimeout(() => {
    console.error('⚠️  Forced shutdown after timeout');
    process.exit(1);
  }, 30000);
};

// Handle shutdown signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  gracefulShutdown('UNCAUGHT_EXCEPTION');
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  gracefulShutdown('UNHANDLED_REJECTION');
});

export default app;
