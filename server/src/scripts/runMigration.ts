import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = process.env.DATABASE_PATH || path.join(__dirname, '../../data/investment_tracker.db');
const db = new Database(dbPath);

console.log('🔄 Running database migration for account integrations...');
console.log(`Database: ${dbPath}`);

try {
  // Check if columns already exist
  const tableInfo = db.prepare('PRAGMA table_info(accounts)').all() as any[];
  const hasIntegrationType = tableInfo.some(col => col.name === 'integration_type');
  const hasIntegrationConfig = tableInfo.some(col => col.name === 'integration_config');

  if (hasIntegrationType && hasIntegrationConfig) {
    console.log('✅ Integration columns already exist, skipping migration');
  } else {
    console.log('📝 Adding integration columns to accounts table...');
    
    if (!hasIntegrationType) {
      db.exec('ALTER TABLE accounts ADD COLUMN integration_type TEXT DEFAULT NULL;');
      console.log('✅ Added integration_type column');
    }
    
    if (!hasIntegrationConfig) {
      db.exec('ALTER TABLE accounts ADD COLUMN integration_config TEXT DEFAULT NULL;');
      console.log('✅ Added integration_config column');
    }
    
    // Create index
    db.exec('CREATE INDEX IF NOT EXISTS idx_accounts_integration_type ON accounts(integration_type);');
    console.log('✅ Created index on integration_type');
  }

  // Verify
  const updatedTableInfo = db.prepare('PRAGMA table_info(accounts)').all() as any[];
  const columns = updatedTableInfo.map((col: any) => col.name);
  
  console.log('\n📊 Current accounts table columns:');
  console.log(columns.join(', '));
  
  console.log('\n✅ Migration complete!');
} catch (error) {
  console.error('❌ Migration failed:', error);
  process.exit(1);
} finally {
  db.close();
}
