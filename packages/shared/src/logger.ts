type LogLevel = "debug" | "info" | "warn" | "error";

type LogContext = {
  component?: string;
  spaceId?: string;
  tenantId?: string;
  requestId?: string;
  [key: string]: unknown;
};

type LogData = Record<string, unknown>;

interface Logger {
  debug(message: string, data?: LogData): void;
  info(message: string, data?: LogData): void;
  warn(message: string, data?: LogData): void;
  error(message: string, data?: LogData): void;
}

const isProduction = () => process.env.NODE_ENV === "production";
const isDebugEnabled = () => process.env.LOG_LEVEL === "debug";

function emit(level: LogLevel, context: LogContext, message: string, data?: LogData) {
  if (level === "debug" && isProduction() && !isDebugEnabled()) return;

  if (isProduction()) {
    const entry: Record<string, unknown> = {
      level,
      message,
      timestamp: new Date().toISOString(),
    };
    if (Object.keys(context).length > 0) entry.context = context;
    if (data && Object.keys(data).length > 0) entry.data = data;
    console[level](JSON.stringify(entry));
  } else {
    const prefix = context.component ? `${context.component}: ` : "";
    const suffix = data && Object.keys(data).length > 0 ? ` ${JSON.stringify(data)}` : "";
    console[level](`[${level.toUpperCase()}] ${prefix}${message}${suffix}`);
  }
}

function makeLogger(context: LogContext): Logger {
  return {
    debug: (message, data) => emit("debug", context, message, data),
    info: (message, data) => emit("info", context, message, data),
    warn: (message, data) => emit("warn", context, message, data),
    error: (message, data) => emit("error", context, message, data),
  };
}

/** Standalone logger — pass context per call via data parameter */
export const log: Logger = makeLogger({});

/** Create a logger with pre-bound context (component, spaceId, etc.) */
export function createLogger(context: LogContext): Logger {
  return makeLogger(context);
}

export type { LogContext, LogLevel, Logger };
