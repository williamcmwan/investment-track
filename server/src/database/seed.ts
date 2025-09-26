import { dbRun } from './connection.js';

async function seed() {
  try {
    console.log('Starting database seeding...');
    
    // Create demo exchange rates
    const exchangeRates = [
      { pair: 'USD/HKD', rate: 7.85 },
      { pair: 'EUR/HKD', rate: 8.45 },
      { pair: 'GBP/HKD', rate: 9.95 },
      { pair: 'CAD/HKD', rate: 5.85 },
      { pair: 'SGD/HKD', rate: 5.75 },
      { pair: 'JPY/HKD', rate: 0.053 }
    ];
    
    for (const rate of exchangeRates) {
      await dbRun(
        'INSERT OR REPLACE INTO exchange_rates (pair, rate) VALUES (?, ?)',
        [rate.pair, rate.rate]
      );
    }
    
    console.log('Database seeding completed successfully!');
    console.log('Exchange rates have been seeded.');
    
  } catch (error) {
    console.error('Seeding failed:', error);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

seed();
