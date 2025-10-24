import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import db, { dbRun } from './connection.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runSpecificMigration() {
  try {
    console.log('Running specific migration: Add target_account_id column...');
    
    // Read the specific migration file
    const migrationPath = path.join(__dirname, 'migrations', '002_add_target_account_id.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    // Split by semicolon and execute each statement
    const statements = migrationSQL.split(';').filter(stmt => stmt.trim() && !stmt.trim().startsWith('--'));
    
    for (const statement of statements) {
      try {
        await dbRun(statement.trim());
        console.log('✅ Executed:', statement.trim().substring(0, 50) + '...');
      } catch (error: any) {
        // Ignore "duplicate column name" error (means column already exists)
        if (error.message && error.message.includes('duplicate column name')) {
          console.log('ℹ️  Column already exists, skipping...');
        } else {
          throw error;
        }
      }
    }
    
    console.log('✅ Migration completed successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    db.close();
  }
}

runSpecificMigration();