/** Cross-origin glue from Paperclip UI (5174) to wavex mock-core (3101).
 *
 *  Wavex-onboarded companies appear in Paperclip with name "wavex-os/<slug>".
 *  After Paperclip Dashboard reads the active company, this helper extracts
 *  the wavex slug so the new KPI panel and board-chat dock can pull
 *  wavex-side data (manifest, KPIs, chat history) directly from 3101.
 *
 *  Non-wavex Paperclip companies return null — the corresponding UI
 *  components hide themselves so plain Paperclip use is unaffected. */

const WAVEX_API_BASE = (import.meta.env.VITE_WAVEX_API as string | undefined)?.replace(/\/+$/, "")
  ?? "http://localhost:3101";

interface CompanyLike {
  name: string;
  description?: string | null;
}

/** Recover the wavex slug for a Paperclip company. Primary signal is the
 *  "wavex-os/<slug>" name prefix written by the handoff bridge; the
 *  description carries `wavexCompanyId=<slug>` as a rename-safe fallback. */
export function deriveWavexCompanyId(company: CompanyLike | null | undefined): string | null {
  if (!company) return null;
  const fromName = /^wavex-os\/(.+)$/.exec(company.name);
  if (fromName) return fromName[1];
  const fromDesc = company.description?.match(/wavexCompanyId=([^\s,]+)/);
  return fromDesc?.[1] ?? null;
}

export class WavexFetchError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = "WavexFetchError";
  }
}

async function wavexRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const url = `${WAVEX_API_BASE}${path.startsWith("/") ? path : `/${path}`}`;
  const resp = await fetch(url, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!resp.ok) {
    throw new WavexFetchError(resp.status, `HTTP ${resp.status} on ${path}`);
  }
  return (await resp.json()) as T;
}

export const wavexApi = {
  manifest: (companyId: string) =>
    wavexRequest<{ ok: boolean; manifest?: {
      company?: { id?: string; name?: string };
      goal?: { kpiId?: string; current?: number; target?: number; days?: number };
      state?: string;
    } }>(`/api/instance/${encodeURIComponent(companyId)}/manifest`),

  kpis: (companyId: string) =>
    wavexRequest<{ ok: boolean; companyId: string; kpis: Array<{
      kpiId: string; label: string; ownerRole?: string;
      direction: "higher_is_better" | "lower_is_better";
      currentValue?: number; targetMicros?: number; windowDays?: number;
    }> }>(`/api/instance/${encodeURIComponent(companyId)}/kpis`),

  getBoardChat: (companyId: string) =>
    wavexRequest<{ ok: boolean; messages: Array<{ role: "user" | "assistant"; ts_iso: string; text: string }> }>(
      `/api/instance/${encodeURIComponent(companyId)}/help-chat?mode=board`,
    ),

  postBoardChat: (companyId: string, message: string, currentPath?: string) =>
    wavexRequest<{
      ok: boolean;
      messages: Array<{ role: "user" | "assistant"; ts_iso: string; text: string }>;
      latest_assistant?: { role: "assistant"; ts_iso: string; text: string };
    }>(`/api/instance/${encodeURIComponent(companyId)}/help-chat`, {
      method: "POST",
      body: JSON.stringify({ message, mode: "board", currentPath }),
    }),
};
