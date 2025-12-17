export enum LogLevel {
  ERROR = 'ERROR',
  WARN = 'WARN',
  INFO = 'INFO',
  DEBUG = 'DEBUG'
}

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  userId?: number;
  ip?: string;
  endpoint?: string;
  method?: string;
  statusCode?: number;
  duration?: number;
  error?: any;
  metadata?: any;
}

class Logger {
  private static instance: Logger;
  private logLevel: LogLevel = LogLevel.INFO;

  private constructor() {}

  public static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  public setLogLevel(level: LogLevel): void {
    this.logLevel = level;
  }

  private shouldLog(level: LogLevel): boolean {
    const levels = [LogLevel.ERROR, LogLevel.WARN, LogLevel.INFO, LogLevel.DEBUG];
    const currentLevelIndex = levels.indexOf(this.logLevel);
    const messageLevelIndex = levels.indexOf(level);
    return messageLevelIndex <= currentLevelIndex;
  }

  private formatLog(entry: LogEntry): string {
    const logObject = {
      timestamp: entry.timestamp,
      level: entry.level,
      message: entry.message,
      ...(entry.userId && { userId: entry.userId }),
      ...(entry.ip && { ip: entry.ip }),
      ...(entry.endpoint && { endpoint: entry.endpoint }),
      ...(entry.method && { method: entry.method }),
      ...(entry.statusCode && { statusCode: entry.statusCode }),
      ...(entry.duration && { duration: entry.duration }),
      ...(entry.error && { error: entry.error }),
      ...(entry.metadata && { metadata: entry.metadata })
    };

    return JSON.stringify(logObject);
  }

  private writeLog(entry: LogEntry): void {
    if (!this.shouldLog(entry.level)) {
      return;
    }

    const formattedLog = this.formatLog(entry);
    
    // Em desenvolvimento, usar console com cores
    if (process.env.NODE_ENV === 'development') {
      switch (entry.level) {
        case LogLevel.ERROR:
          console.error(`🔴 ${formattedLog}`);
          break;
        case LogLevel.WARN:
          console.warn(`🟡 ${formattedLog}`);
          break;
        case LogLevel.INFO:
          console.info(`🔵 ${formattedLog}`);
          break;
        case LogLevel.DEBUG:
          console.debug(`⚪ ${formattedLog}`);
          break;
      }
    } else {
      // Em produção, enviar para sistema de logs ou arquivo
      console.log(formattedLog);
    }
  }

  public error(message: string, error?: any, metadata?: any): void {
    this.writeLog({
      timestamp: new Date().toISOString(),
      level: LogLevel.ERROR,
      message,
      error,
      metadata
    });
  }

  public warn(message: string, metadata?: any): void {
    this.writeLog({
      timestamp: new Date().toISOString(),
      level: LogLevel.WARN,
      message,
      metadata
    });
  }

  public info(message: string, metadata?: any): void {
    this.writeLog({
      timestamp: new Date().toISOString(),
      level: LogLevel.INFO,
      message,
      metadata
    });
  }

  public debug(message: string, metadata?: any): void {
    this.writeLog({
      timestamp: new Date().toISOString(),
      level: LogLevel.DEBUG,
      message,
      metadata
    });
  }

  public audit(action: string, userId: number, metadata?: any): void {
    this.writeLog({
      timestamp: new Date().toISOString(),
      level: LogLevel.INFO,
      message: `AUDIT: ${action}`,
      userId,
      metadata
    });
  }

  public security(message: string, ip?: string, metadata?: any): void {
    this.writeLog({
      timestamp: new Date().toISOString(),
      level: LogLevel.WARN,
      message: `SECURITY: ${message}`,
      ip,
      metadata
    });
  }

  public performance(endpoint: string, method: string, duration: number, statusCode?: number): void {
    this.writeLog({
      timestamp: new Date().toISOString(),
      level: LogLevel.DEBUG,
      message: 'Performance metric',
      endpoint,
      method,
      duration,
      statusCode
    });
  }
}

// Exportar instância única
export const logger = Logger.getInstance();

// Configurar nível de log baseado em variável de ambiente
if (process.env.LOG_LEVEL) {
  logger.setLogLevel(process.env.LOG_LEVEL as LogLevel);
} else {
  logger.setLogLevel(process.env.NODE_ENV === 'production' ? LogLevel.INFO : LogLevel.DEBUG);
}