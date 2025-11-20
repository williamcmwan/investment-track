import { AccountModel, IBIntegrationConfig, SchwabIntegrationConfig } from '../models/Account.js';
import { IBServiceOptimized } from './ibServiceOptimized.js';
import { SchwabService } from './schwabService.js';
import { Logger } from '../utils/logger.js';

export interface IntegrationRefreshResult {
  success: boolean;
  balance?: number;
  currency?: string;
  error?: string;
}

export class IntegrationService {
  /**
   * Refresh balance for a single account with integration
   */
  static async refreshAccountBalance(accountId: number, userId: number): Promise<IntegrationRefreshResult> {
    try {
      const config = await AccountModel.getIntegration(accountId, userId);
      
      if (!config) {
        return { success: false, error: 'No integration configured' };
      }

      if (config.type === 'IB') {
        return await this.refreshIBAccount(accountId, userId, config as any);
      } else if (config.type === 'SCHWAB') {
        return await this.refreshSchwabAccount(accountId, userId, config as any);
      }

      return { success: false, error: 'Unknown integration type' };
    } catch (error: any) {
      Logger.error(`Failed to refresh account ${accountId}:`, error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Refresh all accounts with integrations for a user
   */
  static async refreshAllIntegrations(userId: number): Promise<{
    total: number;
    successful: number;
    failed: number;
    results: Array<{ accountId: number; accountName: string; success: boolean; balance?: number; error?: string }>;
  }> {
    try {
      // Get all accounts with integrations
      const ibAccounts = await AccountModel.findByIntegrationType(userId, 'IB');
      const schwabAccounts = await AccountModel.findByIntegrationType(userId, 'SCHWAB');
      
      const allAccounts = [...ibAccounts, ...schwabAccounts];
      const results = [];
      let successful = 0;
      let failed = 0;

      for (const account of allAccounts) {
        const result = await this.refreshAccountBalance(account.id, userId);
        
        results.push({
          accountId: account.id,
          accountName: account.name,
          success: result.success,
          ...(result.balance !== undefined && { balance: result.balance }),
          ...(result.error && { error: result.error })
        });

        if (result.success) {
          successful++;
        } else {
          failed++;
        }
      }

      Logger.info(`✅ Refreshed ${successful}/${allAccounts.length} integrated accounts for user ${userId}`);

      return {
        total: allAccounts.length,
        successful,
        failed,
        results
      };
    } catch (error: any) {
      Logger.error('Failed to refresh all integrations:', error);
      throw error;
    }
  }

  /**
   * Refresh IB account using optimized service
   */
  private static async refreshIBAccount(
    accountId: number,
    userId: number,
    config: IBIntegrationConfig
  ): Promise<IntegrationRefreshResult> {
    try {
      const result = await IBServiceOptimized.refreshPortfolio({
        host: config.host,
        port: config.port,
        client_id: config.clientId,
        target_account_id: accountId
      });

      if (result && result.balance) {
        // Use helper to update account balance and add history
        await AccountModel.updateBalanceWithHistory(
          accountId,
          userId,
          result.balance.balance,
          'IB integration auto-refresh'
        );

        Logger.info(`✅ IB: Refreshed account ${accountId} - ${result.balance.balance} ${result.balance.currency}`);

        return {
          success: true,
          balance: result.balance.balance,
          currency: result.balance.currency
        };
      }

      return { success: false, error: 'No balance data returned from IB' };
    } catch (error: any) {
      Logger.error(`❌ IB: Failed to refresh account ${accountId}:`, error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Refresh Schwab account
   */
  private static async refreshSchwabAccount(
    accountId: number,
    userId: number,
    config: SchwabIntegrationConfig
  ): Promise<IntegrationRefreshResult> {
    try {
      if (!config.accountHash) {
        return { success: false, error: 'Schwab account hash not configured' };
      }

      const result = await SchwabService.getAccountBalance(userId, config.accountHash);

      if (result && result.currentBalance) {
        // Use helper to update account balance and add history
        await AccountModel.updateBalanceWithHistory(
          accountId,
          userId,
          result.currentBalance,
          'Schwab integration auto-refresh'
        );

        Logger.info(`✅ Schwab: Refreshed account ${accountId} - ${result.currentBalance} ${result.currency || 'USD'}`);

        return {
          success: true,
          balance: result.currentBalance,
          currency: result.currency || 'USD'
        };
      }

      return { success: false, error: 'No balance data returned from Schwab' };
    } catch (error: any) {
      Logger.error(`❌ Schwab: Failed to refresh account ${accountId}:`, error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Test integration connection
   */
  static async testConnection(accountId: number, userId: number): Promise<{
    success: boolean;
    message: string;
    details?: any;
  }> {
    try {
      const config = await AccountModel.getIntegration(accountId, userId);
      
      if (!config) {
        return { success: false, message: 'No integration configured' };
      }

      if (config.type === 'IB') {
        const ibConfig = config as any;
        try {
          const result = await IBServiceOptimized.refreshPortfolio({
            host: ibConfig.host,
            port: ibConfig.port,
            client_id: ibConfig.clientId,
            target_account_id: accountId
          });

          return {
            success: true,
            message: 'IB connection successful',
            details: { balance: result?.balance?.balance, currency: result?.balance?.currency }
          };
        } catch (error: any) {
          return { success: false, message: `IB connection failed: ${error.message}` };
        }
      } else if (config.type === 'SCHWAB') {
        try {
          const accounts = await SchwabService.getAccountNumbers(userId);
          return {
            success: true,
            message: 'Schwab connection successful',
            details: { accounts }
          };
        } catch (error: any) {
          return { success: false, message: `Schwab connection failed: ${error.message}` };
        }
      }

      return { success: false, message: 'Unknown integration type' };
    } catch (error: any) {
      Logger.error('Test connection error:', error);
      return { success: false, message: error.message };
    }
  }
}
