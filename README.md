# Investment Tracker

A modern, full-stack investment tracking application built with React, Node.js, and SQLite. Features secure authentication with 2FA support, multi-currency tracking, and comprehensive portfolio analytics.

## 🚀 Features

- **Secure Authentication**: JWT-based auth with Two-Factor Authentication (2FA) support
- **Multi-Currency Support**: Track investments in multiple currencies
- **Portfolio Analytics**: Comprehensive performance tracking and reporting
- **Real-time Data**: Live currency rates and portfolio updates
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

### Performance
- `GET /api/performance` - Get performance data
- `POST /api/performance` - Create performance record

## 🗄️ Database Schema

### Users Table
- `id` - Primary key
- `email` - Unique email address
- `password_hash` - Hashed password
- `name` - User's full name
- `base_currency` - Default currency (HKD)
- `two_factor_secret` - 2FA secret key
- `two_factor_enabled` - 2FA status

### Accounts Table
- `id` - Primary key
- `user_id` - Foreign key to users
- `name` - Account name
- `currency` - Account currency
- `original_capital` - Initial investment
- `current_balance` - Current balance

### Currency Pairs Table
- `id` - Primary key
- `user_id` - Foreign key to users
- `pair` - Currency pair (e.g., USD/HKD)
- `current_rate` - Current exchange rate
- `avg_cost` - Average cost basis
- `amount` - Amount held

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
- ✅ Complete 2FA implementation
- ✅ Database cleanup and organization
- ✅ Production deployment scripts
- ✅ Comprehensive documentation
- ✅ TypeScript type safety
- ✅ Security improvements
- ✅ Single port deployment (port 3002)
- ✅ Static file serving from Express server
- ✅ **Quick Update Feature**: Efficient account balance updates from dashboard
- ✅ **Unified App Management**: Single `scripts/app.sh` script for all operations
- ✅ **Enhanced Process Management**: PID tracking, graceful shutdown, status monitoring
- ✅ **Robust Stop Command**: Detects and stops processes regardless of how they were started
- ✅ **Centralized Logging**: Structured logs with configurable viewing
- ✅ **Unlimited Token Duration**: JWT tokens now valid indefinitely until manual logout
- ✅ **Performance Overview Enhancements**: 
  - Dates sorted in descending order (newest first)
  - Year removed from date display for cleaner UI
  - Pagination with 30 entries per page and Previous/Next navigation
  - Details shown by default for better user experience
- ✅ **Account Timestamp Fix**: Last updated timestamp now properly reflects balance changes

---

**Built with ❤️ for investment tracking**