/** URL pre-fetch for Pool A T2.
 *
 *  The vendored Pillar-1 prompt tells Claude to "fetch the homepage" at
 *  the URL the customer provided. Claude has no fetch tool when called
 *  via raw messages.create — it either truthfully says "Could not fetch:"
 *  or hallucinates plausible-sounding content (the prompt also says
 *  "essentially always enough" which biases toward hallucination).
 *
 *  We sidestep that by pre-fetching any URLs in the prompt server-side
 *  and injecting the fetched text inline as
 *
 *    [FETCHED https://example.com]
 *    <plain-text dump, first ~30KB, stripped scripts/styles>
 *    [/FETCHED]
 *
 *  so Claude is grounded in real page content. If the fetch fails, we
 *  inject an explicit "[FETCH FAILED]" marker so Claude knows to say
 *  "Could not fetch:" instead of inventing.
 *
 *  Bounds:
 *    - Max 3 URLs per prompt (the vendored prompt only references one)
 *    - 5s timeout per URL
 *    - 50KB raw bytes, 30KB extracted text
 *    - Only http(s) URLs to public hosts (no localhost / private ranges)
 *    - User-Agent identifies us so site operators see "WaveX OS onboarding"
 *
 *  This runs on the hub (Mac mini) where outbound HTTPS is unrestricted. */

const URL_REGEX = /\bhttps?:\/\/[^\s<>\)\]"']+/g;
const MAX_URLS = 3;
const FETCH_TIMEOUT_MS = 5_000;
const MAX_BYTES = 50 * 1024;
const MAX_EXTRACT_CHARS = 30 * 1024;
const UA = "WaveX-OS-Onboarding/1.0 (+https://github.com/aimerdoux/wavex-os)";

const PRIVATE_HOST_PATTERNS = [
  /^localhost$/i,
  /^127\./,
  /^10\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
  /^169\.254\./,
  /^::1$/,
  /^fe80:/i,
  /^fc00:/i,
];

function isSafePublicUrl(raw: string): URL | null {
  let u: URL;
  try { u = new URL(raw); } catch { return null; }
  if (u.protocol !== "http:" && u.protocol !== "https:") return null;
  const host = u.hostname.toLowerCase();
  for (const p of PRIVATE_HOST_PATTERNS) if (p.test(host)) return null;
  return u;
}

/** Strip HTML to plain text. Conservative — keeps line breaks at block
 *  boundaries, drops <script> and <style> contents entirely, collapses
 *  runs of whitespace. Not a full DOM parser; good enough for landing
 *  pages where signal is in body text + headings + meta tags. */
function htmlToText(html: string): string {
  let s = html;
  // Drop script + style blocks (and their contents)
  s = s.replace(/<script[\s\S]*?<\/script>/gi, " ");
  s = s.replace(/<style[\s\S]*?<\/style>/gi, " ");
  s = s.replace(/<noscript[\s\S]*?<\/noscript>/gi, " ");
  s = s.replace(/<!--[\s\S]*?-->/g, " ");
  // Capture useful meta description / og:description before stripping all tags.
  const metaMatches = s.match(/<meta[^>]+content="[^"]+"/gi) ?? [];
  const meta = metaMatches
    .filter((m) => /property="og:|name="(description|twitter:description|keywords)/i.test(m))
    .map((m) => {
      const c = m.match(/content="([^"]+)"/i);
      return c ? c[1] : "";
    })
    .filter(Boolean)
    .join(" | ");
  // Insert line breaks at block boundaries so headings/paragraphs stay readable.
  s = s.replace(/<\/(p|div|li|section|article|header|footer|h[1-6]|tr|br)[^>]*>/gi, "\n");
  s = s.replace(/<br[^>]*>/gi, "\n");
  // Strip every remaining tag.
  s = s.replace(/<[^>]+>/g, " ");
  // Decode the most common HTML entities.
  s = s.replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'");
  s = s.replace(/\s+\n/g, "\n").replace(/\n\s+/g, "\n").replace(/\n{3,}/g, "\n\n").replace(/[ \t]{2,}/g, " ").trim();
  const prefix = meta ? `[META] ${meta}\n\n` : "";
  return (prefix + s).slice(0, MAX_EXTRACT_CHARS);
}

interface FetchResult {
  url: string;
  status: "ok" | "failed";
  body?: string;
  reason?: string;
}

async function fetchOne(url: URL): Promise<FetchResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const resp = await fetch(url.toString(), {
      method: "GET",
      headers: { "User-Agent": UA, Accept: "text/html,application/xhtml+xml" },
      signal: controller.signal,
      redirect: "follow",
    });
    if (!resp.ok) {
      return { url: url.toString(), status: "failed", reason: `HTTP ${resp.status}` };
    }
    const ct = resp.headers.get("content-type") ?? "";
    if (!/text\/html|application\/xhtml/i.test(ct)) {
      return { url: url.toString(), status: "failed", reason: `non-html content-type: ${ct}` };
    }
    // Cap bytes by reading until limit
    const reader = resp.body?.getReader();
    if (!reader) {
      const txt = await resp.text();
      return { url: url.toString(), status: "ok", body: htmlToText(txt.slice(0, MAX_BYTES)) };
    }
    const chunks: Uint8Array[] = [];
    let received = 0;
    while (received < MAX_BYTES) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      received += value.length;
    }
    try { await reader.cancel(); } catch { /* ignore */ }
    const concatLen = chunks.reduce((s, c) => s + c.length, 0);
    const merged = new Uint8Array(concatLen);
    let off = 0;
    for (const c of chunks) { merged.set(c, off); off += c.length; }
    const raw = new TextDecoder("utf-8", { fatal: false }).decode(merged.slice(0, MAX_BYTES));
    return { url: url.toString(), status: "ok", body: htmlToText(raw) };
  } catch (e) {
    const reason = (e as Error).name === "AbortError" ? `timeout after ${FETCH_TIMEOUT_MS}ms` : (e as Error).message;
    return { url: url.toString(), status: "failed", reason };
  } finally {
    clearTimeout(timer);
  }
}

/** Pre-fetch every public http(s) URL in `prompt` and return a new prompt
 *  with FETCHED / FETCH FAILED markers injected before each URL's first
 *  appearance. Idempotent — if the prompt already contains [FETCHED] markers
 *  we leave it alone (avoids double-injection on retry). */
export async function prefetchUrlsInPrompt(prompt: string): Promise<{
  prompt: string;
  results: FetchResult[];
}> {
  if (prompt.includes("[FETCHED ")) return { prompt, results: [] };
  const matches = Array.from(new Set(prompt.match(URL_REGEX) ?? [])).slice(0, MAX_URLS);
  const safe = matches.map(isSafePublicUrl).filter((u): u is URL => Boolean(u));
  if (safe.length === 0) return { prompt, results: [] };

  const results = await Promise.all(safe.map(fetchOne));
  // Build injection block at the START of the prompt — Claude sees it as
  // grounding context before the instructions / URL reference.
  const block = results
    .map((r) =>
      r.status === "ok" && r.body
        ? `[FETCHED ${r.url}]\n${r.body}\n[/FETCHED]\n`
        : `[FETCH FAILED ${r.url} reason="${r.reason ?? "unknown"}"]\n`,
    )
    .join("\n");
  const enriched = `${block}\n${prompt}`;
  return { prompt: enriched, results };
}
