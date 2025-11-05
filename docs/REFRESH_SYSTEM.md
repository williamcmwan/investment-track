# Automatic Data Refresh System

## Overview

The investment tracker now includes an automatic data refresh system that updates all portfolio data every 30 minutes in a specific sequence:

1. **Currency Exchange Rates** (first)
2. **IB Portfolio Data** (second) 
3. **Manual Investment Market Data** (third)

## Features

### Automatic Refresh Schedule
- **Frequency**: Every 30 minutes
- **Sequence**: Currency → IB Portfolio → Manual Investments
- **Background Processing**: Runs automatically without user intervention

### Last Updated Timestamps
- **Currency View**: Shows last currency update time under "Add Currency Pair" button
- **Manual Investments**: Shows comprehensive last update times for all data types
- **Real-time Updates**: Timestamps update automatically every minute

### API Endpoints

#### Get All Last Update Times
```
GET /api/currencies/all-last-updates
GET /api/manual-investments/all-last-updates
```

Response:
```json
{
  "currency": "2024-10-25T10:30:00.000Z",
  "ibPortfolio": "2024-10-25T10:31:00.000Z", 
  "manualInvestments": "2024-10-25T10:32:00.000Z",
  "currencyTimestamp": 1729851000000,
  "ibPortfolioTimestamp": 1729851060000,
  "manualInvestmentsTimestamp": 1729851120000,
  "timestamp": "2024-10-25T10:35:00.000Z"
}
```

#### Get Currency Last Update
```
GET /api/currencies/last-update
```

Response:
```json
{
  "lastUpdate": "2024-10-25T10:30:00.000Z",
  "timestamp": "2024-10-25T10:35:00.000Z"
}
```

## Implementation Details

### Services

#### LastUpdateService
- Tracks last update times for all data types
- Persists timestamps to file system (`cache/last_updates.json`)
- Provides methods to check if data needs refresh (>30 minutes old)

#### SchedulerService (Enhanced)
- Manages cron jobs for automatic refresh
- Runs refresh sequence every 30 minutes
- Initializes LastUpdateService on startup

#### Data Services (Updated)
- **ExchangeRateService**: Updates currency timestamp after successful refresh
- **IBService**: Updates IB portfolio timestamp after successful refresh  
- **ManualInvestmentService**: Updates manual investments timestamp after successful refresh

### Client Components

#### CurrencyView
- Displays last currency update time under "Add Currency Pair" button
- Automatically refreshes timestamp display every minute

#### ManualInvestmentAccounts  
- Shows comprehensive last update times for all data types
- Updates display every minute
- Shows individual timestamps for Currency, IB Portfolio, and Manual Investments

## Configuration

### Environment Variables
No additional environment variables required. The system uses existing database and cache configurations.

### Cron Schedule
- **Data Refresh**: `*/30 * * * *` (every 30 minutes)
- **Daily Performance**: `59 23 * * *` (11:59 PM Dublin time)

## Benefits

1. **Always Fresh Data**: Ensures portfolio data is never more than 30 minutes old
2. **Optimal Sequence**: Currency rates update first, ensuring accurate conversions for portfolio calculations
3. **User Transparency**: Clear visibility into when data was last refreshed
4. **Automatic Operation**: No manual intervention required
5. **Efficient Processing**: Background updates don't impact user experience

## Future Enhancements

1. **User-Specific IB Refresh**: Currently IB refresh requires user credentials, could be enhanced with encrypted credential storage
2. **Configurable Intervals**: Allow users to customize refresh frequency
3. **Smart Refresh**: Only refresh during market hours for better efficiency
4. **Push Notifications**: Notify users when significant portfolio changes occur