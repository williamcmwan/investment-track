# Investment Tracker

A modern, full-stack investment tracking application built with React, Node.js, and SQLite. Features secure authentication with 2FA support, multi-currency tracking, and comprehensive portfolio analytics.

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
- **Interactive Brokers Integration**: Real-time portfolio data with user-configurable connections
- **Charles Schwab Integration**: Automatic account balance refresh via Schwab API (OAuth 2.0)
- **Manual Investment Tracking**: Add positions from any broker with Yahoo Finance market data
- **Bank Account Management**: Simple balance tracking without P&L calculations
- **Multi-Currency Support**: Track investments across different currencies

### 📊 **Comprehensive Analytics**
- **Performance Tracking**: Daily snapshots with P&L calculations
- **Currency Exchange**: Automatic rate updates with profit/loss tracking
- **Real-time Data**: Live portfolio updates with timestamp tracking
- **Responsive Dashboard**: Modern UI with mobile support

### 🔄 **Automatic Data Refresh**
- **30-minute refresh cycle**: Currency → IB Portfolio → Manual Investments
- **Smart IB refresh**: Only for users with configured IB settings
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

- **[Repository Guidelines](docs/AGENTS.md)** - Coding standards, project structure, and development workflow
- **[Database Schema](docs/DB_SCHEMA.md)** - Complete database structure and relationships
- **[Logging System](docs/LOGGING.md)** - Structured logging configuration and usage
- **[Memory Optimization](docs/MEMORY_OPTIMIZATION.md)** - Performance optimization techniques
- **[Refresh System](docs/REFRESH_SYSTEM.md)** - Automatic data refresh system details
- **[Schwab Integration](docs/SCHWAB_INTEGRATION.md)** - Charles Schwab API integration guide
- **[Schwab Quick Start](docs/SCHWAB_QUICK_START.md)** - Quick setup guide for Schwab API
- **[Schwab UI Guide](docs/SCHWAB_UI_GUIDE.md)** - User interface guide for Schwab integration

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