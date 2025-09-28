import { dbRun } from './connection.js';
import { ExchangeRateService } from '../services/exchangeRateService.js';

async function seed() {
  try {
    console.log('Starting database seeding...');
    
    // Fetch real exchange rates from external APIs
    console.log('Fetching real exchange rates...');
    
    const currencyPairs = [
      'USD/HKD',
      'EUR/HKD', 
      'GBP/HKD',
      'CAD/HKD',
      'SGD/HKD',
      'JPY/HKD'
    ];
    
    for (const pair of currencyPairs) {
      try {
        const [fromCurrency, toCurrency] = pair.split('/');
        const rate = await ExchangeRateService.getExchangeRate(fromCurrency, toCurrency);
        
        await dbRun(
          'INSERT OR REPLACE INTO exchange_rates (pair, rate) VALUES (?, ?)',
          [pair, rate]
        );
        
        console.log(`Seeded ${pair}: ${rate}`);
      } catch (error) {
        console.warn(`Failed to fetch rate for ${pair}, skipping...`);
      }
    }
    
    console.log('Database seeding completed successfully!');
    console.log('Real exchange rates have been seeded.');
    
  } catch (error) {
    console.error('Seeding failed:', error);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

seed();
