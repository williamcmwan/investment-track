# Investment Tracker

A modern, full-stack investment tracking application built with React, Node.js, and SQLite. Features secure authentication with 2FA support, multi-currency tracking, and comprehensive portfolio analytics.

## 🚀 Features

- **Secure Authentication**: JWT-based auth with Two-Factor Authentication (2FA) support
- **Multi-Currency Support**: Track investments in multiple currencies with automatic refresh
- **Portfolio Analytics**: Comprehensive performance tracking and reporting
- **Automatic Data Refresh**: 30-minute refresh cycle for Currency → IB Portfolio → Manual Investments
- **Interactive Brokers Integration**: Real-time portfolio data with user-configurable connections
- **Manual Investment Tracking**: Add positions from any broker with Yahoo Finance market data
- **Real-time Data**: Live currency rates and portfolio updates with timestamp tracking
- **Responsive Design**: Modern UI with mobile support
- **Type Safety**: Full TypeScript implementation

## 🏗️ Architecture

```
investment-track/
├── client/                 # React frontend
│   ├── src/
│   │   ├── components/     # React components
│   │   ├── contexts/       # React contexts (Auth, Data)
│   │   ├── hooks/          # Custom React hooks
│   │   ├── services/       # API client
│   │   └── pages/          # Page components
│   └── public/             # Static assets
├── server/                 # Node.js backend
│   ├── src/
│   │   ├── database/       # Database schema & migrations
│   │   ├── models/         # Data models
│   │   ├── routes/         # API routes
│   │   ├── services/       # Business logic
│   │   └── middleware/     # Express middleware
├── scripts/                # Management scripts
│   ├── deploy.sh           # Full deployment script
│   └── app.sh              # Unified application management
├── config/                 # Configuration files
│   ├── nginx-production.conf # Nginx configuration
│   └── investment-tracker.service # Systemd service
└── docs/                   # Documentation
```

## 🛠️ Tech Stack

### Frontend
- **React 18** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool
- **Tailwind CSS** - Styling
- **shadcn/ui** - Component library
- **React Router** - Routing
- **Recharts** - Data visualization

### Backend
- **Node.js** - Runtime
- **Express.js** - Web framework
- **TypeScript** - Type safety
- **SQLite** - Database
- **JWT** - Authentication
- **bcrypt** - Password hashing
- **speakeasy** - 2FA (TOTP)
- **qrcode** - QR code generation

## ⚡ Key Features Highlight

### 🔄 Automatic Data Refresh
- **30-minute refresh cycle** keeps all data current
- **Smart sequence**: Currency → IB Portfolio → Manual Investments  
- **User transparency**: Last update timestamps shown in UI
- **Zero maintenance**: Runs automatically in background

### 🔌 Interactive Brokers Integration
- **User-configurable connections** - each user sets their own IB settings
- **Real-time portfolio data** with day change tracking
- **Multi-security support**: stocks, crypto, bonds with optimized data retrieval
- **Automatic refresh** for users with configured IB settings

### 📊 Manual Investment Tracking
- **Multi-broker support** - add positions from any broker
- **Yahoo Finance integration** for real-time market data
- **Comprehensive tracking**: P&L, day changes, industry classification
- **Unified portfolio view** with currency conversion

## 📦 Installation

### Prerequisites
- Node.js 18+ 
- npm or yarn

### Quick Start

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd investment-track
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   # Copy environment files
   cp server/env.example server/.env
   cp client/env.example client/.env
   
   # Edit server/.env with your configuration
   JWT_SECRET=your-super-secret-jwt-key
   ```

4. **Deploy and start**
   ```bash
   # Deploy (installs deps, builds client, migrates DB)
   ./scripts/deploy.sh
   
   # Start development servers
   ./scripts/start-dev.sh
   ```

5. **Access the application**
   - Application: http://localhost:3002
   - API: http://localhost:3002/api
   - Health check: http://localhost:3002/health

## 🔧 Development

### Application Management
```bash
# Start application (auto-detects dev/production mode)
./scripts/app.sh start

# Check application status
./scripts/app.sh status

# View application logs
./scripts/app.sh logs

# Stop application
./scripts/app.sh stop

# Or use npm scripts
npm run app:start
npm run app:status
npm run app:logs
npm run app:stop
```

### Single Port Architecture
The application uses **port 3002** for all functionality in both development and production modes:

- **Development Mode**: Server hot reloading with client served from build
- **Production Mode**: Optimized builds served from single process
- **Auto-detection**: Environment automatically detected based on build files
- **Deploy first**: `./scripts/deploy.sh` for production setup

### Database Management
```bash
# Run migrations
cd server && npx tsx src/database/migrate.ts

# Seed with demo data
cd server && npx tsx src/database/seed.ts
```

## 🔐 Authentication

### User Registration
- Email and password registration
- Password confirmation validation
- Automatic login after registration

### Two-Factor Authentication (2FA)
- TOTP-based 2FA using authenticator apps
- QR code generation for easy setup
- Backup codes for account recovery
- Optional 2FA setup after login

### Security Features
- JWT token authentication with unlimited duration (valid until logout)
- Password hashing with bcrypt
- CORS protection
- Rate limiting
- Input validation with Zod

## 🔄 Automatic Data Refresh System

The application features an intelligent **30-minute automatic refresh cycle** that keeps all portfolio data current:

### Refresh Sequence
1. **Currency Exchange Rates** (first) - Updates all currency pairs with latest rates
2. **IB Portfolio Data** (second) - Refreshes data for users with configured IB settings  
3. **Manual Investment Market Data** (third) - Updates Yahoo Finance data for manual positions

### Key Features
- **Background Processing**: Runs automatically without user intervention
- **Smart IB Refresh**: Only refreshes for users with configured IB connection settings
- **Timestamp Tracking**: Shows last update times in the UI for transparency
- **Error Resilience**: Each step is independent - if one fails, others continue
- **Performance Optimized**: Efficient batch processing and caching

### User Experience
- **Currency View**: Shows last currency update time under "Add Currency Pair" button
- **Manual Investments**: Shows last manual investments update time
- **Real-time Updates**: Timestamps refresh automatically every minute in the UI
- **Always Fresh Data**: Ensures portfolio data is never more than 30 minutes old

## 🔌 Interactive Brokers Integration

The application features comprehensive Interactive Brokers integration with user-configurable connections and real-time portfolio data including day change tracking for stocks, crypto, and bonds.

## 📊 Manual Investment Accounts

In addition to Interactive Brokers integration, the application supports manual investment tracking for users who want to track positions from multiple brokers or add positions not available through IB.

### 🆕 Manual Position Management
Users can manually add and manage investment positions with real-time market data from Yahoo Finance:

#### Features:
- **Multi-Account Support**: Link manual positions to existing investment accounts
- **Real-time Market Data**: Automatic price updates from Yahoo Finance API
- **Comprehensive Position Tracking**: 
  - Quantity and average cost tracking
  - Market value and unrealized P&L calculations
  - Day change and percentage change tracking
  - Industry and category classification
- **Symbol Search**: Built-in symbol search using Yahoo Finance
- **Multiple Security Types**: Support for stocks, ETFs, mutual funds, bonds, crypto, and other securities
- **Multi-Currency Support**: Track positions in different currencies
- **Portfolio Summary**: Aggregated portfolio metrics across all manual positions

#### How to Use:
1. **Navigate to Portfolio Page**: Access manual investment accounts section
2. **Add Position**: Click "Add Position" button
3. **Fill Position Details**:
   - Select target account from dropdown
   - Enter symbol (with auto-search suggestions)
   - Choose security type (Stock, ETF, Bond, etc.)
   - Enter quantity and average cost
   - Add optional details (industry, category, notes)
4. **Automatic Market Data**: Yahoo Finance data is fetched automatically
5. **Manage Positions**: Edit or delete positions as needed
6. **Refresh Data**: Use "Refresh Market Data" to update all positions

#### Technical Implementation:
- **Database Integration**: Uses unified `portfolios` table with `source` column ('MANUAL' or 'IB'); legacy `manual_positions` auto-migrated on startup
- **Yahoo Finance API**: Real-time market data integration
- **Field Mapping**: Robust camelCase to snake_case database column mapping
- **Error Handling**: Comprehensive validation and error reporting
- **Performance Optimized**: Batch market data updates for efficiency

### 🆕 User-Configurable IB Settings
Each user can configure their own IB connection settings through the Portfolio page:

#### Setup Process:
1. **Install TWS or IB Gateway** from Interactive Brokers
2. **Enable API connections**: File → Global Configuration → API → Settings
   - Check "Enable ActiveX and Socket Clients"
   - Note the Socket port number
3. **Configure in Application**:
   - Navigate to **Portfolio** page
   - Click **"Configure"** button next to "Refresh Portfolio"
   - Enter your connection details:
     - **Host**: Usually 'localhost' (default)
     - **Port**: 7497 for paper trading, 7496 for live trading
     - **Client ID**: Unique identifier (1-32)
     - **Target Account**: Select which investment account to update
4. **Start TWS/Gateway** and use "Refresh Portfolio"

#### Features:
- **Per-User Configuration**: Each user has their own IB connection settings
- **Account Selection**: Choose which investment account gets updated with portfolio data
- **Persistent Settings**: Configuration saved in database per user
- **No Environment Variables**: No need to configure server-side IB settings
- **Validation**: Form validation with helpful tooltips

### 📊 Enhanced Portfolio Data
The IB integration now provides comprehensive day change data for all security types:

#### Supported Securities:
- **📈 Stocks**: Historical data from IB with industry/category details
- **₿ Crypto**: Real-time crypto data with 24/7 trading support
- **🏦 Bonds**: Market data using IB tick data (Last Price & Close Price)

#### Day Change Data:
- **CHG Column**: Dollar amount change from previous day
- **CHG% Column**: Percentage change with trend indicators (↑↓)
- **Real-time Data**: All data sourced directly from Interactive Brokers
- **No External APIs**: Pure IB data for consistency and reliability

#### Technical Implementation:
- **Stocks**: IB historical data with 2-day lookback
- **Crypto**: IB historical data with MIDPOINT pricing and 24/7 trading hours
- **Bonds**: IB market data ticks (Tick 4: Last Price, Tick 9: Close Price)
- **Contract ID Based**: Uses existing portfolio contract IDs for reliability
- **Optimized Settings**: Security-type specific parameters for best data quality

### Port Reference
- TWS Live: 7496 | TWS Paper: 7497
- IB Gateway Live: 4001 | IB Gateway Paper: 4002

## 📊 API Endpoints

### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `POST /api/2fa/setup` - Setup 2FA
- `POST /api/2fa/verify` - Verify 2FA setup
- `POST /api/2fa/verify-login` - Verify 2FA during login

### Accounts
- `GET /api/accounts` - Get user accounts
- `POST /api/accounts` - Create account
- `PUT /api/accounts/:id` - Update account
- `DELETE /api/accounts/:id` - Delete account

### Currency Pairs
- `GET /api/currencies` - Get currency pairs
- `POST /api/currencies` - Create currency pair
- `PUT /api/currencies/:id` - Update currency pair
- `DELETE /api/currencies/:id` - Delete currency pair
- `GET /api/currencies/last-update` - Get currency last update time
- `GET /api/currencies/all-last-updates` - Get all data types last update times

### Performance
- `GET /api/performance` - Get performance data
- `POST /api/performance` - Create performance record

### Interactive Brokers Integration
- `GET /api/integration/ib/settings` - Get user's IB connection settings
- `POST /api/integration/ib/settings` - Save user's IB connection settings
- `POST /api/integration/ib/balance` - Get account balance from IB (cached)
- `POST /api/integration/ib/balance/refresh` - Force refresh account balance
- `POST /api/integration/ib/portfolio` - Get portfolio positions (cached)
- `POST /api/integration/ib/portfolio/refresh` - Force refresh portfolio data
- `POST /api/integration/ib/account-data` - Get combined account data
- `POST /api/integration/ib/refresh-all` - Force refresh all IB data

### Manual Investment Accounts
- `GET /api/manual-investments/positions` - Get all manual positions
- `POST /api/manual-investments/positions` - Add a new manual position
- `PUT /api/manual-investments/positions/:id` - Update a manual position
- `DELETE /api/manual-investments/positions/:id` - Delete a manual position
- `POST /api/manual-investments/positions/refresh-market-data` - Refresh market data for all positions
- `GET /api/manual-investments/refresh-status` - Get refresh status and timing
- `GET /api/manual-investments/all-last-updates` - Get comprehensive last update times
- `GET /api/manual-investments/summary` - Get portfolio summary for manual accounts
- `GET /api/manual-investments/search-symbols` - Search for symbols using Yahoo Finance
- `GET /api/manual-investments/market-data/:symbol` - Get market data for a specific symbol

## 🗄️ Database Schema

### Core Tables
- **Users**: Authentication, 2FA settings, base currency preferences
- **Accounts**: Investment accounts with currency and balance tracking
- **Currency Pairs**: Exchange rate tracking with cost basis and amounts
- **Portfolios**: Unified table for both IB and manual investment positions
- **Performance History**: Daily snapshots for analytics and reporting
- **Balance History**: Account balance changes over time

### Key Features
- **Unified Portfolio Storage**: Single table handles both IB and manual positions
- **Automatic Migrations**: Database schema updates handled automatically
- **Performance Optimized**: Proper indexing for fast queries
- **Data Integrity**: Foreign key constraints and validation

## 🚀 Deployment

### Production Deployment
1. **Set up environment variables**
   ```bash
   cp server/env.example server/.env
   # Edit server/.env with production values
   ```

2. **Deploy**
   ```bash
   ./scripts/deploy.sh
   ```

3. **Start application**
   ```bash
   ./scripts/app.sh start
   # Or using npm: npm run app:start
   ```

### Nginx Configuration
The project includes a `config/nginx-production.conf` template for serving the client and proxying API requests.

### Systemd Service
Use `config/investment-tracker.service` to run the application as a system service on Linux.

## 🔧 Configuration

### Environment Variables

#### Server (.env)
```bash
NODE_ENV=production
PORT=3002
JWT_SECRET=your-super-secret-jwt-key
JWT_EXPIRES_IN=7d
DATABASE_PATH=./data/investment_tracker.db
CORS_ORIGIN=https://yourdomain.com
```

#### Client (.env)
```bash
VITE_API_URL=https://yourdomain.com/api
```

## 🎛️ Application Management

### Unified App Management Script
The `scripts/app.sh` provides comprehensive application management with automatic environment detection and robust process control.

#### Commands Available:
```bash
./scripts/app.sh COMMAND [OPTIONS]

Commands:
  start [server|client|all]    # Start application components [default: all]
  stop [server|client|all]     # Stop application components [default: all]
  force-stop                   # Force stop all processes (emergency)
  restart [server|client|all]  # Restart application components [default: all]
  status                       # Show current application status
  logs [server|client|all] [lines]  # View logs [default: all, 50 lines]
  help                         # Show usage information
```

#### Usage Examples:
```bash
# Start application (auto-detects environment)
./scripts/app.sh start

# Check application status
./scripts/app.sh status

# View application logs
./scripts/app.sh logs server 100

# Stop application
./scripts/app.sh stop

# Emergency force stop
./scripts/app.sh force-stop

# Or use npm scripts
npm run app:start
npm run app:status
npm run app:logs
npm run app:stop
```

#### Environment Detection:
- **Development Mode**: Auto-detected when built files don't exist
  - Server runs with `tsx watch` for hot reloading
  - Client built automatically and served through server
  - Single port 3002 for all functionality

- **Production Mode**: Auto-detected when built files are present
  - Server runs optimized built application
  - Client served as static files by server
  - Single port 3002 for all functionality

#### Process Management Features:
- **PID Tracking**: Proper process identification and management
- **Graceful Shutdown**: Attempts clean shutdown before force killing
- **Port Detection**: Finds processes running on port 3002 even if started externally
- **Parent Process Handling**: Stops npm parent processes along with child processes
- **Centralized Logging**: All logs stored in `logs/` directory with configurable viewing
- **Status Monitoring**: Real-time application status reporting

#### Troubleshooting:
```bash
# Check what's running
./scripts/app.sh status

# View recent logs for debugging
./scripts/app.sh logs all 100

# Force clean restart if issues occur
./scripts/app.sh force-stop
./scripts/app.sh start

# Emergency cleanup (kills any process on port 3002)
./scripts/app.sh force-stop
```

#### Common Issues:
1. **"Dependencies not installed"**: Run `npm run setup`
2. **"Production build not found"**: Run `npm run build`
3. **"Database not found"**: Run `npm run db:migrate`
4. **Process won't stop**: Use `./scripts/app.sh force-stop`

## 📱 Usage

### Getting Started
1. **Register** a new account
2. **Set up 2FA** (optional but recommended)
3. **Add investment accounts** with different currencies
4. **Track currency pairs** and exchange rates
5. **Monitor performance** with analytics dashboard

### Quick Update Feature
The Dashboard Overview page includes a "Quick Update" button for efficiently updating account balances:

#### How to Use:
1. Navigate to the **Dashboard Overview** page
2. Click the **"Quick Update"** button next to the page title
3. Enter new balance amounts for accounts you want to update (leave empty to skip)
4. Click **"Update Balances"** to save changes

#### What Happens:
- **Account Balance Update**: Current balance is updated to the new amount
- **Automatic History**: Balance history entry is created with today's date
- **Performance Recalculation**: Dashboard analytics are automatically updated
- **Selective Updates**: Only accounts with entered amounts are updated
- **Validation**: Only accepts valid numeric values with proper error handling

#### Features:
- **Currency Display**: Shows each account's currency next to input fields
- **Real-time Feedback**: Success/error messages with specific details
- **Automatic Refresh**: Dashboard data refreshes immediately after updates
- **Form Validation**: Prevents invalid inputs and provides clear error messages

### 2FA Setup
1. After login, click "Setup 2FA" in the sidebar
2. Scan the QR code with your authenticator app
3. Enter the verification code to enable 2FA
4. Use your authenticator app for future logins

### Performance Overview
The Dashboard includes an enhanced Performance Overview section with:

#### Features:
- **Detailed Table View**: Shows by default with comprehensive P&L data
- **Chronological Sorting**: Most recent entries displayed first
- **Clean Date Format**: Month and day only (e.g., "Dec 15") for better readability
- **Pagination**: 30 entries per page with Previous/Next navigation
- **Toggle View**: Click "Hide Details" to show chart-only view
- **Real-time Data**: Automatically updates when account balances change

#### Data Displayed:
- **Date**: When the performance snapshot was recorded
- **Total P&L**: Overall profit/loss across all investments
- **Investment P&L**: Profit/loss from account balance changes
- **Currency P&L**: Profit/loss from currency exchange rate fluctuations
- **Daily P&L**: Day-over-day change in performance
- **Percentage Changes**: Color-coded percentage changes for each metric

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License.

## 🆘 Support

For issues and questions:
1. Check the Application Management section above
2. Review the API endpoints
3. Check the database schema
4. Use `./scripts/app.sh help` for command reference
5. Open an issue on GitHub

## 🔄 Updates

### Recent Changes
- ✅ **Enhanced Portfolio Tables**: Optimized table layouts with sticky columns, compact design, and improved mobile responsiveness
- ✅ **Tooltip Action Buttons**: Space-saving hover tooltips for edit/delete actions in Other Portfolios table
- ✅ **Consistent Color Scheme**: Unified profit/loss colors (`text-profit`/`text-loss`) across both portfolio tables
- ✅ **Mobile-Optimized Account Boxes**: Smaller, responsive account balance displays for better mobile experience
- ✅ **Sticky Symbol Columns**: Symbol columns remain visible during horizontal scrolling for better navigation
- ✅ **Grouped Data Columns**: Combined Chg/Chg% and Unrealized P&L/P&L% into single columns for space efficiency
- ✅ **Automatic 30-Minute Data Refresh**: Currency → IB Portfolio → Manual Investments refresh cycle
- ✅ **Smart IB Refresh**: Automatically refreshes IB data for users with configured settings
- ✅ **Last Update Timestamps**: Real-time display of when each data type was last refreshed
- ✅ **Background Processing**: All refreshes happen automatically without user intervention
- ✅ **Enhanced Manual Investment Accounts**: Yahoo Finance integration with real-time market data
- ✅ **User-Configurable IB Settings**: Per-user IB connection configuration with account selection
- ✅ **Unified Portfolio Storage**: Single `portfolios` table for both IB and manual positions
- ✅ **Complete 2FA Implementation**: TOTP-based authentication with QR codes
- ✅ **Production Deployment**: Single port (3002) with unified app management scripts
- ✅ **Performance Analytics**: Enhanced dashboard with pagination and detailed P&L tracking
- ✅ **Security Improvements**: JWT tokens, bcrypt hashing, CORS protection
- ✅ **TypeScript Implementation**: Full type safety across frontend and backend
- ✅ **Responsive Design**: Modern UI with mobile support and shadcn/ui components

---

**Built with ❤️ for investment tracking**