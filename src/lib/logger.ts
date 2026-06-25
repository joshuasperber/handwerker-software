type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogContext {
  tenantId?: string;
  userId?: string;
  route?: string;
  job?: string;
  durationMs?: number;
  [key: string]: string | number | boolean | undefined | null;
}

function serialize(level: LogLevel, message: string, context?: LogContext) {
  const entry = {
    ts: new Date().toISOString(),
    level,
    msg: message,
    ...context,
  };
  if (process.env.NODE_ENV === "production") {
    return JSON.stringify(entry);
  }
  return entry;
}

function write(level: LogLevel, message: string, context?: LogContext) {
  const out = serialize(level, message, context);
  const line = typeof out === "string" ? out : `[${out.level}] ${out.msg}`;
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export const logger = {
  debug(message: string, context?: LogContext) {
    if (process.env.NODE_ENV !== "production") write("debug", message, context);
  },
  info(message: string, context?: LogContext) {
    write("info", message, context);
  },
  warn(message: string, context?: LogContext) {
    write("warn", message, context);
  },
  error(message: string, context?: LogContext, err?: unknown) {
    const extra: LogContext = { ...context };
    if (err instanceof Error) {
      extra.error = err.message;
      extra.stack = err.stack?.slice(0, 500);
    } else if (err != null) {
      extra.error = String(err);
    }
    write("error", message, extra);
    if (process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN) {
      void import("@sentry/nextjs")
        .then((Sentry) => {
          if (err instanceof Error) Sentry.captureException(err, { extra: context });
          else Sentry.captureMessage(message, { level: "error", extra: { ...context, err: String(err) } });
        })
        .catch(() => undefined);
    }
  },
};
