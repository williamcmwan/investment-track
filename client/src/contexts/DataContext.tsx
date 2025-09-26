import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { apiClient } from '../services/api';

interface Account {
  id: number;
  name: string;
  currency: string;
  originalCapital: number;
  currentBalance: number;
  lastUpdated: string;
  profitLoss: number;
  profitLossPercent: number;
  history?: Array<{
    id: number;
    balance: number;
    note: string;
    date: string;
  }>;
}

interface CurrencyPair {
  id: number;
  pair: string;
  currentRate: number;
  avgCost: number;
  amount: number;
  profitLoss: number;
  profitLossPercent: number;
}

interface PerformanceData {
  id: number;
  date: string;
  totalPL: number;
  investmentPL: number;
  currencyPL: number;
  dailyPL: number;
}

interface DataContextType {
  accounts: Account[];
  currencyPairs: CurrencyPair[];
  performanceData: PerformanceData[];
  isLoading: boolean;
  error: string | null;
  refreshAccounts: () => Promise<void>;
  refreshCurrencyPairs: () => Promise<void>;
  refreshPerformanceData: () => Promise<void>;
  refreshAll: () => Promise<void>;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export const useData = () => {
  const context = useContext(DataContext);
  if (context === undefined) {
    throw new Error('useData must be used within a DataProvider');
  }
  return context;
};

interface DataProviderProps {
  children: ReactNode;
}

export const DataProvider: React.FC<DataProviderProps> = ({ children }) => {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [currencyPairs, setCurrencyPairs] = useState<CurrencyPair[]>([]);
  const [performanceData, setPerformanceData] = useState<PerformanceData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshAccounts = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await apiClient.getAccounts();
      if (response.data) {
        setAccounts(response.data);
      } else {
        setError(response.error || 'Failed to fetch accounts');
      }
    } catch (err) {
      setError('Network error while fetching accounts');
    } finally {
      setIsLoading(false);
    }
  };

  const refreshCurrencyPairs = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await apiClient.getCurrencyPairs();
      if (response.data) {
        setCurrencyPairs(response.data);
      } else {
        setError(response.error || 'Failed to fetch currency pairs');
      }
    } catch (err) {
      setError('Network error while fetching currency pairs');
    } finally {
      setIsLoading(false);
    }
  };

  const refreshPerformanceData = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await apiClient.getPerformance();
      if (response.data) {
        setPerformanceData(response.data);
      } else {
        setError(response.error || 'Failed to fetch performance data');
      }
    } catch (err) {
      setError('Network error while fetching performance data');
    } finally {
      setIsLoading(false);
    }
  };

  const refreshAll = async () => {
    await Promise.all([
      refreshAccounts(),
      refreshCurrencyPairs(),
      refreshPerformanceData(),
    ]);
  };

  const value: DataContextType = {
    accounts,
    currencyPairs,
    performanceData,
    isLoading,
    error,
    refreshAccounts,
    refreshCurrencyPairs,
    refreshPerformanceData,
    refreshAll,
  };

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
};
