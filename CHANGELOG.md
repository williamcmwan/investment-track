# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.0] - 2024-11-20

### Added
- **Charles Schwab Integration**
  - OAuth 2.0 authentication with account-level token management
  - Automatic portfolio and balance refresh
  - Position categorization (EQUITY → US Stocks, FIXED_INCOME → Bonds)
  - Seamless integration with portfolio analytics
  
- **Enhanced Portfolio Analytics**
  - Dual currency display (original + converted to base currency)
  - Expand/collapse functionality for category breakdown
  - CSV export for both Currency and Portfolio Analytics
  - Automatic Schwab position categorization
  - Separated IB and Schwab as distinct data sources
  
- **Enhanced Currency Analytics**
  - Detailed breakdown by source (IB, Schwab, Other Portfolio, Bank Accounts)
  - Dual currency display in two-column layout
  - Expand/collapse functionality for space efficiency
  - CSV export with complete breakdown
  
- **IB Close Price Management**
  - Automatic refresh from Yahoo Finance every 30 minutes
  - Fresh close price fetch on server startup (no cache)
  - End-of-day bond price snapshot at 23:59 for accurate next-day calculations
  - Real-time day change calculations on every price update
  
- **UI/UX Improvements**
  - Last updated timestamp on Performance Overview
  - Simplified source labels (Schwab, IB, Other)
  - Two-column layout for currency display
  - Better space utilization with collapsible sections
  - "Expand All" / "Collapse All" master buttons

### Changed
- **Portfolio Synchronization Mechanism**
  - Complete revamp of data sync architecture
  - Account-level integration management
  - Subscription-based IB updates with better error handling
  - Optimized data flow and consistency
  
- **Data Refresh Schedule**
  - Added IB close price refresh to 30-minute cycle
  - Currency → Manual Investments → IB Close Prices
  - Always fetch fresh data from Yahoo Finance (no cache)
  - Improved performance snapshot calculations
  
- **Other Portfolio View**
  - Now shows all investment accounts (not just integrated ones)
  - Excludes bank accounts from account selector
  - Better account filtering logic

### Fixed
- IB cash balance data loading (was accessing wrong property)
- Double counting of IB portfolio data in Currency Analytics
- Bank account labels in Portfolio Analytics
- Currency distribution calculation accuracy
- Day change calculations for bonds

### Technical Improvements
- Added `useCache` parameter to `fetchClosePricesFromYahoo()` method
- New `refreshClosePrices()` and `refreshAllClosePrices()` methods
- New `copyBondPricesToClose()` method for end-of-day snapshot
- Enhanced scheduler with IB close price refresh
- Better error handling and logging throughout
- Improved data consistency and accuracy

## [1.0.0] - 2024-11-01

### Initial Release
- JWT-based authentication with 2FA support
- Interactive Brokers integration with real-time updates
- Manual investment tracking with Yahoo Finance data
- Bank account management
- Multi-currency support with exchange rate tracking
- Performance tracking with daily snapshots
- Comprehensive analytics dashboard
- Automatic data refresh system
- Structured logging system
- Single-port architecture (port 3002)
- Responsive UI with mobile support

---

[1.1.0]: https://github.com/williamcmwan/investment-track/compare/v1.0...v1.1
[1.0.0]: https://github.com/williamcmwan/investment-track/releases/tag/v1.0
