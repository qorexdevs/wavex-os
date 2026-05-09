/**
 * T1 runtime · Ollama local inference.
 *
 * Calls localhost:11434 /api/generate in non-streaming mode. Zero cost, zero
 * rate limit. Throws on network failure so the router can decide to fall
 * back to T2.
 */

export interface OllamaInvokeInput {
  baseUrl: string;
  model: string;
  prompt: string;
  timeoutMs: number;
}

export interface OllamaInvokeResult {
  text: string;
  promptEvalCount?: number;
  evalCount?: number;
}

export async function invokeOllama(input: OllamaInvokeInput): Promise<OllamaInvokeResult> {
  const controller = new AbortController();
  const killer = setTimeout(() => controller.abort(), input.timeoutMs);
  try {
    const res = await fetch(`${input.baseUrl.replace(/\/$/, "")}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: input.model, prompt: input.prompt, stream: false }),
      signal: controller.signal,
    });
    if (!res.ok) {
      throw new Error(`ollama ${res.status}: ${(await res.text()).slice(0, 200)}`);
    }
    const data = (await res.json()) as {
      response?: string;
      prompt_eval_count?: number;
      eval_count?: number;
    };
    return {
      text: typeof data.response === "string" ? data.response : "",
      promptEvalCount: data.prompt_eval_count,
      evalCount: data.eval_count,
    };
  } finally {
    clearTimeout(killer);
  }
}
