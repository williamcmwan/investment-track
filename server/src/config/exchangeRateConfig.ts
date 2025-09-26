/**
 * Exchange Rate Configuration
 * 
 * This file contains configuration for multiple exchange rate sources
 * to improve accuracy and reliability.
 */

export interface ExchangeRateSource {
  name: string;
  url: string;
  weight: number;
  requiresApiKey: boolean;
  updateFrequency: string;
  accuracy: 'high' | 'medium' | 'low';
  cost: 'free' | 'paid';
}

export const EXCHANGE_RATE_SOURCES: ExchangeRateSource[] = [
  {
    name: 'exchangerate-api',
    url: 'https://api.exchangerate-api.com/v4/latest/USD',
    weight: 0.6,
    requiresApiKey: false,
    updateFrequency: '60 minutes',
    accuracy: 'high',
    cost: 'free'
  },
  {
    name: 'currencyapi',
    url: 'https://api.currencyapi.com/v3/latest',
    weight: 0.3,
    requiresApiKey: true,
    updateFrequency: '60 seconds',
    accuracy: 'high',
    cost: 'paid'
  },
  {
    name: 'fixer',
    url: 'http://data.fixer.io/api/latest',
    weight: 0.3,
    requiresApiKey: true,
    updateFrequency: '60 minutes',
    accuracy: 'high',
    cost: 'paid'
  },
  {
    name: 'twelve-data',
    url: 'https://api.twelvedata.com/forex_pairs',
    weight: 0.2,
    requiresApiKey: true,
    updateFrequency: '1 minute',
    accuracy: 'high',
    cost: 'paid'
  }
];

export const EXCHANGE_RATE_CONFIG = {
  // Cache settings
  CACHE_DURATION: 10 * 60 * 1000, // 10 minutes
  FORCE_UPDATE_DURATION: 30 * 60 * 1000, // 30 minutes
  
  // API settings
  REQUEST_TIMEOUT: 5000, // 5 seconds
  MAX_RETRIES: 3,
  
  // Accuracy settings
  MIN_SOURCES: 1, // Minimum number of sources required
  WEIGHT_THRESHOLD: 0.5, // Minimum total weight for accuracy
  
  // Fallback settings
  FALLBACK_TO_CACHE: true,
  FALLBACK_TO_SINGLE_SOURCE: true
};

/**
 * Get API key for a specific source
 */
export function getApiKey(sourceName: string): string | null {
  const apiKeys: Record<string, string> = {
    'currencyapi': process.env.CURRENCYAPI_API_KEY || null,
    'fixer': process.env.FIXER_API_KEY || null,
    'twelve-data': process.env.TWELVE_DATA_API_KEY || null
  };
  
  return apiKeys[sourceName] || null;
}

/**
 * Check if a source is available (has API key if required)
 */
export function isSourceAvailable(source: ExchangeRateSource): boolean {
  if (!source.requiresApiKey) {
    return true;
  }
  
  const apiKey = getApiKey(source.name);
  return apiKey !== null && apiKey.length > 0;
}

/**
 * Get available sources (free + paid with API keys)
 */
export function getAvailableSources(): ExchangeRateSource[] {
  return EXCHANGE_RATE_SOURCES.filter(source => {
    if (!source.requiresApiKey) {
      return true; // Free sources are always available
    }
    return isSourceAvailable(source);
  });
}
