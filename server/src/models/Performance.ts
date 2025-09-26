import { dbGet, dbAll, dbRun } from '../database/connection.js';

export interface PerformanceData {
  id: number;
  userId: number;
  date: string;
  totalPL: number;
  investmentPL: number;
  currencyPL: number;
  dailyPL: number;
  createdAt: string;
}

export interface CreatePerformanceData {
  date: string;
  totalPL: number;
  investmentPL: number;
  currencyPL: number;
  dailyPL: number;
}

export class PerformanceModel {
  static async findByUserId(userId: number, limit?: number): Promise<PerformanceData[]> {
    const limitClause = limit ? `LIMIT ${limit}` : '';
    
    const performance = await dbAll(
      `SELECT 
        id, user_id as userId, date, total_pl as totalPL,
        investment_pl as investmentPL, currency_pl as currencyPL,
        daily_pl as dailyPL, created_at as createdAt
      FROM performance_history 
      WHERE user_id = ? 
      ORDER BY date DESC 
      ${limitClause}`,
      [userId]
    );
    
    return performance as PerformanceData[];
  }
  
  static async findByDateRange(userId: number, startDate: string, endDate: string): Promise<PerformanceData[]> {
    const performance = await dbAll(
      `SELECT 
        id, user_id as userId, date, total_pl as totalPL,
        investment_pl as investmentPL, currency_pl as currencyPL,
        daily_pl as dailyPL, created_at as createdAt
      FROM performance_history 
      WHERE user_id = ? AND date BETWEEN ? AND ?
      ORDER BY date ASC`,
      [userId, startDate, endDate]
    );
    
    return performance as PerformanceData[];
  }
  
  static async create(userId: number, data: CreatePerformanceData): Promise<PerformanceData> {
    const result = await dbRun(
      'INSERT OR REPLACE INTO performance_history (user_id, date, total_pl, investment_pl, currency_pl, daily_pl) VALUES (?, ?, ?, ?, ?, ?)',
      [userId, data.date, data.totalPL, data.investmentPL, data.currencyPL, data.dailyPL]
    );
    
    const performance = await this.findById(result.lastID, userId);
    if (!performance) {
      throw new Error('Failed to create performance data');
    }
    
    return performance;
  }
  
  static async findById(id: number, userId: number): Promise<PerformanceData | null> {
    const performance = await dbGet(
      `SELECT 
        id, user_id as userId, date, total_pl as totalPL,
        investment_pl as investmentPL, currency_pl as currencyPL,
        daily_pl as dailyPL, created_at as createdAt
      FROM performance_history 
      WHERE id = ? AND user_id = ?`,
      [id, userId]
    );
    
    return performance as PerformanceData | null;
  }
  
  static async getLatest(userId: number): Promise<PerformanceData | null> {
    const performance = await dbGet(
      `SELECT 
        id, user_id as userId, date, total_pl as totalPL,
        investment_pl as investmentPL, currency_pl as currencyPL,
        daily_pl as dailyPL, created_at as createdAt
      FROM performance_history 
      WHERE user_id = ? 
      ORDER BY date DESC 
      LIMIT 1`,
      [userId]
    );
    
    return performance as PerformanceData | null;
  }
}
