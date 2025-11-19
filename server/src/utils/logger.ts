export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3
}

class Logger {
  private static _logLevel: LogLevel | null = null;
  private static _initialized = false;

  private static get logLevel(): LogLevel {
    if (this._logLevel === null) {
      this._logLevel = this.parseLogLevel(process.env.LOG_LEVEL);
      if (!this._initialized) {
        console.log(`[LOGGER] Log level set to: ${LogLevel[this._logLevel]} (${this._logLevel}) from env: ${process.env.LOG_LEVEL || 'undefined'}`);
        this._initialized = true;
      }
    }
    return this._logLevel;
  }

  private static parseLogLevel(level?: string): LogLevel {
    if (!level) {
      return LogLevel.INFO;
    }

    // Try to parse as string first (e.g., "info", "debug", "warn", "error")
    const levelUpper = level.toUpperCase();
    if (levelUpper in LogLevel && typeof LogLevel[levelUpper as keyof typeof LogLevel] === 'number') {
      return LogLevel[levelUpper as keyof typeof LogLevel] as LogLevel;
    }

    // Try to parse as number (e.g., "0", "1", "2", "3")
    const numLevel = parseInt(level);
    if (!isNaN(numLevel) && numLevel >= 0 && numLevel <= 3) {
      return numLevel as LogLevel;
    }

    // Default to INFO if invalid
    return LogLevel.INFO;
  }

  static setLogLevel(level: LogLevel): void {
    this._logLevel = level;
  }

  static debug(message: string, ...args: any[]): void {
    if (this.logLevel <= LogLevel.DEBUG) {
      console.log(`[DEBUG] ${message}`, ...args);
    }
  }

  static info(message: string, ...args: any[]): void {
    if (this.logLevel <= LogLevel.INFO) {
      console.log(`[INFO] ${message}`, ...args);
    }
  }

  static warn(message: string, ...args: any[]): void {
    if (this.logLevel <= LogLevel.WARN) {
      console.warn(`[WARN] ${message}`, ...args);
    }
  }

  static error(message: string, ...args: any[]): void {
    if (this.logLevel <= LogLevel.ERROR) {
      console.error(`[ERROR] ${message}`, ...args);
    }
  }
}

export { Logger };