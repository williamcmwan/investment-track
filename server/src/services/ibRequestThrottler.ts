import { Logger } from '../utils/logger.js';

/**
 * Request throttler to avoid IB Gateway pacing violations
 * 
 * IB Gateway limits:
 * - Historical data: 60 requests per 10 minutes
 * - Market data: 100 requests per second (but practically much lower)
 * 
 * Error codes to watch for:
 * - 162: Historical data pacing violation
 * - 420: Market data farm connection issue
 */
export class IBRequestThrottler {
  private static lastHistoricalDataRequest = 0;
  private static historicalDataRequestCount = 0;
  private static historicalDataRequestWindow = Date.now();
  private static readonly MIN_REQUEST_DELAY = 2000; // 2 seconds between requests
  private static readonly MAX_REQUESTS_PER_10MIN = 50; // Conservative limit (IB allows 60)
  private static isPacingViolation = false;
  private static pacingViolationUntil = 0;

  /**
   * Mark that a pacing violation occurred
   * This will pause all requests for 10 minutes
   */
  static markPacingViolation(errorCode: number): void {
    if (errorCode === 162 || errorCode === 420) {
      Logger.warn(`⚠️ Pacing violation or data farm issue detected (code ${errorCode}). Pausing requests for 10 minutes...`);
      this.isPacingViolation = true;
      this.pacingViolationUntil = Date.now() + 10 * 60 * 1000; // Pause for 10 minutes
    }
  }

  /**
   * Check if we can make a historical data request
   * Throws an error if we're in cooldown or rate limited
   */
  static async checkHistoricalDataRequest(): Promise<void> {
    // Check if we're in a pacing violation cooldown period
    if (this.isPacingViolation && Date.now() < this.pacingViolationUntil) {
      const remainingMinutes = Math.ceil((this.pacingViolationUntil - Date.now()) / 1000 / 60);
      Logger.warn(`⏸️ Still in pacing violation cooldown. ${remainingMinutes} minutes remaining.`);
      throw new Error(`Pacing violation cooldown active. Wait ${remainingMinutes} more minutes.`);
    }

    // Reset pacing violation flag if cooldown period has passed
    if (this.isPacingViolation && Date.now() >= this.pacingViolationUntil) {
      Logger.info('✅ Pacing violation cooldown period ended. Resuming requests.');
      this.isPacingViolation = false;
      this.historicalDataRequestCount = 0;
      this.historicalDataRequestWindow = Date.now();
    }

    // Reset counter if 10 minutes have passed
    const now = Date.now();
    if (now - this.historicalDataRequestWindow > 10 * 60 * 1000) {
      this.historicalDataRequestCount = 0;
      this.historicalDataRequestWindow = now;
      Logger.debug('🔄 Reset historical data request counter (10-minute window)');
    }

    // Check if we've exceeded the rate limit
    if (this.historicalDataRequestCount >= this.MAX_REQUESTS_PER_10MIN) {
      const waitTime = 10 * 60 * 1000 - (now - this.historicalDataRequestWindow);
      const waitMinutes = Math.ceil(waitTime / 1000 / 60);
      Logger.warn(`⏸️ Historical data request limit reached (${this.MAX_REQUESTS_PER_10MIN} per 10 min). Waiting ${waitMinutes} minutes...`);
      throw new Error(`Rate limit reached. Wait ${waitMinutes} minutes before refreshing.`);
    }

    // Enforce minimum delay between requests
    const timeSinceLastRequest = now - this.lastHistoricalDataRequest;
    if (timeSinceLastRequest < this.MIN_REQUEST_DELAY) {
      const delay = this.MIN_REQUEST_DELAY - timeSinceLastRequest;
      Logger.debug(`⏱️ Throttling: waiting ${delay}ms before next historical data request`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }

    // Update tracking
    this.lastHistoricalDataRequest = Date.now();
    this.historicalDataRequestCount++;
    Logger.debug(`📊 Historical data request ${this.historicalDataRequestCount}/${this.MAX_REQUESTS_PER_10MIN} in current window`);
  }

  /**
   * Reset all throttling state (useful for testing or manual resets)
   */
  static reset(): void {
    this.lastHistoricalDataRequest = 0;
    this.historicalDataRequestCount = 0;
    this.historicalDataRequestWindow = Date.now();
    this.isPacingViolation = false;
    this.pacingViolationUntil = 0;
    Logger.info('🔄 Request throttler reset');
  }

  /**
   * Get current throttling status
   */
  static getStatus(): {
    requestCount: number;
    maxRequests: number;
    isPacingViolation: boolean;
    cooldownMinutesRemaining: number;
  } {
    const cooldownMinutesRemaining = this.isPacingViolation
      ? Math.max(0, Math.ceil((this.pacingViolationUntil - Date.now()) / 1000 / 60))
      : 0;

    return {
      requestCount: this.historicalDataRequestCount,
      maxRequests: this.MAX_REQUESTS_PER_10MIN,
      isPacingViolation: this.isPacingViolation,
      cooldownMinutesRemaining
    };
  }
}
