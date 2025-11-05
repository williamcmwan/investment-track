import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import db, { dbRun } from './connection.js';
import { Logger } from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function migrate() {
  try {
    Logger.info('Starting database migration...');
    
    // Read and execute schema
    const schemaPath = path.join(__dirname, 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    
    // Split schema into individual statements
    const statements = schema
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0);
    
    for (const statement of statements) {
      await dbRun(statement);
      Logger.debug('Executed:', statement.substring(0, 50) + '...');
    }
    
    Logger.info('Database migration completed successfully!');
  } catch (error) {
    Logger.error('Migration failed:', error);
    process.exit(1);
  } finally {
    db.close();
  }
}

migrate();
