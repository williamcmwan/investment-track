# Integration Refactoring - Completion Guide

## Status: 75% Complete ✅

### Completed Phases:

#### ✅ Phase 1: Database & Model Layer
- Database schema updated with integration fields
- Account model with integration helper methods
- TypeScript interfaces for IB and Schwab configs

#### ✅ Phase 2: Backend API Routes
- Complete REST API for integration management
- GET/PUT/DELETE integration endpoints
- Test connection and refresh balance endpoints
- Zod validation schemas

#### ✅ Phase 3: Service Layer
- IntegrationService for unified management
- Account-level refresh logic
- Dashboard updated to use new approach

#### ✅ Phase 4: Frontend Components (75%)
- IntegrationConfigDialog component created
- Tab-based UI for integration types
- Test and refresh functionality

### Remaining Work (25%):

#### 🚧 Phase 4: Frontend Integration (Remaining)
**Task:** Add integration button to AccountsView

**Location:** `client/src/components/AccountsView.tsx`

**Steps:**
1. Import IntegrationConfigDialog
2. Add state for integration dialog
3. Add "Configure Integration" button to each account row
4. Wire up dialog to account

**Code to add:**

```typescript
// At top of AccountsView.tsx
import IntegrationConfigDialog from './IntegrationConfigDialog';

// Add state
const [integrationDialogOpen, setIntegrationDialogOpen] = useState(false);
const [integrationAccount, setIntegrationAccount] = useState<Account | null>(null);

// Add button in account actions (near Edit/Delete buttons)
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

// Add dialog at end of component
<IntegrationConfigDialog
  open={integrationDialogOpen}
  onOpenChange={setIntegrationDialogOpen}
  accountId={integrationAccount?.id || 0}
  accountName={integrationAccount?.name || ''}
  onIntegrationUpdated={() => {
    loadAccounts(); // Reload accounts after integration update
  }}
/>
```

#### 🚧 Phase 4: Remove Old Integration Buttons
**Task:** Remove deprecated integration buttons from portfolio pages

**Files to update:**
1. `client/src/components/IBPortfolioView.tsx` - Remove IB settings button
2. `client/src/components/OtherPortfolioView.tsx` - Remove Schwab API button

**Rationale:** Integration is now managed per-account in AccountsView

#### 🚧 Phase 5: Data Migration
**Task:** Migrate existing user data from old tables to new format

**Create:** `server/src/database/migrations/012_migrate_integrations_data.sql`

**Migration logic:**

```sql
-- Migrate IB connections to account integrations
UPDATE accounts
SET 
  integration_type = 'IB',
  integration_config = json_object(
    'type', 'IB',
    'host', (SELECT host FROM ib_connections WHERE target_account_id = accounts.id LIMIT 1),
    'port', (SELECT port FROM ib_connections WHERE target_account_id = accounts.id LIMIT 1),
    'clientId', (SELECT client_id FROM ib_connections WHERE target_account_id = accounts.id LIMIT 1)
  )
WHERE id IN (SELECT target_account_id FROM ib_connections WHERE target_account_id IS NOT NULL);

-- Note: Schwab migration requires manual account linking
-- Create a UI prompt for users to link Schwab accounts
```

**Create migration script:** `server/src/scripts/migrateIntegrations.ts`

```typescript
import { AccountModel } from '../models/Account.js';
import { dbAll } from '../database/connection.js';

async function migrateIntegrations() {
  console.log('Starting integration migration...');
  
  // Migrate IB connections
  const ibConnections = await dbAll('SELECT * FROM ib_connections WHERE target_account_id IS NOT NULL');
  
  for (const conn of ibConnections) {
    const config = {
      type: 'IB' as const,
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
    
    console.log(`✅ Migrated IB connection for account ${conn.target_account_id}`);
  }
  
  console.log('Migration complete!');
}

migrateIntegrations();
```

#### 🚧 Phase 5: Backward Compatibility
**Task:** Add deprecation warnings and fallback logic

**Files to update:**
1. `server/src/routes/integration.ts` - Add deprecation warnings
2. Keep old endpoints working but log warnings
3. Add UI banner prompting users to migrate

**Example:**

```typescript
// In old IB settings endpoint
router.get('/ib/settings', authenticateToken, async (req, res) => {
  Logger.warn('⚠️ DEPRECATED: /api/integration/ib/settings - Use per-account integration instead');
  
  // Return old data but suggest migration
  return res.json({
    ...oldSettings,
    _deprecated: true,
    _message: 'Please configure integration per-account in Accounts page'
  });
});
```

### Testing Checklist

Before considering complete:

- [ ] Run database migration on test database
- [ ] Create account without integration
- [ ] Add IB integration to account via AccountsView
- [ ] Test IB connection
- [ ] Refresh IB balance
- [ ] Add Schwab integration to account
- [ ] Test Schwab connection (requires OAuth)
- [ ] Refresh Schwab balance
- [ ] Test Dashboard comprehensive refresh
- [ ] Verify multiple IB accounts work independently
- [ ] Verify multiple Schwab accounts work independently
- [ ] Test removing integration from account
- [ ] Verify old IB connections migrate correctly
- [ ] Check backward compatibility with old endpoints

### Deployment Steps

1. **Backup database**
   ```bash
   cp server/data/investment_tracker.db server/data/investment_tracker.db.backup
   ```

2. **Run migration**
   ```bash
   npm run migrate
   ```

3. **Run data migration script**
   ```bash
   npm run migrate:integrations
   ```

4. **Deploy new code**
   ```bash
   ./scripts/deploy.sh
   ```

5. **Verify migration**
   - Check that existing IB accounts still work
   - Test new integration configuration
   - Monitor logs for errors

6. **Announce to users**
   - Add banner about new integration feature
   - Provide migration guide
   - Offer support for issues

### Rollback Plan

If issues occur:

1. **Restore database backup**
   ```bash
   cp server/data/investment_tracker.db.backup server/data/investment_tracker.db
   ```

2. **Revert code**
   ```bash
   git revert HEAD~3  # Revert last 3 commits
   git push origin main
   ```

3. **Restart services**
   ```bash
   npm run app:stop
   npm run app:start
   ```

### Benefits of New System

1. **Multiple Accounts:** Support unlimited IB and Schwab accounts per user
2. **Better Organization:** Integration tied to specific account
3. **Cleaner UI:** All settings in Accounts page
4. **Easier Testing:** Test each integration independently
5. **Scalability:** Easy to add new broker integrations
6. **Flexibility:** Mix and match different brokers

### Future Enhancements

After completion:

- [ ] Add Fidelity integration
- [ ] Add E*TRADE integration
- [ ] Add Robinhood integration
- [ ] Bulk refresh all integrated accounts button
- [ ] Integration health monitoring dashboard
- [ ] Automatic retry on failed refresh
- [ ] Integration activity log
- [ ] Email notifications for integration issues

### Time Estimate for Remaining Work

- **Phase 4 completion:** 1-2 hours
- **Phase 5 migration:** 2-3 hours
- **Testing:** 1-2 hours
- **Documentation:** 1 hour

**Total remaining:** 5-8 hours

### Next Immediate Steps

1. Add integration button to AccountsView (30 min)
2. Remove old integration buttons (30 min)
3. Test the new flow end-to-end (1 hour)
4. Create migration script (2 hours)
5. Test migration on copy of production data (1 hour)
6. Deploy to production (30 min)

### Support

For questions or issues during completion:
- Review `docs/ACCOUNT_INTEGRATIONS_REFACTOR.md` for architecture
- Check `docs/INTEGRATION_REFACTOR_STATUS.md` for current status
- Test on development environment first
- Keep backup of production database

## Summary

The refactoring is 75% complete with solid foundations:
- ✅ Database schema ready
- ✅ Backend API complete
- ✅ Service layer unified
- ✅ UI component created

Remaining work is primarily:
- 🚧 UI integration (connecting the pieces)
- 🚧 Data migration (one-time task)
- 🚧 Testing and deployment

The architecture is sound and ready for completion!
