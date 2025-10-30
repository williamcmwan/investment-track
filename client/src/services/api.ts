const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3002/api';

interface ApiResponse<T> {
  data?: T;
  error?: string;
  message?: string;
}

class ApiClient {
  private baseURL: string;
  private token: string | null = null;

  constructor(baseURL: string) {
    this.baseURL = baseURL;
    this.token = localStorage.getItem('auth_token');
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const url = `${this.baseURL}${endpoint}`;
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (this.token) {
      headers.Authorization = `Bearer ${this.token}`;
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          error: data.error || 'Request failed',
          details: data.details || null
        };
      }

      return { data: data };
    } catch (error) {
      return { error: 'Network error' };
    }
  }

  setToken(token: string | null) {
    this.token = token;
    if (token) {
      localStorage.setItem('auth_token', token);
    } else {
      localStorage.removeItem('auth_token');
    }
  }

  // Auth endpoints
  async login(email: string, password: string) {
    return this.request<{ user: any; token: string }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  }

  async register(userData: {
    email: string;
    password: string;
    name: string;
    baseCurrency?: string;
  }) {
    return this.request<{ user: any; token: string }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(userData),
    });
  }

  // Account endpoints
  async getAccounts() {
    return this.request<any[]>('/accounts');
  }

  async getAccount(id: number) {
    return this.request<any>(`/accounts/${id}`);
  }

  async createAccount(accountData: {
    name: string;
    currency: string;
    accountType: string;
    accountNumber?: string;
    originalCapital: number;
    currentBalance: number;
  }) {
    return this.request<any>('/accounts', {
      method: 'POST',
      body: JSON.stringify(accountData),
    });
  }

  async updateAccount(id: number, accountData: {
    name?: string;
    accountType?: string;
    accountNumber?: string;
    originalCapital?: number;
    currentBalance?: number;
    date?: string;
  }) {
    return this.request<any>(`/accounts/${id}`, {
      method: 'PUT',
      body: JSON.stringify(accountData),
    });
  }

  async deleteAccount(id: number) {
    return this.request<{ message: string }>(`/accounts/${id}`, {
      method: 'DELETE',
    });
  }

  async addBalanceHistory(accountId: number, balance: number, note: string, date?: string) {
    return this.request<{ message: string }>(`/accounts/${accountId}/history`, {
      method: 'POST',
      body: JSON.stringify({ balance, note, date }),
    });
  }

  async updateBalanceHistory(accountId: number, historyId: number, balance: number, note: string, date: string) {
    return this.request<{ message: string }>(`/accounts/${accountId}/history/${historyId}`, {
      method: 'PUT',
      body: JSON.stringify({ balance, note, date }),
    });
  }

  async deleteBalanceHistory(accountId: number, historyId: number) {
    return this.request<{ message: string }>(`/accounts/${accountId}/history/${historyId}`, {
      method: 'DELETE',
    });
  }

  // Currency endpoints
  async getCurrencyPairs(refresh: boolean = false) {
    const query = refresh ? '?refresh=1' : '';
    return this.request<any[]>(`/currencies${query}`);
  }

  async getCurrencyPair(id: number) {
    return this.request<any>(`/currencies/${id}`);
  }

  async createCurrencyPair(pairData: {
    pair: string;
    avgCost: number;
    amount: number;
  }) {
    return this.request<any>('/currencies', {
      method: 'POST',
      body: JSON.stringify(pairData),
    });
  }

  async updateCurrencyPair(id: number, pairData: {
    currentRate?: number;
    avgCost?: number;
    amount?: number;
  }) {
    return this.request<any>(`/currencies/${id}`, {
      method: 'PUT',
      body: JSON.stringify(pairData),
    });
  }

  async deleteCurrencyPair(id: number) {
    return this.request<{ message: string }>(`/currencies/${id}`, {
      method: 'DELETE',
    });
  }

  // Currency exchange methods
  async updateExchangeRates() {
    return this.request<{ message: string; pairs: any[] }>('/currencies/update-rates', {
      method: 'POST',
    });
  }

  async updateEnhancedExchangeRates() {
    return this.request<{ message: string; pairs: any[]; accuracy: string }>('/currencies/update-rates-enhanced', {
      method: 'POST',
    });
  }

  async getPopularPairs(baseCurrency: string = 'HKD') {
    return this.request<string[]>(`/currencies/popular-pairs?baseCurrency=${baseCurrency}`);
  }

  async getExchangeRate(pair: string) {
    const encodedPair = encodeURIComponent(pair);
    return this.request<{ pair: string; rate: number; timestamp: string }>(`/currencies/public-rate/${encodedPair}`);
  }

  // Performance endpoints
  async getPerformance(limit?: number) {
    const endpoint = limit ? `/performance?limit=${limit}` : '/performance';
    return this.request<any[]>(endpoint);
  }

  async getPerformanceRange(startDate: string, endDate: string) {
    return this.request<any[]>(`/performance/range?startDate=${startDate}&endDate=${endDate}`);
  }

  async getLatestPerformance() {
    return this.request<any>('/performance/latest');
  }

  async createPerformanceData(data: {
    date: string;
    totalPL: number;
    investmentPL: number;
    currencyPL: number;
    dailyPL: number;
  }) {
    return this.request<any>('/performance', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async calculateTodaySnapshot() {
    return this.request<any>('/performance/calculate-today', {
      method: 'POST',
    });
  }

  async calculateSnapshot(date: string) {
    return this.request<any>('/performance/calculate-snapshot', {
      method: 'POST',
      body: JSON.stringify({ date }),
    });
  }

  async backfillPerformanceHistory(startDate: string, endDate: string) {
    return this.request<{ message: string }>('/performance/backfill', {
      method: 'POST',
      body: JSON.stringify({ startDate, endDate }),
    });
  }

  async getPerformanceChartData(limit?: number) {
    const query = limit ? `?limit=${limit}` : '';
    return this.request<any[]>(`/performance/chart${query}`);
  }

  async triggerDailyCalculation() {
    return this.request<{ message: string }>('/performance/trigger-daily-calculation', {
      method: 'POST',
    });
  }

  async getSchedulerStatus() {
    return this.request<{ isRunning: boolean; tasks: number; nextRun: string }>('/performance/scheduler-status');
  }

  // Two-Factor Authentication endpoints
  async setupTwoFactor() {
    return this.request<{ secret: string; qrCodeUrl: string; manualEntryKey: string }>('/2fa/setup', {
      method: 'POST',
    });
  }

  async verifyTwoFactor(token: string) {
    return this.request<{ message: string; backupCodes?: string[] }>('/2fa/verify', {
      method: 'POST',
      body: JSON.stringify({ token }),
    });
  }

  async verifyTwoFactorLogin(userId: number, token: string) {
    return this.request<{
      message: string;
      verified: boolean;
      user?: any;
      token?: string;
    }>('/2fa/verify-login', {
      method: 'POST',
      body: JSON.stringify({ userId, token }),
    });
  }

  async getTwoFactorStatus() {
    return this.request<{ enabled: boolean }>('/2fa/status');
  }

  async disableTwoFactor() {
    return this.request<{ message: string }>('/2fa/disable', {
      method: 'POST',
    });
  }

  // Interactive Brokers Integration endpoints
  async getIBSettings() {
    return this.request<{ host: string; port: number; client_id: number; target_account_id?: number }>('/integration/ib/settings');
  }

  async saveIBSettings(settings: { host: string; port: number; client_id: number; target_account_id?: number }) {
    return this.request<{ success: boolean; message: string }>('/integration/ib/settings', {
      method: 'POST',
      body: JSON.stringify(settings),
    });
  }

  async getIBBalance() {
    return this.request<{
      balance: number;
      currency: string;
      netLiquidation?: number;
      totalCashValue?: number;
      timestamp?: number;
    }>('/integration/ib/balance', {
      method: 'POST',
    });
  }

  async getIBPortfolio() {
    return this.request<Array<{
      symbol: string;
      secType: string;
      currency: string;
      position: number;
      averageCost: number;
      marketPrice: number;
      marketValue: number;
      unrealizedPNL: number;
      realizedPNL: number;
      exchange?: string;
      primaryExchange?: string;
      conId?: number;
      industry?: string;
      category?: string;
      country?: string;
    }>>('/integration/ib/portfolio', {
      method: 'POST',
    });
  }

  async forceRefreshIBBalance() {
    return this.request<{
      balance: number;
      currency: string;
      netLiquidation?: number;
      totalCashValue?: number;
      timestamp?: number;
    }>('/integration/ib/balance/refresh', {
      method: 'POST',
    });
  }

  async forceRefreshIBPortfolio() {
    return this.request<Array<{
      symbol: string;
      secType: string;
      currency: string;
      position: number;
      averageCost: number;
      marketPrice: number;
      marketValue: number;
      unrealizedPNL: number;
      realizedPNL: number;
      exchange?: string;
      primaryExchange?: string;
      conId?: number;
      industry?: string;
      category?: string;
      country?: string;
    }>>('/integration/ib/portfolio/refresh', {
      method: 'POST',
    });
  }

  async getIBCashBalances() {
    return this.request<{
      data: Array<{
        currency: string;
        amount: number;
        marketValue: number;
      }>;
      timestamp?: number;
    }>('/integration/ib/cash', {
      method: 'POST',
    });
  }

  async forceRefreshIBCashBalances() {
    return this.request<{
      data: Array<{
        currency: string;
        amount: number;
        marketValue: number;
      }>;
      timestamp?: number;
    }>('/integration/ib/cash/refresh', {
      method: 'POST',
    });
  }



  // Manual Investment endpoints
  async getManualPositions() {
    return this.request<any[]>('/manual-investments/positions');
  }

  async createManualPosition(positionData: any) {
    return this.request<any>('/manual-investments/positions', {
      method: 'POST',
      body: JSON.stringify(positionData),
    });
  }

  async updateManualPosition(positionId: number, positionData: any) {
    return this.request<any>(`/manual-investments/positions/${positionId}`, {
      method: 'PUT',
      body: JSON.stringify(positionData),
    });
  }

  async deleteManualPosition(positionId: number) {
    return this.request<{ success: boolean }>(`/manual-investments/positions/${positionId}`, {
      method: 'DELETE',
    });
  }

  async refreshManualMarketData(userId: string = 'default') {
    return this.request<{ 
      updated: number; 
      failed: number; 
      lastRefreshTime: string | null;
    }>('/manual-investments/positions/refresh-market-data', {
      method: 'POST',
      body: JSON.stringify({ userId }),
    });
  }

  async getManualInvestmentRefreshStatus() {
    return this.request<{
      lastRefreshTime: string | null;
      timeSinceLastRefresh: number | null;
      nextAutoRefresh: string | null;
      autoRefreshEnabled: boolean;
    }>('/manual-investments/refresh-status');
  }

  async searchSymbols(query: string) {
    return this.request<any[]>(`/manual-investments/search-symbols?q=${encodeURIComponent(query)}`);
  }

  async getMarketDataForSymbol(symbol: string) {
    return this.request<any>(`/manual-investments/market-data/${encodeURIComponent(symbol)}`);
  }

  // Last update times endpoints
  async getAllLastUpdateTimes() {
    return this.request<{
      currency: string | null;
      ibPortfolio: string | null;
      manualInvestments: string | null;
      currencyTimestamp: number | null;
      ibPortfolioTimestamp: number | null;
      manualInvestmentsTimestamp: number | null;
      timestamp: string;
    }>('/currencies/all-last-updates');
  }

  async getCurrencyLastUpdate() {
    return this.request<{
      lastUpdate: string | null;
      timestamp: string;
    }>('/currencies/last-update');
  }

  // Cash Balance endpoints
  async getCashBalances() {
    return this.request<Array<{
      id: number;
      mainAccountId: number;
      currency: string;
      amount: number;
      marketValueHKD: number;
      marketValueUSD: number;
      lastUpdated: string;
      createdAt: string;
      updatedAt: string;
      accountName: string;
    }>>('/manual-investments/cash-balances');
  }

  async createCashBalance(cashBalanceData: {
    accountId: number;
    currency: string;
    amount: number;
  }) {
    return this.request<any>('/manual-investments/cash-balances', {
      method: 'POST',
      body: JSON.stringify(cashBalanceData),
    });
  }

  async updateCashBalance(cashBalanceId: number, cashBalanceData: {
    currency?: string;
    amount?: number;
  }) {
    return this.request<any>(`/manual-investments/cash-balances/${cashBalanceId}`, {
      method: 'PUT',
      body: JSON.stringify(cashBalanceData),
    });
  }

  async deleteCashBalance(cashBalanceId: number) {
    return this.request<{ success: boolean }>(`/manual-investments/cash-balances/${cashBalanceId}`, {
      method: 'DELETE',
    });
  }

  // Other Assets endpoints
  async getOtherAssets() {
    return this.request<any[]>('/other-assets');
  }

  async createOtherAsset(assetData: {
    assetType: string;
    asset: string;
    currency: string;
    originalValue: number;
    marketValue: number;
    remarks: string;
  }) {
    return this.request<any>('/other-assets', {
      method: 'POST',
      body: JSON.stringify(assetData),
    });
  }

  async updateOtherAsset(id: number, assetData: {
    assetType?: string;
    asset?: string;
    currency?: string;
    originalValue?: number;
    marketValue?: number;
    remarks?: string;
  }) {
    return this.request<any>(`/other-assets/${id}`, {
      method: 'PUT',
      body: JSON.stringify(assetData),
    });
  }

  async deleteOtherAsset(id: number) {
    return this.request<{ message: string }>(`/other-assets/${id}`, {
      method: 'DELETE',
    });
  }
}

export const apiClient = new ApiClient(API_BASE_URL);
export default apiClient;
