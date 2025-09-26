import { dbRun, dbGet } from './connection.js';
import bcrypt from 'bcryptjs';

async function seed() {
  try {
    console.log('Starting database seeding...');
    
    // Create a demo user (or get existing one)
    const hashedPassword = await bcrypt.hash('demo123', 10);
    let userId;
    
    try {
      const result = await dbRun(
        'INSERT INTO users (email, password_hash, name, base_currency) VALUES (?, ?, ?, ?)',
        ['demo@example.com', hashedPassword, 'Demo User', 'HKD']
      );
      userId = result.lastID;
      console.log('Created demo user with ID:', userId);
    } catch (error) {
      // User already exists, get the existing user ID
      const existingUser = await dbGet(
        'SELECT id FROM users WHERE email = ?',
        ['demo@example.com']
      );
      userId = existingUser.id;
      console.log('Demo user already exists with ID:', userId);
    }
    
    // Clear existing demo data first
    await dbRun('DELETE FROM account_balance_history WHERE account_id IN (SELECT id FROM accounts WHERE user_id = ?)', [userId]);
    await dbRun('DELETE FROM accounts WHERE user_id = ?', [userId]);
    await dbRun('DELETE FROM currency_pairs WHERE user_id = ?', [userId]);
    await dbRun('DELETE FROM performance_history WHERE user_id = ?', [userId]);
    
    // Create demo accounts
    const accounts = [
      {
        name: 'Interactive Brokers',
        currency: 'USD',
        originalCapital: 100000,
        currentBalance: 125000
      },
      {
        name: 'Saxo Bank',
        currency: 'EUR',
        originalCapital: 80000,
        currentBalance: 85000
      },
      {
        name: 'Futu Securities',
        currency: 'HKD',
        originalCapital: 500000,
        currentBalance: 485000
      }
    ];
    
    for (const account of accounts) {
      const result = await dbRun(
        'INSERT INTO accounts (user_id, name, currency, original_capital, current_balance) VALUES (?, ?, ?, ?, ?)',
        [userId, account.name, account.currency, account.originalCapital, account.currentBalance]
      );
      const accountId = result.lastID;
      
      // Add some balance history
      const historyEntries = [
        { balance: account.currentBalance, note: 'Current balance', daysAgo: 0 },
        { balance: account.currentBalance * 0.98, note: 'Weekly update', daysAgo: 7 },
        { balance: account.currentBalance * 0.95, note: 'Portfolio rebalance', daysAgo: 14 },
        { balance: account.originalCapital, note: 'Initial deposit', daysAgo: 30 }
      ];
      
      for (const entry of historyEntries) {
        const date = new Date();
        date.setDate(date.getDate() - entry.daysAgo);
        
        await dbRun(
          'INSERT INTO account_balance_history (account_id, balance, note, date) VALUES (?, ?, ?, ?)',
          [accountId, entry.balance, entry.note, date.toISOString()]
        );
      }
    }
    
    // Create demo currency pairs
    const currencyPairs = [
      { pair: 'USD/HKD', currentRate: 7.85, avgCost: 7.75, amount: 128000 },
      { pair: 'EUR/HKD', currentRate: 8.45, avgCost: 8.50, amount: 80000 },
      { pair: 'GBP/HKD', currentRate: 9.95, avgCost: 9.80, amount: 20000 }
    ];
    
    for (const pair of currencyPairs) {
      await dbRun(
        'INSERT INTO currency_pairs (user_id, pair, current_rate, avg_cost, amount) VALUES (?, ?, ?, ?, ?)',
        [userId, pair.pair, pair.currentRate, pair.avgCost, pair.amount]
      );
    }
    
    // Create demo performance history
    const performanceData = [
      { date: '2024-01-01', totalPL: 0, investmentPL: 0, currencyPL: 0, dailyPL: 0 },
      { date: '2024-01-02', totalPL: 5000, investmentPL: 3500, currencyPL: 1500, dailyPL: 5000 },
      { date: '2024-01-03', totalPL: 12000, investmentPL: 8500, currencyPL: 3500, dailyPL: 7000 },
      { date: '2024-01-04', totalPL: 8000, investmentPL: 7000, currencyPL: 1000, dailyPL: -4000 },
      { date: '2024-01-05', totalPL: 15000, investmentPL: 12000, currencyPL: 3000, dailyPL: 7000 },
      { date: '2024-01-08', totalPL: 22000, investmentPL: 18000, currencyPL: 4000, dailyPL: 7000 },
      { date: '2024-01-09', totalPL: 18000, investmentPL: 16000, currencyPL: 2000, dailyPL: -4000 },
      { date: '2024-01-10', totalPL: 25000, investmentPL: 21000, currencyPL: 4000, dailyPL: 7000 },
      { date: '2024-01-11', totalPL: 35000, investmentPL: 28000, currencyPL: 7000, dailyPL: 10000 },
      { date: '2024-01-12', totalPL: 42000, investmentPL: 35000, currencyPL: 7000, dailyPL: 7000 },
      { date: '2024-01-15', totalPL: 187500, investmentPL: 162500, currencyPL: 25000, dailyPL: 145500 }
    ];
    
    for (const data of performanceData) {
      await dbRun(
        'INSERT INTO performance_history (user_id, date, total_pl, investment_pl, currency_pl, daily_pl) VALUES (?, ?, ?, ?, ?, ?)',
        [userId, data.date, data.totalPL, data.investmentPL, data.currencyPL, data.dailyPL]
      );
    }
    
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
    console.log('Demo user credentials:');
    console.log('Email: demo@example.com');
    console.log('Password: demo123');
    
  } catch (error) {
    console.error('Seeding failed:', error);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

seed();
