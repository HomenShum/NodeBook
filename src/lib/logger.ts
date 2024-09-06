// See `logger` object at bottom for usage examples.

const logLevels = Object.freeze(["debug", "info", "warn", "error"] as const);
type LogLevel = (typeof logLevels)[number];

type LogMessage = {
  level?: LogLevel;
  message: string;
  optionalParams?: any[];
  service?: string;
};

type LoggerOptions = {
  level: LogLevel;
  service?: string;
  formatter: (logMessage: LogMessage) => any[];
  transports: Transport[];
};

type GlobalFilter = {
  level: LogLevel;
  service?: string;
};

/**
 * First log level is greater than or equal to the second.
 */
function gte(a: LogLevel, b: LogLevel): boolean {
  return logLevels.indexOf(a) >= logLevels.indexOf(b);
}

/**
 * Global filter object that is applied to all loggers.
 */
const globalLoggerFilter: GlobalFilter = {
  level: process.env.NODE_ENV === "production" ? "info" : process.env.NODE_ENV === "test" ? "error" : "debug",
};
/**
 * Update the global filter object. This will affect all loggers.
 */
export function updateGlobalLoggerFilter(filter: Partial<GlobalFilter>) {
  Object.assign(globalLoggerFilter, filter);
}
/**
 * Returns a copy of the global filter object. To modify the global filter, use {@link updateGlobalLoggerFilter}
 */
export function getGlobalLoggerFilter() {
  return { ...globalLoggerFilter };
}

type Formatter = (logMessage: LogMessage) => any[];

interface Transport {
  log(logMessage: LogMessage): void;
}

class ConsoleTransport implements Transport {
  private formatter: Formatter;
  constructor(formatter: Formatter) {
    this.formatter = formatter;
  }
  log(logMessage: LogMessage) {
    const level = logMessage.level || "info";
    switch (level) {
      case "debug":
        console.debug(...this.formatter(logMessage));
        break;
      case "info":
        console.info(...this.formatter(logMessage));
        break;
      case "warn":
        console.warn(...this.formatter(logMessage));
        break;
      case "error":
        console.error(...this.formatter(logMessage));
        break;
      default:
        level satisfies never;
    }
  }
}

function defaultFormatter(logMessage: LogMessage): [string, ...any[]] {
  const message = logMessage.service ? `${logMessage.service}: ${logMessage.message}` : logMessage.message;
  const optionalParams = logMessage.optionalParams || [];
  return [message, ...optionalParams];
}

class Logger {
  private options: LoggerOptions;

  constructor(options: Partial<LoggerOptions> = {}) {
    const formatter = options.formatter || defaultFormatter;
    this.options = {
      level: "debug",
      formatter,
      transports: [new ConsoleTransport(formatter)],
      ...options,
    };
  }

  debug(message: string, ...optionalParams: any[]): void;
  debug(logObject: LogMessage): void;
  debug(firstParam: string | LogMessage, ...optionalParams: any[]): void {
    if (typeof firstParam === "object") {
      this.log({ ...firstParam, level: "debug" });
    } else {
      this.log({ level: "debug", message: firstParam, optionalParams });
    }
  }

  info(message: string, ...optionalParams: any[]): void;
  info(logObject: LogMessage): void;
  info(firstParam: string | LogMessage, ...optionalParams: any[]): void {
    if (typeof firstParam === "object") {
      this.log({ ...firstParam, level: "info" });
    } else {
      this.log({ level: "info", message: firstParam, optionalParams });
    }
  }

  warn(message: string, ...optionalParams: any[]): void;
  warn(logObject: LogMessage): void;
  warn(firstParam: string | LogMessage, ...optionalParams: any[]): void {
    if (typeof firstParam === "object") {
      this.log({ ...firstParam, level: "warn" });
    } else {
      this.log({ level: "warn", message: firstParam, optionalParams });
    }
  }

  error(message: string, ...optionalParams: any[]): void;
  error(logObject: LogMessage): void;
  error(firstParam: string | LogMessage, ...optionalParams: any[]): void {
    if (typeof firstParam === "object") {
      this.log({ ...firstParam, level: "error" });
    } else {
      this.log({ level: "error", message: firstParam, optionalParams });
    }
  }

  private log(logMessage: LogMessage): void {
    const level = logMessage.level || "info";
    if (gte(level, this.options.level) && gte(level, globalLoggerFilter.level)) {
      logMessage = { ...logMessage, service: this.options.service || logMessage.service, level };
      this.options.transports.forEach((transport) => transport.log(logMessage));
    }
  }

  child(options: Partial<LoggerOptions>): Logger {
    return new Logger({
      ...this.options,
      ...options,
    });
  }
}

/**
 * Global logger object
 *
 * @example
 * // Basic usage
 * logger.info("hello world");
 * logger.info({ message: "hello world" });
 *
 * @example
 * // If a service is specified, it will be prepended to the message
 * logger.info({ service: "myService", message: "hello world" });
 * // Output: "myService: hello world"
 *
 * @example
 * // Create a child logger with a different log level
 * const childLogger = logger.child({ level: "warn" });
 * childLogger.info("This message will not be logged");
 *
 * @example
 * // Update the global filter to only log messages of level "info" and above for all loggers
 * getGlobalLoggerFilter(); // { level: "debug" }
 * logger.debug("This message will be logged");
 * updateGlobalLoggerFilter({ level: "info" });
 * logger.debug("This message will not be logged");
 */
const logger = new Logger();

export default logger;
