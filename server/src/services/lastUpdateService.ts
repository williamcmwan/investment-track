import * as fs from 'fs';
import * as path from 'path';

interface LastUpdateTimes {
  currency: number | null;
  ibPortfolio: number | null;
  manualInvestments: number | null;
}

export class LastUpdateService {
  private static readonly CACHE_DIR = path.join(process.cwd(), 'cache');
  private static readonly LAST_UPDATE_FILE = path.join(LastUpdateService.CACHE_DIR, 'last_updates.json');
  
  private static lastUpdateTimes: LastUpdateTimes = {
    currency: null,
    ibPortfolio: null,
    manualInvestments: null
  };

  /**
   * Initialize the service and load existing update times
   */
  static initialize(): void {
    this.ensureCacheDir();
    this.loadFromFile();
  }

  /**
   * Ensure cache directory exists
   */
  private static ensureCacheDir(): void {
    if (!fs.existsSync(this.CACHE_DIR)) {
      fs.mkdirSync(this.CACHE_DIR, { recursive: true });
    }
  }

  /**
   * Load last update times from file
   */
  private static loadFromFile(): void {
    try {
      if (fs.existsSync(this.LAST_UPDATE_FILE)) {
        const data = fs.readFileSync(this.LAST_UPDATE_FILE, 'utf8');
        this.lastUpdateTimes = JSON.parse(data);
        console.log('📅 Loaded last update times from file');
      }
    } catch (error) {
      console.error('❌ Failed to load last update times:', error);
      // Reset to defaults if file is corrupted
      this.lastUpdateTimes = {
        currency: null,
        ibPortfolio: null,
        manualInvestments: null
      };
    }
  }

  /**
   * Save last update times to file
   */
  private static saveToFile(): void {
    try {
      this.ensureCacheDir();
      fs.writeFileSync(this.LAST_UPDATE_FILE, JSON.stringify(this.lastUpdateTimes, null, 2));
    } catch (error) {
      console.error('❌ Failed to save last update times:', error);
    }
  }

  /**
   * Update currency last refresh time
   */
  static updateCurrencyTime(): void {
    this.lastUpdateTimes.currency = Date.now();
    this.saveToFile();
    console.log('📅 Updated currency last refresh time');
  }

  /**
   * Update IB portfolio last refresh time
   */
  static updateIBPortfolioTime(): void {
    this.lastUpdateTimes.ibPortfolio = Date.now();
    this.saveToFile();
    console.log('📅 Updated IB portfolio last refresh time');
  }

  /**
   * Update manual investments last refresh time
   */
  static updateManualInvestmentsTime(): void {
    this.lastUpdateTimes.manualInvestments = Date.now();
    this.saveToFile();
    console.log('📅 Updated manual investments last refresh time');
  }

  /**
   * Get all last update times
   */
  static getAllLastUpdateTimes(): {
    currency: string | null;
    ibPortfolio: string | null;
    manualInvestments: string | null;
    currencyTimestamp: number | null;
    ibPortfolioTimestamp: number | null;
    manualInvestmentsTimestamp: number | null;
  } {
    return {
      currency: this.lastUpdateTimes.currency ? new Date(this.lastUpdateTimes.currency).toISOString() : null,
      ibPortfolio: this.lastUpdateTimes.ibPortfolio ? new Date(this.lastUpdateTimes.ibPortfolio).toISOString() : null,
      manualInvestments: this.lastUpdateTimes.manualInvestments ? new Date(this.lastUpdateTimes.manualInvestments).toISOString() : null,
      currencyTimestamp: this.lastUpdateTimes.currency,
      ibPortfolioTimestamp: this.lastUpdateTimes.ibPortfolio,
      manualInvestmentsTimestamp: this.lastUpdateTimes.manualInvestments
    };
  }

  /**
   * Get currency last update time
   */
  static getCurrencyLastUpdate(): string | null {
    return this.lastUpdateTimes.currency ? new Date(this.lastUpdateTimes.currency).toISOString() : null;
  }

  /**
   * Get IB portfolio last update time
   */
  static getIBPortfolioLastUpdate(): string | null {
    return this.lastUpdateTimes.ibPortfolio ? new Date(this.lastUpdateTimes.ibPortfolio).toISOString() : null;
  }

  /**
   * Get manual investments last update time
   */
  static getManualInvestmentsLastUpdate(): string | null {
    return this.lastUpdateTimes.manualInvestments ? new Date(this.lastUpdateTimes.manualInvestments).toISOString() : null;
  }

  /**
   * Get time since last update in minutes
   */
  static getTimeSinceLastUpdate(type: 'currency' | 'ibPortfolio' | 'manualInvestments'): number | null {
    const timestamp = this.lastUpdateTimes[type];
    if (!timestamp) return null;
    return Math.floor((Date.now() - timestamp) / 1000 / 60);
  }

  /**
   * Check if data needs refresh (older than 30 minutes)
   */
  static needsRefresh(type: 'currency' | 'ibPortfolio' | 'manualInvestments'): boolean {
    const timeSinceUpdate = this.getTimeSinceLastUpdate(type);
    return timeSinceUpdate === null || timeSinceUpdate >= 30;
  }
}