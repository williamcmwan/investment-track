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
    currentBalance?: number;
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

  async addBalanceHistory(accountId: number, balance: number, note: string) {
    return this.request<{ message: string }>(`/accounts/${accountId}/history`, {
      method: 'POST',
      body: JSON.stringify({ balance, note }),
    });
  }

  // Currency endpoints
  async getCurrencyPairs() {
    return this.request<any[]>('/currencies');
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
    return this.request<{ pair: string; rate: number; timestamp: string }>(`/currencies/rate/${pair}`);
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
}

export const apiClient = new ApiClient(API_BASE_URL);
export default apiClient;
