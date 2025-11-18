# Account-Level Integrations Refactoring Plan

## Overview

Refactor IB and Schwab integrations from global user-level to per-account level, allowing multiple broker accounts per user.

## Current Architecture

### IB Integration
- **Storage:** `ib_connections` table (user-level)
- **UI:** IB Portfolio page → Settings button
- **Limitation:** One IB connection per user
- **Config:** host, port, client_id, target_account_id

### Schwab Integration
- **Storage:** `schwab_settings` table (user-level)
- **UI:** Other Portfolio page → Schwab API button
- **Limitation:** One Schwab connection per user
- **Config:** app_key, app_secret, tokens

## New Architecture

### Per-Account Integration
- **Storage:** `accounts` table with new fields:
  - `integration_type`: 'IB', 'SCHWAB', or NULL
  - `integration_config`: JSON string with config
- **UI:** Accounts page → Edit Account → Integration tab
- **Benefit:** Multiple IB/Schwab accounts per user

### Integration Config Format

**IB Account:**
```json
{
  "type": "IB",
  "host": "localhost",
  "port": 4001,
  "client_id": 1,
  "last_connected": "2024-01-01T00:00:00Z"
}
```

**Schwab Account:**
```json
{
  "type": "SCHWAB",
  "app_key": "...",
  "app_secret": "...",
  "access_token": "...",
  "refresh_token": "...",
  "token_expires_at": 1234567890,
  "account_hash": "..."
}
```

## Implementation Steps

### Phase 1: Database Migration ✅
- [x] Add `integration_type` column to accounts
- [x] Add `integration_config` column to accounts
- [x] Create migration script
- [ ] Run migration on existing database

### Phase 2: Backend API Updates
- [ ] Update Account model to handle integration config
- [ ] Create account-level IB service methods
- [ ] Create account-level Schwab service methods
- [ ] Update routes to use account-level config
- [ ] Add validation for integration config

### Phase 3: Frontend Components
- [ ] Create IntegrationConfigDialog component
- [ ] Add integration tab to AccountsView edit dialog
- [ ] Move IB settings from IB Portfolio to Accounts
- [ ] Move Schwab settings from Other Portfolio to Accounts
- [ ] Update refresh logic to use account-level config

### Phase 4: Migration & Backward Compatibility
- [ ] Create data migration script (old tables → new format)
- [ ] Keep old tables for backward compatibility
- [ ] Add deprecation warnings
- [ ] Update documentation

### Phase 5: Testing & Cleanup
- [ ] Test multiple IB accounts
- [ ] Test multiple Schwab accounts
- [ ] Test mixed integrations
- [ ] Remove old integration buttons from portfolio pages
- [ ] Update all documentation

## Benefits

1. **Multiple Accounts:** Support multiple IB and Schwab accounts
2. **Better Organization:** Integration config tied to specific account
3. **Cleaner UI:** All account settings in one place
4. **Easier Management:** Edit integration without leaving Accounts page
5. **Scalability:** Easy to add new broker integrations

## Migration Strategy

### For Existing Users

1. **Automatic Migration:**
   - Script reads old `ib_connections` table
   - Finds linked account via `target_account_id`
   - Copies config to account's `integration_config`
   - Same for `schwab_settings`

2. **Manual Migration:**
   - User goes to Accounts page
   - Clicks "Configure Integration" on account
   - Selects broker type (IB or Schwab)
   - Enters credentials
   - System links integration to account

3. **Backward Compatibility:**
   - Keep old tables for 2-3 releases
   - Show migration prompt in UI
   - Gradually deprecate old endpoints

## UI Mockup

### Accounts Page - Edit Account Dialog

```
┌─────────────────────────────────────┐
│ Edit Account: My IB Account         │
├─────────────────────────────────────┤
│ Tabs: [Details] [Integration] [History] │
├─────────────────────────────────────┤
│                                     │
│ Integration Tab:                    │
│                                     │
│ Integration Type: [IB ▼]            │
│                                     │
│ ┌─ IB Configuration ──────────────┐│
│ │ Host: [localhost            ]   ││
│ │ Port: [4001                 ]   ││
│ │ Client ID: [1               ]   ││
│ │                                 ││
│ │ Status: ● Connected             ││
│ │ Last Updated: 2 mins ago        ││
│ │                                 ││
│ │ [Test Connection] [Refresh Now] ││
│ └─────────────────────────────────┘│
│                                     │
│ [Cancel] [Save]                     │
└─────────────────────────────────────┘
```

### Schwab Integration

```
┌─────────────────────────────────────┐
│ Edit Account: My Schwab Account     │
├─────────────────────────────────────┤
│ Integration Tab:                    │
│                                     │
│ Integration Type: [Schwab ▼]        │
│                                     │
│ ┌─ Schwab Configuration ──────────┐│
│ │ App Key: [****************]     ││
│ │ App Secret: [**************]    ││
│ │                                 ││
│ │ Status: ● Connected             ││
│ │ OAuth: ✓ Authenticated          ││
│ │                                 ││
│ │ [Re-authenticate] [Refresh Now] ││
│ └─────────────────────────────────┘│
│                                     │
│ [Cancel] [Save]                     │
└─────────────────────────────────────┘
```

## API Changes

### New Endpoints

```
PUT /api/accounts/:id/integration
  - Set integration config for account
  - Body: { type: 'IB'|'SCHWAB', config: {...} }

GET /api/accounts/:id/integration
  - Get integration config for account
  - Returns: { type, config, status }

POST /api/accounts/:id/integration/test
  - Test integration connection
  - Returns: { success, message }

POST /api/accounts/:id/integration/refresh
  - Refresh balance from integration
  - Returns: { balance, updated_at }

DELETE /api/accounts/:id/integration
  - Remove integration from account
```

### Updated Endpoints

```
GET /api/accounts/:id
  - Now includes integration_type and integration_config

PUT /api/accounts/:id
  - Can update integration fields
```

## Security Considerations

1. **Encryption:** Encrypt sensitive data in integration_config
2. **Access Control:** Only account owner can view/edit integration
3. **Token Storage:** Secure storage of OAuth tokens
4. **Audit Log:** Track integration config changes

## Timeline

- **Week 1:** Database migration + Backend API
- **Week 2:** Frontend components + Integration
- **Week 3:** Testing + Migration script
- **Week 4:** Documentation + Deployment

## Rollback Plan

If issues arise:
1. Keep old tables intact
2. Feature flag to switch between old/new system
3. Data migration is reversible
4. Can revert to previous version

## Success Criteria

- [ ] User can add multiple IB accounts
- [ ] User can add multiple Schwab accounts
- [ ] Each account independently refreshes
- [ ] Old integrations migrated successfully
- [ ] No data loss during migration
- [ ] Performance not degraded
- [ ] All tests passing

## Future Enhancements

After this refactoring:
- Add more broker integrations (Fidelity, E*TRADE, etc.)
- Support multiple integration types per account
- Bulk refresh across all integrated accounts
- Integration health monitoring dashboard
- Automatic failover for failed connections
