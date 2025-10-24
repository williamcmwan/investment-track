import { dbGet, dbRun } from '../database/connection.js';

interface IBConnectionSettings {
  host: string;
  port: number;
  client_id: number;
  target_account_id?: number;
}

export class IBConnectionService {
  // Get user's IB connection settings
  static async getUserIBSettings(userId: number): Promise<IBConnectionSettings | null> {
    const query = `
      SELECT host, port, client_id, target_account_id 
      FROM ib_connections 
      WHERE user_id = ? 
      ORDER BY updated_at DESC 
      LIMIT 1
    `;
    
    try {
      const row = await dbGet(query, [userId]);
      
      if (!row) {
        return null;
      }
      
      return {
        host: row.host,
        port: row.port,
        client_id: row.client_id,
        target_account_id: row.target_account_id
      };
    } catch (error) {
      console.error('IBConnectionService: Database error:', error);
      throw error;
    }
  }

  // Save or update user's IB connection settings
  static async saveUserIBSettings(userId: number, settings: IBConnectionSettings): Promise<void> {
    try {
      // First check if user already has settings
      const existing = await this.getUserIBSettings(userId);
      
      if (existing) {
        // Update existing settings
        const updateQuery = `
          UPDATE ib_connections 
          SET host = ?, port = ?, client_id = ?, target_account_id = ?, updated_at = CURRENT_TIMESTAMP
          WHERE user_id = ?
        `;
        
        await dbRun(updateQuery, [
          settings.host,
          settings.port,
          settings.client_id,
          settings.target_account_id || null,
          userId
        ]);
      } else {
        // Insert new settings
        const insertQuery = `
          INSERT INTO ib_connections (user_id, name, host, port, client_id, target_account_id)
          VALUES (?, ?, ?, ?, ?, ?)
        `;
        
        await dbRun(insertQuery, [
          userId,
          'Default IB Connection',
          settings.host,
          settings.port,
          settings.client_id,
          settings.target_account_id || null
        ]);
      }
    } catch (error) {
      console.error('IBConnectionService: Error saving settings:', error);
      throw error;
    }
  }

  // Update connection status
  static async updateConnectionStatus(userId: number, isConnected: boolean, error?: string): Promise<void> {
    const query = `
      UPDATE ib_connections 
      SET is_connected = ?, last_connected = ?, error = ?, updated_at = CURRENT_TIMESTAMP
      WHERE user_id = ?
    `;
    
    try {
      await dbRun(query, [
        isConnected,
        isConnected ? new Date().toISOString() : null,
        error || null,
        userId
      ]);
    } catch (err) {
      console.error('IBConnectionService: Error updating connection status:', err);
      throw err;
    }
  }

  // Update account balance
  static async updateAccountBalance(userId: number, balance: number, currency: string): Promise<void> {
    const query = `
      UPDATE ib_connections 
      SET account_balance = ?, account_currency = ?, updated_at = CURRENT_TIMESTAMP
      WHERE user_id = ?
    `;
    
    try {
      await dbRun(query, [balance, currency, userId]);
    } catch (error) {
      console.error('IBConnectionService: Error updating account balance:', error);
      throw error;
    }
  }
}