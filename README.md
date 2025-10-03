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
   - Backend API: http://localhost:3002/api
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

### Development Mode
- **Auto-detected** when built files don't exist
- Frontend: http://localhost:5173 (Vite dev server)
- Backend: http://localhost:3002 (Express server)

### Production Mode
- **Auto-detected** when built files are present
- Application: http://localhost:3002 (single port)
- Deploy first: `./scripts/deploy.sh`

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
- JWT token authentication
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

3. **Start production server**
   ```bash
   ./scripts/start-production.sh
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

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License.

## 📚 Documentation

- **[Application Management](APPLICATION_MANAGEMENT.md)** - Comprehensive guide to the unified app management script
- **API Endpoints** - See the API section above
- **Database Schema** - See the database section above

## 🆘 Support

For issues and questions:
1. Check the documentation
2. Review the [Application Management guide](APPLICATION_MANAGEMENT.md)
3. Review the API endpoints
4. Check the database schema
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
- ✅ **Centralized Logging**: Structured logs with configurable viewing

---

**Built with ❤️ for investment tracking**