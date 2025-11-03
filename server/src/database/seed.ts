import { dbRun } from './connection.js';

async function seed() {
  try {
    console.log('Starting database seeding...');
    
    // No longer seeding exchange rates - they will be fetched from Yahoo Finance when needed
    console.log('Skipping exchange rate seeding - rates will be fetched from Yahoo Finance when needed');
    
    console.log('Database seeding completed successfully!');
    console.log('Exchange rates will be automatically fetched from Yahoo Finance when first requested.');
    
  } catch (error) {
    console.error('Seeding failed:', error);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

seed();
