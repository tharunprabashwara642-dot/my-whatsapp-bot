import pino from "pino";

const acceptedLevels = ["fatal", "error", "warn", "info", "debug", "trace", "silent"] as const;
const configuredLevel = process.env.KITEFRAME_LOG_LEVEL || "info";
const level = acceptedLevels.includes(configuredLevel as (typeof acceptedLevels)[number])
  ? configuredLevel
  : "info";

export const logger = pino({
  level,
  redact: {
    paths: ["*.apiKey", "*.token", "*.password", "*.authorization", "req.headers.authorization"],
    censor: "[redacted]",
  },
  base: { application: "kiteframe" },
  timestamp: pino.stdTimeFunctions.isoTime,
});
