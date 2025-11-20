# Investment Tracker Documentation

**Version:** 1.1  
**Last Updated:** November 20, 2025

Welcome to the Investment Tracker documentation. This guide will help you understand, develop, and maintain the application.

---

## 📚 Documentation Structure

### Getting Started
- **[Quick Start Guide](../README.md)** - Installation and basic setup
- **[Development Guide](DEVELOPMENT_GUIDE.md)** - Development workflow, coding standards, testing

### Architecture & System Design
- **[System Architecture](SYSTEM_ARCHITECTURE.md)** - Database schema, logging, memory optimization, performance
- **[Integrations Guide](INTEGRATIONS.md)** - Interactive Brokers and Charles Schwab integration

### Integration Guides
- **[Interactive Brokers Complete Guide](IB_COMPLETE_GUIDE.md)** - Detailed IB integration documentation
- **[Charles Schwab Guide](SCHWAB.md)** - Schwab API setup and usage

### Reference
- **[Integration Refactor](INTEGRATION_REFACTOR.md)** - Account-level integration architecture
- **[Cleanup Summary](CLEANUP_SUMMARY.md)** - Recent code cleanup and improvements

---

## 🚀 Quick Navigation

### I want to...

**Set up the application**
→ Start with [Quick Start Guide](../README.md)

**Develop new features**
→ Read [Development Guide](DEVELOPMENT_GUIDE.md)

**Understand the database**
→ Check [System Architecture](SYSTEM_ARCHITECTURE.md#database-schema)

**Integrate with brokers**
→ See [Integrations Guide](INTEGRATIONS.md)

**Set up Interactive Brokers**
→ Follow [IB Complete Guide](IB_COMPLETE_GUIDE.md)

**Set up Charles Schwab**
→ Follow [Schwab Guide](SCHWAB.md)

**Troubleshoot issues**
→ Check troubleshooting sections in relevant guides

**Optimize performance**
→ Review [System Architecture - Performance](SYSTEM_ARCHITECTURE.md#performance-monitoring)

---

## 📖 Document Summaries

### Development Guide
Comprehensive guide for developers including:
- Development setup and environment configuration
- Project structure and organization
- Coding standards (TypeScript, React, API)
- Data refresh system architecture
- Testing guidelines
- Deployment procedures

### System Architecture
Technical documentation covering:
- Database schema and relationships
- Logging system configuration
- Memory optimization strategies
- Performance monitoring
- Best practices

### Integrations Guide
Overview of broker integrations:
- Interactive Brokers vs Charles Schwab comparison
- Setup instructions for both
- API endpoints and usage
- Troubleshooting common issues

### IB Complete Guide
Deep dive into Interactive Brokers integration:
- Quick start (5-minute setup)
- Architecture and design principles
- API reference
- Performance metrics
- Migration guide
- Monitoring and troubleshooting

### Schwab Guide
Charles Schwab API integration:
- OAuth 2.0 setup
- Credential verification
- Account linking
- Balance refresh
- Troubleshooting

### Integration Refactor
Documentation of the account-level integration refactoring:
- Migration from user-level to account-level
- Database schema changes
- API updates
- Migration scripts

### Cleanup Summary
Recent improvements and code cleanup:
- Removed redundant views
- Optimized IB service
- Simplified navigation
- Performance improvements

---

## 🔧 Common Tasks

### Development

```bash
# Start development environment
npm run dev

# Run tests
npm run test

# Build for production
npm run build

# Check for errors
npm run lint
```

### Database

```bash
# Initialize database
npm run db:init

# Run migrations
npm run db:migrate

# Seed test data
npm run db:seed
```

### Deployment

```bash
# Build and start with PM2
npm run build
npm run pm2:start

# Check status
npm run pm2:status

# View logs
npm run pm2:logs
```

---

## 🐛 Troubleshooting

### Common Issues

**Build fails with memory error**
→ See [System Architecture - Memory Optimization](SYSTEM_ARCHITECTURE.md#memory-optimization)

**IB connection timeout**
→ See [IB Complete Guide - Troubleshooting](IB_COMPLETE_GUIDE.md#troubleshooting)

**Schwab authentication fails**
→ See [Schwab Guide - Troubleshooting](SCHWAB.md#troubleshooting)

**Database errors**
→ See [System Architecture - Database](SYSTEM_ARCHITECTURE.md#database-schema)

**Performance issues**
→ See [System Architecture - Performance](SYSTEM_ARCHITECTURE.md#performance-monitoring)

---

## 📊 Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (React)                        │
│  - Dashboard Analytics  - Account Management               │
│  - Portfolio Views     - Currency Exchange                 │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   Backend (Node.js)                        │
│  - REST API        - Authentication (JWT + 2FA)            │
│  - Broker APIs     - Scheduled Jobs                        │
│  - Data Processing - Real-time Updates                     │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   Database (SQLite)                        │
│  - User Data       - Portfolio Positions                   │
│  - Performance     - Integration Configs                   │
│  - Exchange Rates  - Audit Logs                           │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                External Integrations                       │
│  - Interactive Brokers Gateway                             │
│  - Charles Schwab API (OAuth 2.0)                         │
│  - Yahoo Finance API                                       │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔐 Security

- JWT-based authentication
- 2FA support (TOTP)
- Encrypted integration credentials
- OAuth 2.0 for Schwab
- Secure token management
- Rate limiting
- Input validation

---

## 📈 Performance

### Key Metrics

| Component | Metric | Target |
|-----------|--------|--------|
| API Response | < 200ms | 95th percentile |
| IB Refresh | < 40s | Initial |
| Database Query | < 50ms | Average |
| Memory Usage | < 500MB | Peak |

### Optimization Features

- Real-time IB subscriptions (99% fewer API calls)
- Database connection pooling
- Efficient caching strategies
- Batch processing
- Memory management

---

## 🤝 Contributing

1. Read [Development Guide](DEVELOPMENT_GUIDE.md)
2. Follow coding standards
3. Write tests for new features
4. Update documentation
5. Submit pull request

---

## 📝 Changelog

See [CHANGELOG.md](../CHANGELOG.md) for version history and recent changes.

---

## 📞 Support

**Documentation Issues:**
- Check relevant guide's troubleshooting section
- Review server logs
- Check browser console

**Feature Requests:**
- Document use case
- Provide examples
- Consider implementation impact

**Bug Reports:**
- Include error messages
- Provide reproduction steps
- Check logs for details

---

**Last Updated:** November 20, 2025  
**Documentation Version:** 1.1  
**Application Version:** See [CHANGELOG.md](../CHANGELOG.md)
