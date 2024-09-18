// See `logger` object at bottom for usage examples.

import { captureMessage } from "@sentry/nextjs";

import { env } from "@/app/envFrontend";

const logLevels = Object.freeze(["debug", "info", "warn", "error"] as const);
type LogLevel = (typeof logLevels)[number];

type LogMessage = {
  level?: LogLevel;
  message: string;
  optionalParams?: any[];
  service?: string;
};

type Filter = {
  level?: LogLevel;
  service?: {
    include?: string[];
    exclude?: string[];
  };
};

/**
 * First log level is greater than or equal to the second.
 */
function gte(a: LogLevel, b: LogLevel): boolean {
  return logLevels.indexOf(a) >= logLevels.indexOf(b);
}

class Logger {
  private service: string | undefined;
  private static consoleFilter: Filter = {};

  constructor(service?: string) {
    this.service = service;
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
    logMessage = {
      ...logMessage,
      service: logMessage.service || this.service,
    };

    const level = logMessage.level || "info";

    // Log to console
    const gteLevel = Logger.consoleFilter.level ? gte(level, Logger.consoleFilter.level) : true;

    const serviceInclude = Logger.consoleFilter.service?.include || [];
    const serviceExclude = Logger.consoleFilter.service?.exclude || [];

    const serviceIncludeMatch =
      serviceInclude.length > 0 && logMessage.service ? serviceInclude.includes(logMessage.service) : true;
    const serviceExcludeMatch =
      serviceExclude.length > 0 && logMessage.service ? !serviceExclude.includes(logMessage.service) : true;

    if (gteLevel && serviceIncludeMatch && serviceExcludeMatch) {
      switch (level) {
        case "debug":
          console.debug(...this.consoleFormatter(logMessage));
          break;
        case "info":
          console.info(...this.consoleFormatter(logMessage));
          break;
        case "warn":
          console.warn(...this.consoleFormatter(logMessage));
          break;
        case "error":
          console.error(...this.consoleFormatter(logMessage));
          break;
        default:
          level satisfies never;
      }
    }

    // Log to sentry
    if (logMessage.level === "error") {
      captureMessage(logMessage.message, {
        level: logMessage.level,
        extra: {
          ...logMessage.optionalParams,
          service: logMessage.service,
        },
      });
    }
  }

  private consoleFormatter(logMessage: LogMessage): [string, ...any[]] {
    const message = logMessage.service ? `${logMessage.service}: ${logMessage.message}` : logMessage.message;
    const optionalParams = logMessage.optionalParams || [];
    return [message, ...optionalParams];
  }

  child({ service }: { service?: string }): Logger {
    return new Logger(service || this.service);
  }

  setGlobalConsoleFilter(filter: Filter): void {
    Logger.consoleFilter = filter;
  }

  getGlobalConsoleFilter(): Filter {
    return { ...Logger.consoleFilter };
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
 */
const logger = new Logger();

logger.setGlobalConsoleFilter({
  service: {
    exclude: env.logServiceExclude,
    include: env.logServiceInclude,
  },
});

export default logger;
