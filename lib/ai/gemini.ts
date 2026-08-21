// ---------------------------------------------------------------------------
// OSmini centralized Gemini service.
//
// - All Gemini calls go through generateAI(). No other module calls Google.
// - API keys live exclusively in server-side environment variables
//   (GEMINI_API_KEY_1..3) and are never logged or exposed to the browser.
// - Credential failover exists for REDUNDANCY between Google AI projects the
//   operator legitimately controls. It must not be used to bypass Google's
//   quotas or limits: only transient errors (rate limit, server, network,
//   model unavailable) trigger failover, with strict retry caps, timeouts,
//   and per-credential cooldowns.
// ---------------------------------------------------------------------------

export type AiErrorType =
  | "auth"
  | "invalid_request"
  | "rate_limit"
  | "quota"
  | "model_unavailable"
  | "server"
  | "network"
  | "timeout";

export class GeminiError extends Error {
  constructor(
    message: string,
    public errorType: AiErrorType,
    public credentialIdentifier: string
  ) {
    super(message);
    this.name = "GeminiError";
  }
}

export interface GenerateOptions {
  model?: "fast" | "reasoning" | "summary";
  json?: boolean;
  maxOutputTokens?: number;
}

export interface GenerateResult {
  text: string;
  model: string;
  credentialIdentifier: string;
  durationMs: number;
  promptTokens: number | null;
  completionTokens: number | null;
}

interface Credential {
  identifier: string;
  envVar: string;
}

// Non-sensitive identifiers — never the raw key.
const CREDENTIALS: Credential[] = [
  { identifier: "gemini-primary", envVar: "GEMINI_API_KEY_1" },
  { identifier: "gemini-secondary", envVar: "GEMINI_API_KEY_2" },
  { identifier: "gemini-tertiary", envVar: "GEMINI_API_KEY_3" },
];

interface CredentialHealth {
  status: "healthy" | "degraded" | "cooldown";
  failureCount: number;
  lastUsedAt: number | null;
  lastErrorAt: number | null;
  disabledUntil: number | null;
}

// In-memory health tracking. On serverless platforms this resets between
// instances — acceptable: the per-request failover path is what guarantees
// reliability, and cooldowns are a best-effort optimization.
const health = new Map<string, CredentialHealth>();

function getHealth(id: string): CredentialHealth {
  let h = health.get(id);
  if (!h) {
    h = { status: "healthy", failureCount: 0, lastUsedAt: null, lastErrorAt: null, disabledUntil: null };
    health.set(id, h);
  }
  return h;
}

const COOLDOWN_MS: Record<AiErrorType, number> = {
  rate_limit: 5 * 60_000,
  quota: 5 * 60_000,
  model_unavailable: 2 * 60_000,
  server: 60_000,
  network: 60_000,
  timeout: 60_000,
  auth: 30 * 60_000,
  invalid_request: 0, // never retried, never cooled down
};

// Errors worth trying another credential for.
const FAILOVER_ERRORS: AiErrorType[] = [
  "rate_limit",
  "quota",
  "model_unavailable",
  "server",
  "network",
  "timeout",
  "auth",
];

function recordFailure(id: string, type: AiErrorType) {
  const h = getHealth(id);
  h.failureCount++;
  h.lastErrorAt = Date.now();
  const cooldown = COOLDOWN_MS[type];
  if (cooldown > 0) {
    h.disabledUntil = Date.now() + cooldown;
    h.status = "cooldown";
  } else {
    h.status = "degraded";
  }
}

function recordSuccess(id: string) {
  const h = getHealth(id);
  h.status = "healthy";
  h.failureCount = 0;
  h.lastUsedAt = Date.now();
  h.disabledUntil = null;
}

// Snapshot for observability (never includes keys).
export function credentialHealthSnapshot() {
  return CREDENTIALS.filter((c) => process.env[c.envVar]).map((c) => {
    const h = getHealth(c.identifier);
    return {
      credential_identifier: c.identifier,
      status: h.disabledUntil && h.disabledUntil > Date.now() ? "cooldown" : h.status,
      last_used_at: h.lastUsedAt ? new Date(h.lastUsedAt).toISOString() : null,
      last_error_at: h.lastErrorAt ? new Date(h.lastErrorAt).toISOString() : null,
      temporary_disabled_until: h.disabledUntil ? new Date(h.disabledUntil).toISOString() : null,
      failure_count: h.failureCount,
    };
  });
}

export function aiAvailable(): boolean {
  return CREDENTIALS.some((c) => Boolean(process.env[c.envVar]));
}

function classifyError(status: number | null, err: unknown): AiErrorType {
  if (status === null) {
    if (err instanceof Error && err.name === "TimeoutError") return "timeout";
    return "network";
  }
  if (status === 400) return "invalid_request";
  if (status === 401 || status === 403) return "auth";
  if (status === 404) return "model_unavailable";
  if (status === 429) return "rate_limit";
  if (status >= 500) return "server";
  return "invalid_request";
}

function modelFor(kind: GenerateOptions["model"]): string {
  const env = process.env;
  switch (kind) {
    case "reasoning":
      return env.AI_MODEL_REASONING || "gemini-2.0-flash";
    case "summary":
      return env.AI_MODEL_SUMMARY || "gemini-2.0-flash";
    default:
      return env.AI_MODEL_FAST || "gemini-2.0-flash";
  }
}

const MAX_INPUT_CHARS = Number(process.env.AI_MAX_INPUT_CHARS ?? 12000);

async function callGemini(
  credential: Credential,
  apiKey: string,
  model: string,
  prompt: string,
  options: GenerateOptions
): Promise<GenerateResult> {
  const timeoutMs = Number(process.env.AI_REQUEST_TIMEOUT_MS ?? 30000);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new DOMException("timeout", "TimeoutError")), timeoutMs);
  const started = Date.now();

  try {
    const url =
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent` +
      `?key=${encodeURIComponent(apiKey)}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          maxOutputTokens: options.maxOutputTokens ?? Number(process.env.AI_MAX_OUTPUT_TOKENS ?? 2048),
          ...(options.json ? { responseMimeType: "application/json" } : {}),
        },
      }),
    });

    const durationMs = Date.now() - started;
    const body = await res.json().catch(() => null);

    if (!res.ok) {
      const type = classifyError(res.status, null);
      const msg = (body?.error?.message as string | undefined) ?? `HTTP ${res.status}`;
      // Quota exhaustion is reported as 429 with a quota message.
      const finalType = type === "rate_limit" && /quota/i.test(msg) ? "quota" : type;
      throw new GeminiError(`Gemini request failed: ${msg}`, finalType, credential.identifier);
    }

    const text: string =
      body?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? "").join("") ?? "";
    if (!text) {
      throw new GeminiError("Gemini returned an empty response", "server", credential.identifier);
    }

    recordSuccess(credential.identifier);
    return {
      text,
      model,
      credentialIdentifier: credential.identifier,
      durationMs,
      promptTokens: body?.usageMetadata?.promptTokenCount ?? null,
      completionTokens: body?.usageMetadata?.candidatesTokenCount ?? null,
    };
  } catch (err) {
    if (err instanceof GeminiError) {
      recordFailure(credential.identifier, err.errorType);
      throw err;
    }
    const type = classifyError(null, err);
    recordFailure(credential.identifier, type);
    throw new GeminiError(
      type === "timeout" ? "Gemini request timed out" : "Gemini network error",
      type,
      credential.identifier
    );
  } finally {
    clearTimeout(timer);
  }
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

// The single entry point used by the whole application.
export async function generateAI(prompt: string, options: GenerateOptions = {}): Promise<GenerateResult> {
  if (prompt.length > MAX_INPUT_CHARS) {
    prompt = prompt.slice(0, MAX_INPUT_CHARS) + "\n[truncated]";
  }

  const maxRetries = Number(process.env.AI_MAX_RETRIES ?? 2);
  const model = modelFor(options.model);

  const available = CREDENTIALS.filter((c) => Boolean(process.env[c.envVar]));
  if (available.length === 0) {
    throw new GeminiError("AI is not configured on this deployment", "auth", "none");
  }

  let lastError: GeminiError | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    // Select the healthiest credential not in cooldown.
    const now = Date.now();
    const candidate = available
      .filter((c) => {
        const h = getHealth(c.identifier);
        return !h.disabledUntil || h.disabledUntil <= now;
      })
      .sort((a, b) => getHealth(a.identifier).failureCount - getHealth(b.identifier).failureCount)[0];

    if (!candidate) break; // everything is cooling down

    try {
      return await callGemini(candidate, process.env[candidate.envVar]!, model, prompt, options);
    } catch (err) {
      if (!(err instanceof GeminiError)) throw err;
      lastError = err;
      if (!FAILOVER_ERRORS.includes(err.errorType)) throw err; // e.g. invalid_request
      // Exponential backoff before trying another credential.
      await sleep(Math.min(250 * 2 ** attempt, 2000));
    }
  }

  throw lastError ?? new GeminiError("No Gemini credentials available", "auth", "none");
}
