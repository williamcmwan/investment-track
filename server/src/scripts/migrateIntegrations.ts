import { AccountModel } from '../models/Account.js';
import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import { Logger } from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function migrateIntegrations() {
  const dbPath = process.env.DATABASE_PATH || path.join(__dirname, '../../data/investment_tracker.db');
  const db = new Database(dbPath);

  Logger.info('🔄 Starting integration migration...');
  Logger.info(`Database: ${dbPath}`);

  try {
    // Migrate IB connections
    Logger.info('\n📊 Migrating IB connections...');
    const ibConnections = db.prepare(`
      SELECT * FROM ib_connections 
      WHERE target_account_id IS NOT NULL
    `).all() as any[];

    Logger.info(`Found ${ibConnections.length} IB connections to migrate`);

    for (const conn of ibConnections) {
      try {
        const config = {
          type: 'IB' as const,
          host: conn.host,
          port: conn.port,
          clientId: conn.client_id,
          lastConnected: conn.last_connected
        };

        await AccountModel.setIntegration(
          conn.target_account_id,
          conn.user_id,
          'IB',
          config
        );

        Logger.info(`✅ Migrated IB connection for account ${conn.target_account_id} (user ${conn.user_id})`);
      } catch (error: any) {
        Logger.error(`❌ Failed to migrate IB connection for account ${conn.target_account_id}:`, error.message);
      }
    }

    // Migrate Schwab settings
    Logger.info('\n📊 Migrating Schwab settings...');
    const schwabSettings = db.prepare(`
      SELECT * FROM schwab_settings
    `).all() as any[];

    Logger.info(`Found ${schwabSettings.length} Schwab settings to migrate`);

    if (schwabSettings.length > 0) {
      Logger.warn('⚠️  Schwab migration requires manual account linking!');
      Logger.warn('   Users need to link their Schwab accounts in the Accounts page.');
      Logger.warn('   The following Schwab settings were found:');
      
      for (const setting of schwabSettings) {
        Logger.info(`   - User ${setting.user_id}: App Key ${setting.app_key.substring(0, 8)}...`);
        Logger.info(`     Has tokens: ${!!(setting.access_token && setting.refresh_token)}`);
      }

      Logger.info('\n📝 To complete Schwab migration:');
      Logger.info('   1. Users should go to Accounts page');
      Logger.info('   2. Click "Integration" button on their Schwab account');
      Logger.info('   3. Select "Charles Schwab" tab');
      Logger.info('   4. Enter their App Key and Secret');
      Logger.info('   5. Complete OAuth authentication');
    }

    // Summary
    Logger.info('\n✅ Migration Summary:');
    Logger.info(`   - IB connections migrated: ${ibConnections.length}`);
    Logger.info(`   - Schwab settings found: ${schwabSettings.length} (requires manual linking)`);
    Logger.info('\n🎉 Migration complete!');

    // Verify migration
    Logger.info('\n🔍 Verifying migration...');
    const migratedAccounts = db.prepare(`
      SELECT id, name, integration_type 
      FROM accounts 
      WHERE integration_type IS NOT NULL
    `).all() as any[];

    Logger.info(`Found ${migratedAccounts.length} accounts with integrations:`);
    for (const account of migratedAccounts) {
      Logger.info(`   - Account ${account.id} (${account.name}): ${account.integration_type}`);
    }

  } catch (error: any) {
    Logger.error('❌ Migration failed:', error);
    throw error;
  } finally {
    db.close();
  }
}

// Run migration
migrateIntegrations()
  .then(() => {
    Logger.info('\n✅ Migration script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    Logger.error('\n❌ Migration script failed:', error);
    process.exit(1);
  });
