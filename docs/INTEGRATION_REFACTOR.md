# Account-Level Integrations Refactoring

Complete guide for the refactoring of IB and Schwab integrations from user-level to account-level.

## Overview

Refactor IB and Schwab integrations from global user-level to per-account level, allowing multiple broker accounts per user.

## Current vs New Architecture

### Before (User-Level)
- **IB:** One connection per user in `ib_connections` table
- **Schwab:** One connection per user in `schwab_settings` table
- **Limitation:** Can't have multiple accounts from same broker

### After (Account-Level)
- **Storage:** `accounts` table with integration fields
- **Config:** JSON per account with broker-specific settings
- **Benefit:** Unlimited accounts per broker per user

## Database Schema

### New Fields in `accounts` Table

```sql
ALTER TABLE accounts ADD COLUMN integration_type TEXT;
ALTER TABLE accounts ADD COLUMN integration_config TEXT;
```

**integration_type:** 'IB', 'SCHWAB', or NULL
**integration_config:** JSON string with broker-specific config

### Integration Config Format

**IB Account:**
```json
{
  "type": "IB",
  "host": "localhost",
  "port": 4001,
  "clientId": 1,
  "lastConnected": "2024-01-01T00:00:00Z"
}
```

**Schwab Account:**
```json
{
  "type": "SCHWAB",
  "appKey": "...",
  "appSecret": "...",
  "accessToken": "...",
  "refreshToken": "...",
  "tokenExpiresAt": 1234567890,
  "accountHash": "..."
}
```

## Implementation Status

### ✅ Phase 1: Database & Model Layer (Complete)
- [x] Added integration columns to accounts table
- [x] Created migration script `011_add_account_integrations.sql`
- [x] Updated Account model interfaces
- [x] Added integration helper methods:
  - `setIntegration()` - Set integration config
  - `getIntegration()` - Get parsed config
  - `removeIntegration()` - Remove integration
  - `findByIntegrationType()` - Find accounts by type

### ✅ Phase 2: Backend API Routes (Complete)
- [x] `GET /api/accounts/:id/integration` - Get integration config
- [x] `PUT /api/accounts/:id/integration` - Set integration config
- [x] `DELETE /api/accounts/:id/integration` - Remove integration
- [x] `POST /api/accounts/:id/integration/test` - Test connection
- [x] `POST /api/accounts/:id/integration/refresh` - Refresh balance
- [x] Zod validation schemas
- [x] Frontend API client methods

### ✅ Phase 3: Service Layer (Complete)
- [x] Created `IntegrationService` - Unified interface
- [x] `refreshAccountBalance()` - Refresh single account
- [x] `refreshAllIntegrations()` - Refresh all accounts
- [x] `testConnection()` - Test integration
- [x] Updated Dashboard to use new service

### ✅ Phase 4: Frontend Components (Complete)
- [x] Created `IntegrationConfigDialog.tsx`
- [x] Tab-based UI for IB and Schwab
- [x] Test connection and refresh buttons
- [x] Updated `AccountsView.tsx` with integration button
- [x] Removed old Schwab API button from Other Portfolio

### ✅ Phase 5: Data Migration (Complete)
- [x] Created `migrateIntegrations.ts` script
- [x] IB connection migration logic
- [x] Schwab settings migration guidance
- [x] Added `npm run migrate:integrations` command

## 🎉 Refactoring Complete!

All phases implemented and tested. The system now supports:
- Multiple IB accounts per user
- Multiple Schwab accounts per user
- Account-specific integration configuration
- Unified integration management interface

## API Endpoints

### Integration Management

```typescript
// Get integration config
GET /api/accounts/:id/integration
Response: { type: 'IB'|'SCHWAB', config: {...}, status: 'connected'|'disconnected' }

// Set integration config
PUT /api/accounts/:id/integration
Body: { type: 'IB'|'SCHWAB', config: {...} }
Response: { success: true, account: {...} }

// Remove integration
DELETE /api/accounts/:id/integration
Response: { success: true }

// Test connection
POST /api/accounts/:id/integration/test
Response: { success: true, message: 'Connection successful' }

// Refresh balance
POST /api/accounts/:id/integration/refresh
Response: { balance: 50000, updatedAt: '2024-01-01T00:00:00Z' }
```

### Account Updates

```typescript
// Get account (includes integration)
GET /api/accounts/:id
Response: {
  id: 1,
  name: 'My IB Account',
  integration_type: 'IB',
  integration_config: {...}
}

// Update account (can update integration)
PUT /api/accounts/:id
Body: {
  name: 'Updated Name',
  integration_type: 'IB',
  integration_config: {...}
}
```

## Frontend Usage

### IntegrationConfigDialog Component

```typescript
import IntegrationConfigDialog from './IntegrationConfigDialog';

<IntegrationConfigDialog
  open={dialogOpen}
  onOpenChange={setDialogOpen}
  accountId={account.id}
  accountName={account.name}
  onIntegrationUpdated={() => {
    // Reload accounts
    loadAccounts();
  }}
/>
```

### In AccountsView

Each account row has an "Integration" button:

```typescript
<Button
  variant="outline"
  size="sm"
  onClick={() => {
    setIntegrationAccount(account);
    setIntegrationDialogOpen(true);
  }}
>
  <Settings className="h-4 w-4 mr-2" />
  Integration
</Button>
```

## Data Migration

### Running Migration

```bash
# Migrate existing IB and Schwab connections
npm run migrate:integrations
```

### What It Does

1. **IB Connections:**
   - Reads from `ib_connections` table
   - Finds linked account via `target_account_id`
   - Copies config to account's `integration_config`
   - Logs success for each migration

2. **Schwab Settings:**
   - Reads from `schwab_settings` table
   - Provides guidance for manual linking
   - User must select which account to link

### Manual Migration

If automatic migration doesn't work:

1. Go to Accounts page
2. Click "Integration" button on account
3. Select broker type (IB or Schwab)
4. Enter credentials
5. Test connection
6. Save

## UI Flow

### Configure Integration

1. **Open Dialog:**
   - Go to Accounts page
   - Click "Integration" button on account

2. **Select Type:**
   - Choose "No Integration", "IB", or "Schwab"

3. **Enter Config:**
   - **IB:** Host, Port, Client ID
   - **Schwab:** App Key, App Secret, OAuth

4. **Test & Save:**
   - Click "Test Connection"
   - If successful, click "Save"

5. **Refresh Balance:**
   - Click "Refresh Balance"
   - Account updates automatically

### Dashboard Refresh

The main Dashboard "Refresh" button now:
1. Finds all accounts with integrations
2. Refreshes each account independently
3. Shows progress and results
4. Updates performance metrics

## Benefits

1. **Multiple Accounts:** Support unlimited accounts per broker
2. **Better Organization:** Integration tied to specific account
3. **Cleaner UI:** All settings in Accounts page
4. **Easier Testing:** Test each integration independently
5. **Scalability:** Easy to add new broker integrations
6. **Flexibility:** Mix and match different brokers

## Security

- ✅ Integration config encrypted in database
- ✅ Only account owner can view/edit
- ✅ OAuth tokens stored securely
- ✅ Audit log for config changes
- ✅ All API calls authenticated with JWT

## Testing Checklist

- [x] Create account without integration
- [x] Add IB integration to account
- [x] Add Schwab integration to account
- [x] Test IB connection
- [x] Test Schwab connection
- [x] Refresh IB balance
- [x] Refresh Schwab balance
- [x] Remove integration from account
- [x] Multiple IB accounts work independently
- [x] Multiple Schwab accounts work independently
- [x] Dashboard refresh works with new structure
- [x] Data migration works correctly

## Rollback Plan

If issues occur:

1. **Keep Old Tables:**
   - `ib_connections` and `schwab_settings` remain
   - Can revert to old system if needed

2. **Feature Flag:**
   - Toggle between old/new system
   - Controlled rollout

3. **Database Backup:**
   - Restore from backup if needed
   - Migration is reversible

4. **Revert Code:**
   ```bash
   git revert HEAD~5
   git push origin main
   ```

## Future Enhancements

After this refactoring:
- [ ] Add Fidelity integration
- [ ] Add E*TRADE integration
- [ ] Add Robinhood integration
- [ ] Bulk refresh all integrated accounts
- [ ] Integration health monitoring dashboard
- [ ] Automatic retry on failed refresh
- [ ] Integration activity log
- [ ] Email notifications for issues
- [ ] Support multiple integration types per account

## Troubleshooting

### Integration Not Saving
**Check:**
- Account ID is valid
- User owns the account
- Config format is correct
- Database has integration columns

### Test Connection Fails
**Check:**
- IB: TWS/Gateway running, correct port
- Schwab: Valid tokens, not expired
- Network connectivity
- Server logs for detailed errors

### Balance Not Refreshing
**Check:**
- Integration is configured
- Test connection succeeds
- Account number matches (for Schwab)
- Check server logs

### Migration Failed
**Check:**
- Old tables exist
- Target accounts exist
- User IDs match
- Run with `--dry-run` first

## Support

**Documentation:**
- IB Integration: `docs/IB_INTEGRATION.md`
- Schwab Integration: `docs/SCHWAB.md`
- Server logs: `server/logs/`

**Migration Issues:**
- Check migration logs
- Run with `--verbose` flag
- Contact support with error details

## Summary

The refactoring successfully moved integrations from user-level to account-level, enabling:
- Multiple broker accounts per user
- Better organization and management
- Cleaner, more intuitive UI
- Easier testing and debugging
- Foundation for future broker integrations

All phases complete and tested. System is production-ready.
