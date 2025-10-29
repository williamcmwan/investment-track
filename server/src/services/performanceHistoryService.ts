import { dbRun, dbGet, dbAll } from '../database/connection.js';
import { AccountModel } from '../models/Account.js';
import { CurrencyPairModel } from '../models/CurrencyPair.js';
import { PerformanceModel } from '../models/Performance.js';
import { ExchangeRateService } from './exchangeRateService.js';

export interface PerformanceSnapshot {
  date: string;
  totalPL: number;
  investmentPL: number;
  currencyPL: number;
  dailyPL: number;
}

export class PerformanceHistoryService {
  /**
   * Calculate and store performance snapshot for a specific date
   */
  static async calculateAndStoreSnapshot(userId: number, date?: string): Promise<PerformanceSnapshot> {
    const targetDate = date || new Date().toISOString().split('T')[0];
    
    try {
      console.log(`Calculating performance snapshot for user ${userId} on ${targetDate}...`);
      
      // Get all accounts for the user
      const accounts = await AccountModel.findByUserId(userId);
      
      // Get all currency pairs for the user
      const currencyPairs = await CurrencyPairModel.findByUserId(userId);
      
      // Get user's base currency
      const user = await dbGet('SELECT base_currency FROM users WHERE id = ?', [userId]) as { base_currency: string } | null;
      const baseCurrency = user?.base_currency || 'HKD';
      
      // Calculate investment P&L using simplified logic - only include INVESTMENT accounts
      let investmentPL = 0;
      // Filter to only include investment accounts for P&L calculations
      const investmentAccounts = accounts.filter(acc => !acc.accountType || acc.accountType === 'INVESTMENT');
      
      for (const account of investmentAccounts) {
        // Use current balance (simplified approach)
        const currentBalance = account.currentBalance;
        const originalCapital = account.originalCapital;
        const accountPL = currentBalance - originalCapital;
        
        // Convert to base currency
        if (account.currency === baseCurrency) {
          investmentPL += accountPL;
        } else {
          // Get exchange rate for this date (use current rate as fallback)
          const exchangeRate = await ExchangeRateService.getExchangeRate(account.currency, baseCurrency);
          investmentPL += accountPL * exchangeRate;
        }
      }
      
      // Calculate currency P&L
      let currencyPL = 0;
      for (const pair of currencyPairs) {
        const [fromCurrency, toCurrency] = pair.pair.split('/');
        
        // Calculate current value and cost basis
        const currentValue = pair.amount * pair.currentRate;
        const costBasis = pair.amount * pair.avgCost;
        const profitLossInOriginalCurrency = currentValue - costBasis;
        
        // Convert to base currency
        if (toCurrency === baseCurrency) {
          currencyPL += profitLossInOriginalCurrency;
        } else if (fromCurrency === baseCurrency) {
          currencyPL += (profitLossInOriginalCurrency / pair.currentRate);
        } else {
          // For cross-currency pairs, convert to base currency
          if (toCurrency && baseCurrency) {
            const rateToBase = await ExchangeRateService.getExchangeRate(toCurrency, baseCurrency);
            currencyPL += profitLossInOriginalCurrency * rateToBase;
          }
        }
      }
      
      // Based on your requirement:
      // - Total P&L should be calculated from INVESTMENT accounts only
      // - Investment P&L should be Total P&L - Currency P&L (pure investment performance)
      // - Currency P&L should be calculated from currency pairs
      
      // The investmentPL variable contains the total P&L from INVESTMENT accounts only
      // The currencyPL variable contains the currency P&L
      // So we need to store them correctly:
      const totalPL = investmentPL; // Total P&L = Investment P&L from INVESTMENT accounts only
      const investmentPLCalculated = totalPL - currencyPL; // Investment P&L = Total - Currency (pure investment performance)
      
      // Calculate daily P&L (difference from previous day)
      if (!targetDate) {
        throw new Error('Target date is required');
      }
      
      const previousDate = new Date(targetDate);
      previousDate.setDate(previousDate.getDate() - 1);
      const previousDateStr = previousDate.toISOString().split('T')[0];
      
      if (!previousDateStr) {
        throw new Error('Previous date string is undefined');
      }

      const previousSnapshot = await PerformanceModel.findByDateRange(
        userId, 
        previousDateStr,
        previousDateStr
      );
      
      // Daily P&L should reflect change in Investment P&L (exclude currency effects)
      const previousInvestmentPL = (previousSnapshot && previousSnapshot.length > 0 && previousSnapshot[0]) ? previousSnapshot[0].investmentPL : 0;
      const dailyPL = investmentPLCalculated - previousInvestmentPL;
      
      // Store the snapshot
      const snapshot: PerformanceSnapshot = {
        date: targetDate,
        totalPL, // This is the investment P&L (HK$1,660,354.13)
        investmentPL: investmentPLCalculated, // This is Total - Currency (HK$1,409,843.85)
        currencyPL,
        dailyPL
      };
      
      await PerformanceModel.create(userId, snapshot);
      
      console.log(`✅ Performance snapshot calculated and stored for ${targetDate}:`, {
        totalPL: totalPL.toFixed(2), // Total P&L from INVESTMENT accounts only
        investmentPL: investmentPLCalculated.toFixed(2), // Pure investment performance (Total - Currency)
        currencyPL: currencyPL.toFixed(2), // Currency exchange P&L
        dailyPL: dailyPL.toFixed(2),
        investmentAccountsCount: investmentAccounts.length
      });
      
      return snapshot;
      
    } catch (error) {
      console.error('Error calculating performance snapshot:', error);
      throw error;
    }
  }
  
  /**
   * Calculate performance snapshot for today (used when user visits overview)
   */
  static async calculateTodaySnapshot(userId: number): Promise<PerformanceSnapshot> {
    return this.calculateAndStoreSnapshot(userId);
  }
  
  /**
   * Get performance history for chart display
   */
  static async getPerformanceHistory(userId: number, limit?: number): Promise<PerformanceSnapshot[]> {
    const performance = await PerformanceModel.findByUserId(userId, limit);
    return performance.map(p => ({
      date: p.date,
      totalPL: p.totalPL,
      investmentPL: p.investmentPL,
      currencyPL: p.currencyPL,
      dailyPL: p.dailyPL
    }));
  }
  
  /**
   * Calculate missing performance snapshots for a date range
   */
  static async backfillPerformanceHistory(userId: number, startDate: string, endDate: string): Promise<void> {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const current = new Date(start);
    
    console.log(`Backfilling performance history from ${startDate} to ${endDate}...`);
    
    while (current <= end) {
      const dateStr = current.toISOString().split('T')[0];
      
      // Check if snapshot already exists
      const existing = await dbGet(
        'SELECT id FROM performance_history WHERE user_id = ? AND date = ?',
        [userId, dateStr]
      ) as { id: number } | null;
      
      if (!existing) {
        try {
          await this.calculateAndStoreSnapshot(userId, dateStr);
        } catch (error) {
          console.warn(`Failed to calculate snapshot for ${dateStr}:`, error);
        }
      }
      
      current.setDate(current.getDate() + 1);
    }
    
    console.log('✅ Performance history backfill completed');
  }
}
