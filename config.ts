export type AIProvider = "disabled" | "openai-compatible" | "gemini" | "ollama";

export interface AppConfig {
  name: string;
  prefixes: string[];
  owners: string[];
  sudoUsers: string[];
  timezone: string;
  language: string;
  accessMode: "public" | "private" | "self";
  databasePath: string;
  authDirectory: string;
  logLevel: string;
  ai: {
    provider: AIProvider;
    model: string;
    endpoint: string;
    apiKey?: string;
    temperature: number;
    maxTokens: number;
    systemPrompt: string;
    memoryEnabled: boolean;
  };
  media: { maxBytes: number; maxVideoSeconds: number; ffmpegPath: string; ffprobePath: string };
}

const list = (raw: string | undefined, fallback = ""): string[] =>
  (raw ?? fallback)
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

const boundedNumber = (
  raw: string | undefined,
  fallback: number,
  min: number,
  max: number,
): number => {
  const parsed = raw === undefined || raw === "" ? fallback : Number(raw);
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) {
    throw new Error(`Invalid numeric configuration value: ${raw}`);
  }
  return parsed;
};

const boolean = (raw: string | undefined, fallback = false): boolean => {
  if (raw === undefined || raw === "") return fallback;
  if (["1", "true", "yes", "on"].includes(raw.toLowerCase())) return true;
  if (["0", "false", "no", "off"].includes(raw.toLowerCase())) return false;
  throw new Error(`Invalid boolean configuration value: ${raw}`);
};

const normalizePhone = (value: string): string => {
  if (!/^\+?[0-9().\s-]+$/.test(value)) return "";
  const digits = value.replace(/\D/g, "");
  return digits.length >= 6 && digits.length <= 15 ? digits : "";
};

function phoneNumbers(raw: string | undefined, key: string, required: boolean): string[] {
  const values = list(raw).map(normalizePhone).filter(Boolean);
  if (required && !values.length) {
    throw new Error(`${key} must contain at least one international phone number.`);
  }
  return [...new Set(values)];
}

export function loadConfig(env: Record<string, string | undefined>): AppConfig {
  const owners = phoneNumbers(env.KITEFRAME_OWNER_NUMBERS, "KITEFRAME_OWNER_NUMBERS", true);
  const sudoUsers = phoneNumbers(env.KITEFRAME_SUDO_NUMBERS, "KITEFRAME_SUDO_NUMBERS", false);
  const provider = (env.KITEFRAME_AI_PROVIDER ?? "disabled").trim().toLowerCase() as AIProvider;
  if (!["disabled", "openai-compatible", "gemini", "ollama"].includes(provider)) {
    throw new Error(
      "KITEFRAME_AI_PROVIDER must be disabled, openai-compatible, gemini, or ollama.",
    );
  }
  const logLevel = env.KITEFRAME_LOG_LEVEL?.trim().toLowerCase() || "info";
  if (!["fatal", "error", "warn", "info", "debug", "trace", "silent"].includes(logLevel)) {
    throw new Error(
      "KITEFRAME_LOG_LEVEL must be fatal, error, warn, info, debug, trace, or silent.",
    );
  }
  const accessMode = (env.KITEFRAME_ACCESS_MODE ?? "public").trim().toLowerCase();
  if (!["public", "private", "self"].includes(accessMode)) {
    throw new Error("KITEFRAME_ACCESS_MODE must be public, private, or self.");
  }
  const timezone = env.KITEFRAME_TIMEZONE?.trim() || "UTC";
  try {
    new Intl.DateTimeFormat("en", { timeZone: timezone });
  } catch {
    throw new Error(`KITEFRAME_TIMEZONE is not a valid IANA timezone: ${timezone}`);
  }
  const prefixes = list(env.KITEFRAME_PREFIXES, "/");
  if (!prefixes.length || prefixes.some((prefix) => !/^[!#$%&*+./?~-]{1,4}$/.test(prefix))) {
    throw new Error(
      "KITEFRAME_PREFIXES must be one or more safe punctuation prefixes (1–4 characters each).",
    );
  }
  const endpointDefault =
    provider === "ollama"
      ? "http://127.0.0.1:11434/v1"
      : provider === "gemini"
        ? "https://generativelanguage.googleapis.com/v1beta"
        : "https://api.openai.com/v1";
  const endpoint = env.KITEFRAME_AI_ENDPOINT?.trim() || endpointDefault;
  let endpointUrl: URL;
  try {
    endpointUrl = new URL(endpoint);
  } catch {
    throw new Error("KITEFRAME_AI_ENDPOINT must be an absolute HTTP(S) URL.");
  }
  if (
    !["http:", "https:"].includes(endpointUrl.protocol) ||
    endpointUrl.username ||
    endpointUrl.password ||
    endpointUrl.search ||
    endpointUrl.hash
  ) {
    throw new Error("KITEFRAME_AI_ENDPOINT must use HTTP(S) and cannot embed credentials.");
  }
  const isLoopback = ["localhost", "127.0.0.1", "::1"].includes(endpointUrl.hostname);
  if (endpointUrl.protocol === "http:" && (provider !== "ollama" || !isLoopback)) {
    throw new Error(
      "Use HTTPS for remote AI endpoints; plain HTTP is permitted only for local Ollama.",
    );
  }
  return {
    name: (env.KITEFRAME_NAME?.trim() || "Kiteframe").slice(0, 80),
    prefixes,
    owners,
    sudoUsers,
    timezone,
    language: env.KITEFRAME_LANGUAGE?.trim() || "en",
    accessMode: accessMode as AppConfig["accessMode"],
    databasePath: env.KITEFRAME_DATABASE_PATH?.trim() || "./data/kiteframe.sqlite",
    authDirectory: env.KITEFRAME_AUTH_DIR?.trim() || "./auth",
    logLevel,
    ai: {
      provider,
      model:
        env.KITEFRAME_AI_MODEL?.trim() ||
        (provider === "gemini"
          ? "gemini-2.5-flash"
          : provider === "ollama"
            ? "llama3.2"
            : "gpt-4o-mini"),
      endpoint: endpointUrl.toString().replace(/\/$/, ""),
      ...(env.KITEFRAME_AI_API_KEY ? { apiKey: env.KITEFRAME_AI_API_KEY } : {}),
      temperature: boundedNumber(env.KITEFRAME_AI_TEMPERATURE, 0.7, 0, 2),
      maxTokens: boundedNumber(env.KITEFRAME_AI_MAX_TOKENS, 700, 1, 16_000),
      systemPrompt: (
        env.KITEFRAME_AI_SYSTEM_PROMPT?.trim() ||
        "You are a helpful, concise assistant. Respect privacy and do not claim actions you have not taken."
      ).slice(0, 4_000),
      memoryEnabled: boolean(env.KITEFRAME_AI_MEMORY, false),
    },
    media: {
      maxBytes: boundedNumber(
        env.KITEFRAME_MEDIA_MAX_BYTES,
        8 * 1024 * 1024,
        1024,
        50 * 1024 * 1024,
      ),
      maxVideoSeconds: boundedNumber(env.KITEFRAME_MEDIA_MAX_VIDEO_SECONDS, 8, 1, 30),
      ffmpegPath: env.KITEFRAME_FFMPEG_PATH?.trim() || "ffmpeg",
      ffprobePath: env.KITEFRAME_FFPROBE_PATH?.trim() || "ffprobe",
    },
  };
}
