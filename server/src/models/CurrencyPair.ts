import { dbGet, dbAll, dbRun } from '../database/connection.js';

export interface CurrencyPair {
  id: number;
  userId: number;
  pair: string;
  currentRate: number;
  avgCost: number;
  amount: number;
  createdAt: string;
  updatedAt: string;
  profitLoss: number;
  profitLossPercent: number;
}

export interface CreateCurrencyPairData {
  pair: string;
  currentRate: number;
  avgCost: number;
  amount: number;
}

export interface UpdateCurrencyPairData {
  currentRate?: number;
  avgCost?: number;
  amount?: number;
}

export class CurrencyPairModel {
  static async findByUserId(userId: number): Promise<CurrencyPair[]> {
    const pairs = await dbAll(
      `SELECT 
        id, user_id as userId, pair, current_rate as currentRate,
        avg_cost as avgCost, amount, created_at as createdAt, updated_at as updatedAt,
        ((current_rate - avg_cost) * amount) as profitLoss,
        (((current_rate - avg_cost) / avg_cost) * 100) as profitLossPercent
      FROM currency_pairs 
      WHERE user_id = ? 
      ORDER BY created_at DESC`,
      [userId]
    );
    
    return pairs as CurrencyPair[];
  }
  
  static async findById(id: number, userId: number): Promise<CurrencyPair | null> {
    const pair = await dbGet(
      `SELECT 
        id, user_id as userId, pair, current_rate as currentRate,
        avg_cost as avgCost, amount, created_at as createdAt, updated_at as updatedAt,
        ((current_rate - avg_cost) * amount) as profitLoss,
        (((current_rate - avg_cost) / avg_cost) * 100) as profitLossPercent
      FROM currency_pairs 
      WHERE id = ? AND user_id = ?`,
      [id, userId]
    );
    
    return pair as CurrencyPair | null;
  }
  
  static async create(userId: number, pairData: CreateCurrencyPairData): Promise<CurrencyPair> {
    const result = await dbRun(
      'INSERT INTO currency_pairs (user_id, pair, current_rate, avg_cost, amount) VALUES (?, ?, ?, ?, ?)',
      [userId, pairData.pair, pairData.currentRate, pairData.avgCost, pairData.amount]
    );
    
    const pair = await this.findById(result.lastID, userId);
    if (!pair) {
      throw new Error('Failed to create currency pair');
    }
    
    return pair;
  }
  
  static async update(id: number, userId: number, pairData: UpdateCurrencyPairData): Promise<CurrencyPair | null> {
    const updateFields = [];
    const values = [];
    
    if (pairData.currentRate !== undefined) {
      updateFields.push('current_rate = ?');
      values.push(pairData.currentRate);
    }
    
    if (pairData.avgCost !== undefined) {
      updateFields.push('avg_cost = ?');
      values.push(pairData.avgCost);
    }
    
    if (pairData.amount !== undefined) {
      updateFields.push('amount = ?');
      values.push(pairData.amount);
    }
    
    if (updateFields.length === 0) {
      return await this.findById(id, userId);
    }
    
    updateFields.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id, userId);
    
    await dbRun(
      `UPDATE currency_pairs SET ${updateFields.join(', ')} WHERE id = ? AND user_id = ?`,
      values
    );
    
    return await this.findById(id, userId);
  }
  
  static async delete(id: number, userId: number): Promise<boolean> {
    const result = await dbRun(
      'DELETE FROM currency_pairs WHERE id = ? AND user_id = ?',
      [id, userId]
    );
    
    return result.changes > 0;
  }
}
