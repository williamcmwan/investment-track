import { dbGet, dbAll, dbRun } from '../database/connection.js';

export interface Account {
  id: number;
  userId: number;
  name: string;
  currency: string;
  accountType: string;
  originalCapital: number;
  currentBalance: number;
  lastUpdated: string;
  createdAt: string;
  updatedAt: string;
  profitLoss: number;
  profitLossPercent: number;
}

export interface AccountWithHistory extends Account {
  history: BalanceHistory[];
}

export interface BalanceHistory {
  id: number;
  accountId: number;
  balance: number;
  note: string;
  date: string;
  createdAt: string;
}

export interface CreateAccountData {
  name: string;
  currency: string;
  accountType: string;
  originalCapital: number;
  currentBalance: number;
}

export interface UpdateAccountData {
  name?: string;
  accountType?: string;
  originalCapital?: number;
  currentBalance?: number;
}

export class AccountModel {
  static async findByUserId(userId: number): Promise<Account[]> {
    const accounts = await dbAll(
      `SELECT 
        id, user_id as userId, name, currency, account_type as accountType,
        original_capital as originalCapital, current_balance as currentBalance, 
        last_updated as lastUpdated, created_at as createdAt, updated_at as updatedAt,
        CASE 
          WHEN account_type = 'BANK' THEN 0
          ELSE (current_balance - original_capital)
        END as profitLoss,
        CASE 
          WHEN account_type = 'BANK' THEN 0
          WHEN original_capital > 0 THEN ((current_balance - original_capital) / original_capital * 100)
          ELSE 0
        END as profitLossPercent
      FROM accounts 
      WHERE user_id = ? 
      ORDER BY created_at DESC`,
      [userId]
    );
    
    return accounts as Account[];
  }
  
  static async findById(id: number, userId: number): Promise<Account | null> {
    const account = await dbGet(
      `SELECT 
        id, user_id as userId, name, currency, account_type as accountType,
        original_capital as originalCapital, current_balance as currentBalance, 
        last_updated as lastUpdated, created_at as createdAt, updated_at as updatedAt,
        CASE 
          WHEN account_type = 'BANK' THEN 0
          ELSE (current_balance - original_capital)
        END as profitLoss,
        CASE 
          WHEN account_type = 'BANK' THEN 0
          WHEN original_capital > 0 THEN ((current_balance - original_capital) / original_capital * 100)
          ELSE 0
        END as profitLossPercent
      FROM accounts 
      WHERE id = ? AND user_id = ?`,
      [id, userId]
    );
    
    return account as Account | null;
  }
  
  static async create(userId: number, accountData: CreateAccountData): Promise<Account> {
    const result = await dbRun(
      'INSERT INTO accounts (user_id, name, currency, account_type, original_capital, current_balance) VALUES (?, ?, ?, ?, ?, ?)',
      [userId, accountData.name, accountData.currency, accountData.accountType, accountData.originalCapital, accountData.currentBalance]
    );
    
    const account = await this.findById(result.lastID, userId);
    if (!account) {
      throw new Error('Failed to create account');
    }
    
    // Add initial balance history entry
    await this.addBalanceHistory(result.lastID, accountData.currentBalance, 'Initial balance');
    
    // Return account with history
    const accountWithHistory = await this.getWithHistory(result.lastID, userId);
    return accountWithHistory || account;
  }
  
  static async update(id: number, userId: number, accountData: UpdateAccountData): Promise<Account | null> {
    const updateFields = [];
    const values = [];
    
    if (accountData.name !== undefined) {
      updateFields.push('name = ?');
      values.push(accountData.name);
    }
    
    if (accountData.accountType !== undefined) {
      updateFields.push('account_type = ?');
      values.push(accountData.accountType);
    }
    
    if (accountData.originalCapital !== undefined) {
      updateFields.push('original_capital = ?');
      values.push(accountData.originalCapital);
    }
    
    if (accountData.currentBalance !== undefined) {
      updateFields.push('current_balance = ?');
      updateFields.push("last_updated = datetime('now', 'localtime')");
      values.push(accountData.currentBalance);
    }
    
    if (updateFields.length === 0) {
      return await this.findById(id, userId);
    }
    
    updateFields.push("updated_at = datetime('now', 'localtime')");
    values.push(id, userId);
    
    await dbRun(
      `UPDATE accounts SET ${updateFields.join(', ')} WHERE id = ? AND user_id = ?`,
      values
    );
    
    return await this.findById(id, userId);
  }
  
  static async delete(id: number, userId: number): Promise<boolean> {
    const result = await dbRun(
      'DELETE FROM accounts WHERE id = ? AND user_id = ?',
      [id, userId]
    );
    
    return result.changes > 0;
  }
  
  static async getWithHistory(id: number, userId: number): Promise<AccountWithHistory | null> {
    const account = await this.findById(id, userId);
    if (!account) {
      return null;
    }
    
    const history = await this.getBalanceHistory(id);
    
    return {
      ...account,
      history
    };
  }
  
  static async getBalanceHistory(accountId: number): Promise<BalanceHistory[]> {
    const history = await dbAll(
      'SELECT id, account_id as accountId, balance, note, date, created_at as createdAt FROM account_balance_history WHERE account_id = ? ORDER BY date DESC',
      [accountId]
    );
    
    return history as BalanceHistory[];
  }

  static async getLatestHistoryDate(accountId: number): Promise<string | null> {
    const result = await dbGet(
      'SELECT date FROM account_balance_history WHERE account_id = ? ORDER BY date DESC LIMIT 1',
      [accountId]
    );
    
    return result ? result.date : null;
  }
  
  static async addBalanceHistory(accountId: number, balance: number, note: string, date?: string): Promise<void> {
    const targetDate = date || new Date().toISOString().split('T')[0];
    
    // First, try to update existing entry for the same date
    const updateResult = await dbRun(
      'UPDATE account_balance_history SET balance = ?, note = ?, created_at = CURRENT_TIMESTAMP WHERE account_id = ? AND DATE(date) = DATE(?)',
      [balance, note, accountId, targetDate]
    );
    
    // If no rows were updated, insert a new entry
    if (updateResult.changes === 0) {
      await dbRun(
        'INSERT INTO account_balance_history (account_id, balance, note, date) VALUES (?, ?, ?, ?)',
        [accountId, balance, note, targetDate]
      );
    }
  }

  static async updateBalanceHistory(historyId: number, accountId: number, balance: number, note: string, date: string): Promise<void> {
    await dbRun(
      'UPDATE account_balance_history SET balance = ?, note = ?, date = ?, created_at = CURRENT_TIMESTAMP WHERE id = ? AND account_id = ?',
      [balance, note, date, historyId, accountId]
    );
  }

  static async deleteBalanceHistory(historyId: number, accountId: number): Promise<void> {
    await dbRun(
      'DELETE FROM account_balance_history WHERE id = ? AND account_id = ?',
      [historyId, accountId]
    );
  }
}
