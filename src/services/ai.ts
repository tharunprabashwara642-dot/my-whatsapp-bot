import type { AppConfig } from "../core/config";
import { WorkLimiter } from "./limiter";

const providerLimiter = new WorkLimiter(3, 12);
const maxProviderResponseBytes = 1_048_576;

async function readLimitedJson(response: Response): Promise<unknown> {
  if (!response.body) throw new Error("AI provider returned no response body.");
  const declaredLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > maxProviderResponseBytes) {
    await response.body.cancel();
    throw new Error("AI provider response exceeded the allowed size.");
  }
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxProviderResponseBytes) {
      await reader.cancel();
      throw new Error("AI provider response exceeded the allowed size.");
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return JSON.parse(new TextDecoder().decode(bytes)) as unknown;
}

export interface AIMessage {
  role: "system" | "user" | "assistant";
  content: string;
}
export interface AIImage {
  mimeType: string;
  base64: string;
}

function endpoint(base: string, suffix: string): string {
  const normalized = base.replace(/\/+$/, "");
  return normalized.endsWith(suffix) ? normalized : `${normalized}${suffix}`;
}

export function completeAI(
  config: AppConfig,
  prompt: string,
  history: AIMessage[] = [],
  image?: AIImage,
): Promise<string> {
  return providerLimiter.run(() => completeAIImpl(config, prompt, history, image));
}

async function completeAIImpl(
  config: AppConfig,
  prompt: string,
  history: AIMessage[],
  image?: AIImage,
): Promise<string> {
  const {
    provider,
    model,
    endpoint: baseUrl,
    apiKey,
    temperature,
    maxTokens,
    systemPrompt,
  } = config.ai;
  if (provider === "disabled")
    throw new Error("AI is disabled. Configure KITEFRAME_AI_PROVIDER to enable it.");
  if (provider !== "ollama" && !apiKey)
    throw new Error("The selected AI provider needs an API key in the environment.");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 45_000);
  try {
    if (provider === "gemini") {
      const contents = [
        ...history.filter((entry) => entry.role !== "system"),
        { role: "user" as const, content: prompt },
      ];
      const response = await fetch(
        `${baseUrl.replace(/\/+$/, "")}/models/${encodeURIComponent(model)}:generateContent`,
        {
          method: "POST",
          signal: controller.signal,
          headers: { "content-type": "application/json", "x-goog-api-key": apiKey ?? "" },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: systemPrompt }] },
            contents: contents.map((entry, index) => ({
              role: entry.role === "assistant" ? "model" : "user",
              parts: [
                ...(index === contents.length - 1 && image
                  ? [{ inlineData: { mimeType: image.mimeType, data: image.base64 } }]
                  : []),
                { text: entry.content },
              ],
            })),
            generationConfig: { temperature, maxOutputTokens: maxTokens },
          }),
        },
      );
      if (!response.ok) throw new Error(`AI provider returned HTTP ${response.status}.`);
      const data = (await readLimitedJson(response)) as {
        candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      };
      const text = data.candidates?.[0]?.content?.parts
        ?.map((part) => part.text ?? "")
        .join("")
        .trim();
      if (!text) throw new Error("AI provider returned an empty response.");
      return text;
    }
    const messages = [
      { role: "system", content: systemPrompt },
      ...history.map(({ role, content }) => ({ role, content })),
      {
        role: "user",
        content: image
          ? [
              { type: "text", text: prompt },
              {
                type: "image_url",
                image_url: { url: `data:${image.mimeType};base64,${image.base64}` },
              },
            ]
          : prompt,
      },
    ];
    const response = await fetch(endpoint(baseUrl, "/chat/completions"), {
      method: "POST",
      signal: controller.signal,
      headers: {
        "content-type": "application/json",
        ...(apiKey ? { authorization: `Bearer ${apiKey}` } : {}),
      },
      body: JSON.stringify({ model, messages, temperature, max_tokens: maxTokens }),
    });
    if (!response.ok) throw new Error(`AI provider returned HTTP ${response.status}.`);
    const data = (await readLimitedJson(response)) as {
      choices?: Array<{ message?: { content?: string | Array<{ text?: string }> } }>;
    };
    const content = data.choices?.[0]?.message?.content;
    const text =
      typeof content === "string" ? content : content?.map((part) => part.text ?? "").join("");
    if (!text?.trim()) throw new Error("AI provider returned an empty response.");
    return text.trim();
  } finally {
    clearTimeout(timer);
  }
}
