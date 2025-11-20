# Investment Tracker

**Version 1.1** - Portfolio Synchronization Revamp & Charles Schwab Integration

A modern, full-stack investment tracking application built with React, Node.js, and SQLite. Features secure authentication with 2FA support, multi-currency tracking, comprehensive portfolio analytics, and seamless integration with Interactive Brokers and Charles Schwab.

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- npm or yarn

### Installation & Setup

1. **Clone and install**
   ```bash
   git clone <repository-url>
   cd investment-track
   npm install
   ```

2. **Configure environment**
   ```bash
   # Copy environment files
   cp server/env.example server/.env
   cp client/env.example client/.env
   
   # Edit server/.env with your configuration
   JWT_SECRET=your-super-secret-jwt-key
   LOG_LEVEL=1  # 0=DEBUG, 1=INFO, 2=WARN, 3=ERROR
   ```

3. **Deploy and start**
   ```bash
   # Deploy (installs deps, builds client, migrates DB)
   ./scripts/deploy.sh
   
   # Start application
   ./scripts/app.sh start
   ```

4. **Access application**
   - **Application**: http://localhost:3002
   - **API**: http://localhost:3002/api
   - **Health check**: http://localhost:3002/health

## 🎉 What's New in v1.1

### Major Features
- ✅ **Charles Schwab Integration**: Full OAuth 2.0 integration with automatic portfolio sync
- ✅ **Portfolio Synchronization Revamp**: Complete overhaul of data sync mechanism
- ✅ **Enhanced Analytics**: Dual currency display, expand/collapse, CSV export
- ✅ **Real-time Updates**: IB close prices refreshed every 30 minutes + on startup
- ✅ **Improved Categorization**: Automatic asset classification for better insights
- ✅ **Bond Price Handling**: End-of-day snapshot for accurate next-day calculations

### Technical Improvements
- ✅ **Optimized IB Service**: Subscription-based updates with better error handling
- ✅ **Account-Level Integration**: Per-account configuration for IB and Schwab
- ✅ **No Cache Policy**: Always fetch fresh close prices from Yahoo Finance
- ✅ **Separated Data Sources**: Clear distinction between IB, Schwab, and manual data
- ✅ **Enhanced Performance**: Better data consistency and accuracy
- ✅ **Improved UI/UX**: Cleaner displays with better space utilization

## 🏗️ Architecture

```
investment-track/
├── client/                 # React frontend (Vite + TypeScript + Tailwind)
├── server/                 # Node.js backend (Express + TypeScript + SQLite)
├── scripts/                # Management scripts (deploy.sh, app.sh)
├── config/                 # Configuration files (nginx, systemd)
└── docs/                   # Documentation
    ├── AGENTS.md           # Repository guidelines & coding standards
    ├── DB_SCHEMA.md        # Database schema documentation
    ├── LOGGING.md          # Logging system configuration
    ├── MEMORY_OPTIMIZATION.md  # Performance optimization guide
    └── REFRESH_SYSTEM.md   # Automatic data refresh system
```

## ⚡ Key Features

### 🔐 **Secure Authentication**
- JWT-based authentication with 2FA support
- Password hashing with bcrypt
- CORS protection and rate limiting

### 💰 **Multi-Portfolio Management**
- **Interactive Brokers Integration**: 
  - Real-time portfolio updates with subscription-based synchronization
  - Automatic close price refresh from Yahoo Finance
  - Real-time day change calculations
  - Bond price snapshot at end of day for accurate P&L
  - User-configurable connection settings per account
  
- **Charles Schwab Integration** (NEW in v1.1):
  - OAuth 2.0 authentication with account-level tokens
  - Automatic portfolio and balance refresh
  - Position categorization (Equity → US Stocks, Fixed Income → Bonds)
  - Seamless integration with existing portfolio analytics
  
- **Manual Investment Tracking**: 
  - Add positions from any broker
  - Yahoo Finance market data integration
  - Automatic price updates every 30 minutes
  
- **Bank Account Management**: 
  - Simple balance tracking without P&L calculations
  - Multi-currency support
  
- **Multi-Currency Support**: 
  - Track investments across different currencies
  - Automatic exchange rate updates
  - Currency P&L tracking

### 📊 **Enhanced Analytics** (NEW in v1.1)
- **Performance Tracking**: 
  - Daily snapshots with Total P&L, Investment P&L, and Currency P&L
  - Historical performance charts with customizable time ranges
  - Last updated timestamps
  
- **Currency Analytics**:
  - Portfolio distribution by currency with pie charts
  - Detailed breakdown by source (IB, Schwab, Other Portfolio, Bank Accounts)
  - Dual currency display (original + converted to base currency)
  - Expand/collapse functionality for space efficiency
  - CSV export for analysis
  
- **Portfolio Analytics**:
  - Asset categorization (Stocks by region, REITs, Bonds, Crypto, Cash)
  - Automatic Schwab position categorization
  - Detailed position breakdown with dual currency display
  - Expand/collapse functionality
  - CSV export for analysis
  
- **Real-time Data**: 
  - Live portfolio updates with timestamp tracking
  - Responsive dashboard with mobile support

### 🔄 **Automatic Data Refresh** (Enhanced in v1.1)
- **30-minute refresh cycle**: 
  1. Currency exchange rates
  2. Manual investment market data
  3. **IB close prices from Yahoo Finance** (NEW - always fresh, no cache)
  
- **Daily at 23:59**: 
  - Copy IB bond prices to close prices for next day baseline
  - Calculate daily performance snapshots
  
- **Every minute**: 
  - Schwab portfolio refresh
  
- **Real-time**: 
  - IB portfolio updates via Gateway subscription
  - Day change calculations on every price update
  
- **On Startup**: 
  - Fresh IB close price fetch from Yahoo Finance
  
- **Background processing**: Runs automatically without user intervention
- **Timestamp tracking**: Shows last update times in UI

### 🛠️ **Structured Logging System**
- **Configurable log levels**: DEBUG, INFO, WARN, ERROR
- **Environment-based control**: Set `LOG_LEVEL` in `.env`
- **Clean default logs**: Verbose debugging only when needed
- **Comprehensive coverage**: All services, routes, and database operations

## 🎛️ Application Management

### Development Commands
```bash
# Application management
./scripts/app.sh start     # Start application (auto-detects dev/production)
./scripts/app.sh status    # Check application status
./scripts/app.sh logs      # View application logs
./scripts/app.sh stop      # Stop application

# Or use npm scripts
npm run app:start
npm run app:status
npm run app:logs
npm run app:stop

# Database management
npm run db:migrate         # Run database migrations
npm run db:seed           # Seed with demo data

# Development servers
npm run dev:server        # Backend with hot reloading
npm run dev:client        # Frontend dev server
npm run build             # Build client + server
```

### Single Port Architecture
- **Port 3002** for all functionality in both development and production
- **Auto-detection**: Environment automatically detected based on build files
- **Development**: Server hot reloading with client served from build
- **Production**: Optimized builds served from single process

## 🔧 Configuration

### Environment Variables

#### Server Configuration (`server/.env`)
```bash
NODE_ENV=development
PORT=3002
JWT_SECRET=your-super-secret-jwt-key
DATABASE_PATH=./data/investment_tracker.db

# Logging Configuration
LOG_LEVEL=1  # 0=DEBUG (verbose), 1=INFO (default), 2=WARN, 3=ERROR

# Interactive Brokers (user-configurable in UI)
IB_HOST=localhost
IB_PORT=4001  # 7497 for TWS paper, 4001 for Gateway live
IB_CLIENT_ID=1
```

#### Client Configuration (`client/.env`)
```bash
VITE_API_URL=http://localhost:3002/api
```

## 📚 Documentation

Comprehensive documentation is available in the `docs/` directory:

### 🚀 Getting Started
- **[Repository Guidelines](docs/AGENTS.md)** - Coding standards, project structure, and development workflow
- **[Database Schema](docs/DB_SCHEMA.md)** - Complete database structure and relationships

### 🔌 Integrations
- **[Schwab Integration](docs/SCHWAB_INTEGRATION.md)** - Charles Schwab API integration guide
- **[Schwab Quick Start](docs/SCHWAB_QUICK_START.md)** - Quick setup guide for Schwab API
- **[Schwab UI Guide](docs/SCHWAB_UI_GUIDE.md)** - User interface guide for Schwab integration

### ⚙️ System Configuration
- **[Logging System](docs/LOGGING.md)** - Structured logging configuration and usage
- **[Refresh System](docs/REFRESH_SYSTEM.md)** - Automatic data refresh system details
- **[Memory Optimization](docs/MEMORY_OPTIMIZATION.md)** - Performance optimization techniques

## 🚀 Deployment

### Production Deployment
```bash
# 1. Configure environment
cp server/env.example server/.env
# Edit server/.env with production values

# 2. Deploy
./scripts/deploy.sh

# 3. Start application
./scripts/app.sh start
```

### System Service (Linux)
```bash
# Copy systemd service file
sudo cp config/investment-tracker.service /etc/systemd/system/
sudo systemctl enable investment-tracker
sudo systemctl start investment-tracker
```

### Nginx Configuration
Use the provided `config/nginx-production.conf` template for reverse proxy setup.

## 🛠️ Tech Stack

### Frontend
- **React 18** with TypeScript
- **Vite** build tool
- **Tailwind CSS** + **shadcn/ui** components
- **React Router** + **Recharts** for visualization

### Backend
- **Node.js** + **Express.js** with TypeScript
- **SQLite** database with migrations
- **JWT** authentication + **speakeasy** 2FA
- **Interactive Brokers API** integration

### Development Tools
- **ESLint** + **Prettier** for code quality
- **Unified app management** with automatic environment detection
- **Structured logging** with configurable levels
- **Hot reloading** in development mode

## 📊 API Overview

### Core Endpoints
- **Authentication**: `/api/auth/*` - Registration, login, 2FA
- **Accounts**: `/api/accounts/*` - Investment and bank account management
- **Currencies**: `/api/currencies/*` - Exchange rate tracking
- **Performance**: `/api/performance/*` - Analytics and reporting
- **Integration**: `/api/integration/ib/*` - Interactive Brokers integration
- **Manual Investments**: `/api/manual-investments/*` - Manual position tracking

### Interactive Brokers Integration
- User-configurable connection settings
- Real-time portfolio data with day change tracking
- Multi-currency cash balance tracking
- Automatic refresh for configured users

## 🤝 Contributing

1. **Follow repository guidelines** in [docs/AGENTS.md](docs/AGENTS.md)
2. **Use conventional commits**: `feat:`, `fix:`, `chore:`, etc.
3. **Test thoroughly**: Ensure `npm run build` passes
4. **Update documentation** when adding features

## 🆘 Troubleshooting

### Common Issues
```bash
# Check application status
./scripts/app.sh status

# View recent logs
./scripts/app.sh logs all 100

# Force clean restart
./scripts/app.sh force-stop
./scripts/app.sh start

# Database issues
npm run db:migrate
```

### Logging Levels
- **Default (`LOG_LEVEL=1`)**: Clean summary logs only
- **Debug (`LOG_LEVEL=0`)**: Verbose logging for troubleshooting
- **Production (`LOG_LEVEL=2`)**: Warnings and errors only

## 📄 License

MIT License - see LICENSE file for details.

---

**Built with ❤️ for comprehensive investment tracking**

For detailed documentation, see the `docs/` directory.