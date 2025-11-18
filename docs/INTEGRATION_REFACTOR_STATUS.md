# Account-Level Integration Refactoring - Implementation Status

## Completed ✅

### Phase 1: Database & Model Layer
- [x] Added `integration_type` and `integration_config` columns to accounts table
- [x] Created migration script `011_add_account_integrations.sql`
- [x] Updated Account model interfaces with integration types
- [x] Added integration helper methods to AccountModel:
  - `setIntegration()` - Set integration config for account
  - `getIntegration()` - Get parsed integration config
  - `removeIntegration()` - Remove integration from account
  - `findByIntegrationType()` - Find accounts by integration type
- [x] Updated `update()` method to handle integration fields
- [x] TypeScript compilation successful

## Completed ✅

### Phase 2: Backend API Routes
- [x] `/api/accounts/:id/integration` - GET/PUT/DELETE endpoints
- [x] `/api/accounts/:id/integration/test` - Test connection
- [x] `/api/accounts/:id/integration/refresh` - Refresh balance
- [x] Integration validation schemas (Zod)
- [x] Frontend API client methods
- [x] TypeScript compilation successful

## Completed ✅

### Phase 3: Service Layer Updates
- [x] Created `IntegrationService` - Unified interface for all integrations
- [x] `refreshAccountBalance()` - Refresh single account
- [x] `refreshAllIntegrations()` - Refresh all integrated accounts
- [x] `testConnection()` - Test integration connection
- [x] Updated Dashboard to use new integration service
- [x] Replaced old refresh logic with account-level approach

### Phase 4: Frontend Components (Partial)
- [x] Created `IntegrationConfigDialog.tsx` - Complete integration setup UI
- [x] Support for IB and Schwab configuration
- [x] Test connection and refresh balance buttons
- [x] Tab-based interface for integration types

## In Progress 🚧

### Phase 4: Frontend Components
Need to create/update:
- [ ] `IntegrationConfigDialog.tsx` - Main integration setup dialog
- [ ] Update `AccountsView.tsx` - Add integration tab to edit dialog
- [ ] Remove integration buttons from IB Portfolio page
- [ ] Remove integration buttons from Other Portfolio page
- [ ] Update Dashboard refresh logic

### Phase 5: Data Migration
Need to create:
- [ ] Migration script to move data from old tables to new format
- [ ] Backward compatibility layer
- [ ] Migration UI prompt for users

## Implementation Plan

### Step 1: API Routes (Next)

Create `/api/accounts/:id/integration` endpoints:

```typescript
// GET - Get integration config
router.get('/:id/integration', async (req, res) => {
  const accountId = parseInt(req.params.id);
  const userId = req.user.id;
  const config = await AccountModel.getIntegration(accountId, userId);
  res.json(config);
});

// PUT - Set integration config
router.put('/:id/integration', async (req, res) => {
  const accountId = parseInt(req.params.id);
  const userId = req.user.id;
  const { type, config } = req.body;
  const account = await AccountModel.setIntegration(accountId, userId, type, config);
  res.json(account);
});

// DELETE - Remove integration
router.delete('/:id/integration', async (req, res) => {
  const accountId = parseInt(req.params.id);
  const userId = req.user.id;
  const account = await AccountModel.removeIntegration(accountId, userId);
  res.json(account);
});

// POST - Test connection
router.post('/:id/integration/test', async (req, res) => {
  // Test IB or Schwab connection
});

// POST - Refresh balance
router.post('/:id/integration/refresh', async (req, res) => {
  // Refresh from IB or Schwab
});
```

### Step 2: Service Layer Refactoring

Update services to accept account-specific config:

```typescript
// Before (user-level)
await IBService.getAccountBalance(userSettings);

// After (account-level)
const account = await AccountModel.findById(accountId, userId);
const config = await AccountModel.getIntegration(accountId, userId);
await IBService.getAccountBalance(config as IBIntegrationConfig);
```

### Step 3: Frontend Integration Dialog

Create new component for account integration setup:

```typescript
<Dialog>
  <DialogContent>
    <Tabs>
      <TabsList>
        <TabsTrigger value="none">No Integration</TabsTrigger>
        <TabsTrigger value="ib">Interactive Brokers</TabsTrigger>
        <TabsTrigger value="schwab">Charles Schwab</TabsTrigger>
      </TabsList>
      
      <TabsContent value="ib">
        {/* IB configuration form */}
      </TabsContent>
      
      <TabsContent value="schwab">
        {/* Schwab configuration form */}
      </TabsContent>
    </Tabs>
  </DialogContent>
</Dialog>
```

### Step 4: Update AccountsView

Add integration configuration to account edit dialog:

```typescript
// In AccountsView edit dialog
<Tabs>
  <TabsList>
    <TabsTrigger value="details">Details</TabsTrigger>
    <TabsTrigger value="integration">Integration</TabsTrigger>
    <TabsTrigger value="history">History</TabsTrigger>
  </TabsList>
  
  <TabsContent value="integration">
    <IntegrationConfigDialog account={editingAccount} />
  </TabsContent>
</Tabs>
```

### Step 5: Data Migration

Create migration script:

```typescript
// Migrate IB connections
const ibConnections = await db.all('SELECT * FROM ib_connections');
for (const conn of ibConnections) {
  if (conn.target_account_id) {
    const config: IBIntegrationConfig = {
      type: 'IB',
      host: conn.host,
      port: conn.port,
      clientId: conn.client_id
    };
    await AccountModel.setIntegration(
      conn.target_account_id,
      conn.user_id,
      'IB',
      config
    );
  }
}

// Migrate Schwab settings
const schwabSettings = await db.all('SELECT * FROM schwab_settings');
for (const setting of schwabSettings) {
  // Find account by account number or create prompt for user
  const config: SchwabIntegrationConfig = {
    type: 'SCHWAB',
    appKey: setting.app_key,
    appSecret: setting.app_secret,
    accessToken: setting.access_token,
    refreshToken: setting.refresh_token,
    tokenExpiresAt: setting.token_expires_at
  };
  // Need user to select which account to link
}
```

## Testing Checklist

- [ ] Create account without integration
- [ ] Add IB integration to account
- [ ] Add Schwab integration to account
- [ ] Test connection for IB
- [ ] Test connection for Schwab
- [ ] Refresh balance from IB
- [ ] Refresh balance from Schwab
- [ ] Remove integration from account
- [ ] Multiple IB accounts work independently
- [ ] Multiple Schwab accounts work independently
- [ ] Dashboard refresh works with new structure
- [ ] Old data migrates correctly
- [ ] No data loss during migration

## Rollback Plan

If issues occur:
1. Keep old tables (`ib_connections`, `schwab_settings`)
2. Feature flag to switch between old/new system
3. Can revert database migration
4. Restore from backup if needed

## Timeline Estimate

- **API Routes:** 2-3 hours
- **Service Layer:** 3-4 hours
- **Frontend Components:** 4-5 hours
- **Data Migration:** 2-3 hours
- **Testing:** 2-3 hours
- **Documentation:** 1-2 hours

**Total:** 14-20 hours of development time

## Next Steps

1. Implement API routes for integration management
2. Update IB and Schwab services to use account-level config
3. Create IntegrationConfigDialog component
4. Update AccountsView with integration tab
5. Create data migration script
6. Test thoroughly
7. Update documentation
8. Deploy with migration

## Notes

- This is a breaking change that requires careful migration
- Keep backward compatibility during transition period
- Provide clear migration path for existing users
- Consider phased rollout (IB first, then Schwab)
- Monitor for issues after deployment
