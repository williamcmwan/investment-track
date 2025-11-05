import { dbRun } from './connection.js';
import { Logger } from '../utils/logger.js';

async function seed() {
  try {
    Logger.info('Starting database seeding...');
    
    // No longer seeding exchange rates - they will be fetched from Yahoo Finance when needed
    Logger.info('Skipping exchange rate seeding - rates will be fetched from Yahoo Finance when needed');
    
    Logger.info('Database seeding completed successfully!');
    Logger.info('Exchange rates will be automatically fetched from Yahoo Finance when first requested.');
    
  } catch (error) {
    Logger.error('Seeding failed:', error);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

seed();
