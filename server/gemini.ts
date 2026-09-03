import { GoogleGenAI } from "@google/genai";

// Resilient Model Fallback Ladder ordered by latency and availability as per directive
export const BASE_MODEL_LADDER = [
  "gemini-3.6-flash",
  "gemini-3.1-flash-lite",
  "gemini-flash-latest",
  "gemini-3.7-flash"
];

let aiClient: GoogleGenAI | null = null;

// Track temporarily degraded models (e.g., experiencing 503 UNAVAILABLE or 429 RESOURCE_EXHAUSTED)
const modelCooldowns = new Map<string, number>();

export function getGeminiClient(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY environment variable is required");
    }
    aiClient = new GoogleGenAI({ apiKey });
  }
  return aiClient;
}

/**
 * Parses any error from @google/genai SDK (which may be a JSON string message)
 * and determines whether it matches the recoverable error matrix:
 * 503 UNAVAILABLE, 429 RESOURCE_EXHAUSTED, 404 NOT_FOUND, 500 INTERNAL, timeouts.
 */
function inspectGeminiError(err: any): { code?: number; status?: string; isRecoverable: boolean } {
  let code = err?.status || err?.statusCode || err?.code;
  let status = err?.statusText || err?.status;
  const msg = err?.message || String(err);

  try {
    if (typeof msg === "string" && msg.trim().startsWith("{")) {
      const parsed = JSON.parse(msg.trim());
      if (parsed.error) {
        code = parsed.error.code || code;
        status = parsed.error.status || status;
      }
    }
  } catch {
    // Ignore JSON parse failure
  }

  const msgLower = typeof msg === "string" ? msg.toLowerCase() : "";
  const codeNum = Number(code);

  const isRecoverable =
    [404, 429, 500, 502, 503, 504].includes(codeNum) ||
    status === "UNAVAILABLE" ||
    status === "RESOURCE_EXHAUSTED" ||
    status === "NOT_FOUND" ||
    status === "INTERNAL" ||
    status === "DEADLINE_EXCEEDED" ||
    msgLower.includes("unavailable") ||
    msgLower.includes("high demand") ||
    msgLower.includes("resource_exhausted") ||
    msgLower.includes("quota") ||
    msgLower.includes("overloaded") ||
    msgLower.includes("not found") ||
    msgLower.includes("timeout") ||
    msgLower.includes("timed out") ||
    msgLower.includes("deadline");

  return { code: codeNum || undefined, status: String(status || ""), isRecoverable };
}

/**
 * Returns the fallback ladder ordered by health:
 * Models currently in cooldown due to high demand (503/429) are pushed to the end.
 */
function getActiveModelLadder(): string[] {
  const now = Date.now();
  const healthy: string[] = [];
  const coolingDown: string[] = [];

  for (const model of BASE_MODEL_LADDER) {
    const cooldownUntil = modelCooldowns.get(model) || 0;
    if (cooldownUntil > now) {
      coolingDown.push(model);
    } else {
      healthy.push(model);
    }
  }

  return [...healthy, ...coolingDown];
}

/**
 * Wraps a promise with a timeout in milliseconds.
 */
function withTimeout<T>(promise: Promise<T>, timeoutMs: number, timeoutMsg: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(timeoutMsg));
    }, timeoutMs);

    promise
      .then((res) => {
        clearTimeout(timer);
        resolve(res);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

export async function generateContentWithFallback(
  options: {
    contents: any;
    systemInstruction?: string;
    responseMimeType?: string;
    responseSchema?: any;
  }
): Promise<{ text: string; usedModel: string }> {
  const client = getGeminiClient();
  const candidateLadder = getActiveModelLadder();
  let lastError: any = null;

  for (const model of candidateLadder) {
    try {
      console.log(`[Gemini Engine] Requesting reflection generation via model: ${model}`);
      const config: any = {};
      if (options.systemInstruction) {
        config.systemInstruction = options.systemInstruction;
      }
      if (options.responseMimeType) {
        config.responseMimeType = options.responseMimeType;
      }
      if (options.responseSchema) {
        config.responseSchema = options.responseSchema;
      }

      // Per-model attempt timeout (16 seconds) to prevent hanging when models suffer high-demand latency
      const response = await withTimeout(
        client.models.generateContent({
          model,
          contents: options.contents,
          config
        }),
        16000,
        `Model ${model} timed out after 16 seconds`
      );

      const text = response.text || "";
      if (text) {
        // Clear cooldown if model succeeded
        modelCooldowns.delete(model);
        console.log(`[Gemini Engine] Reflection successfully generated using ${model}`);
        return { text, usedModel: model };
      }
    } catch (err: any) {
      lastError = err;
      const errorInfo = inspectGeminiError(err);

      // If high demand (503), quota (429), or timeout, set temporary 60-second cooldown so subsequent requests don't lag
      if (errorInfo.status === "UNAVAILABLE" || errorInfo.code === 503 || errorInfo.code === 429 || err?.message?.includes("timed out")) {
        modelCooldowns.set(model, Date.now() + 60000);
        console.log(`[Gemini Engine] Notice: Model ${model} is experiencing high demand (${errorInfo.status || errorInfo.code || "temporary load"}). Gracefully routing to next fallback in ladder...`);
      } else {
        console.log(`[Gemini Engine] Notice: Model ${model} unavailable (${errorInfo.status || errorInfo.code || "non-critical"}). Continuing fallback ladder...`);
      }
    }
  }

  throw new Error(`All models in fallback ladder failed. Last error: ${lastError?.message || lastError}`);
}
