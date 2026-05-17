/** Wizard step 1: GitHub OAuth + repo selector (WAVAAAA-51).
 *
 *  Flow:
 *    1. "Connect GitHub" button → Composio OAuth popup (dev: instant mock connect)
 *    2. After auth, repo list pre-fetches in the background
 *    3. Search/filter + paginated list; user picks one repo
 *    4. "Next" enabled once a repo is selected */

import { useCallback, useEffect, useRef, useState } from "react";
import { wavexOsOnboardingApi, userApi, type GitHubRepo } from "../lib/api";

const PAGE_SIZE = 10;

interface Props {
  userId: string;
  initialRepo: string | null;
  onRepoSelected: (repo: string) => void;
}

export function GitHubRepoStep({ userId, initialRepo, onRepoSelected }: Props) {
  const [oauthStatus, setOauthStatus] = useState<"idle" | "connecting" | "connected">(
    initialRepo ? "connected" : "idle",
  );
  const [repos, setRepos] = useState<GitHubRepo[]>([]);
  const [loadingRepos, setLoadingRepos] = useState(false);
  const [reposError, setReposError] = useState<string | null>(null);
  const [oauthError, setOauthError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [selectedRepo, setSelectedRepo] = useState<string | null>(initialRepo);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);

  const popupRef = useRef<Window | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchRepos = useCallback(async (nextPage: number, append: boolean) => {
    setLoadingRepos(true);
    setReposError(null);
    try {
      const res = await userApi.getGitHubRepos(nextPage, PAGE_SIZE);
      setRepos((prev) => append ? [...prev, ...res.repos] : res.repos);
      setHasMore(res.repos.length === PAGE_SIZE);
      setPage(nextPage);
    } catch (e) {
      setReposError(e instanceof Error ? e.message : "Failed to load repos");
    } finally {
      setLoadingRepos(false);
    }
  }, []);

  // Pre-fetch repos right after OAuth completes.
  useEffect(() => {
    if (oauthStatus === "connected" && repos.length === 0 && !loadingRepos) {
      void fetchRepos(1, false);
    }
  }, [oauthStatus, repos.length, loadingRepos, fetchRepos]);

  function stopPoll() {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  }

  async function connectGitHub() {
    setOauthStatus("connecting");
    setOauthError(null);
    try {
      const init = await wavexOsOnboardingApi.initiateConnectorOAuth({
        companyId: userId,
        toolkitSlug: "github",
      });

      // Dev mode: Composio disabled → mark connected immediately, load mock repos.
      if (!init.url || init.needsLiveWiring) {
        setOauthStatus("connected");
        return;
      }

      const popup = window.open(init.url, "wavex-github-oauth", "width=520,height=720");
      if (!popup) {
        throw new Error("Popup blocked — allow popups and click Connect again.");
      }
      popupRef.current = popup;

      // Start pre-fetching repos in background (~5s delay) so the list is
      // ready before the user finishes with the OAuth popup.
      const prefetchTimer = setTimeout(() => { void fetchRepos(1, false); }, 5_000);

      // Poll for ACTIVE GitHub connection: 2s tick, 90s ceiling.
      const deadline = Date.now() + 90_000;
      pollRef.current = setInterval(async () => {
        if (Date.now() > deadline) {
          stopPoll();
          clearTimeout(prefetchTimer);
          setOauthStatus("idle");
          setOauthError("OAuth timed out — try again.");
          return;
        }
        if (popup.closed) {
          stopPoll();
          clearTimeout(prefetchTimer);
          // Popup closed — check if we got an ACTIVE connection before the close.
          try {
            const list = await wavexOsOnboardingApi.listHostedConnections();
            const active = list.connections.find(
              (c) => c.toolkit_slug === "github" && c.status?.toLowerCase() === "active",
            );
            if (active) {
              setOauthStatus("connected");
            } else {
              setOauthStatus("idle");
              setOauthError("GitHub connection not completed. Try again.");
            }
          } catch {
            setOauthStatus("idle");
            setOauthError("Could not verify GitHub connection. Try again.");
          }
          return;
        }
        try {
          const list = await wavexOsOnboardingApi.listHostedConnections();
          const active = list.connections.find(
            (c) => c.toolkit_slug === "github" && c.status?.toLowerCase() === "active",
          );
          if (active) {
            stopPoll();
            clearTimeout(prefetchTimer);
            try { popup.close(); } catch { /* cross-origin */ }
            setOauthStatus("connected");
          }
        } catch { /* transient — keep polling */ }
      }, 2_000);
    } catch (e) {
      stopPoll();
      setOauthStatus("idle");
      setOauthError(e instanceof Error ? e.message : "GitHub OAuth failed.");
    }
  }

  // Clean up poll on unmount.
  useEffect(() => () => { stopPoll(); }, []);

  function handleSelect(fullName: string) {
    setSelectedRepo(fullName);
    onRepoSelected(fullName);
  }

  function handleLoadMore() {
    void fetchRepos(page + 1, true);
  }

  const filtered = repos.filter((r) =>
    r.full_name.toLowerCase().includes(query.toLowerCase()) ||
    (r.description ?? "").toLowerCase().includes(query.toLowerCase()),
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      {/* Help text */}
      <div style={{
        padding: "0.6rem 0.85rem",
        background: "color-mix(in srgb, var(--accent) 8%, transparent)",
        border: "1px solid color-mix(in srgb, var(--accent) 28%, transparent)",
        borderRadius: 7,
        fontSize: 13,
        color: "var(--text-dim)",
        lineHeight: 1.55,
      }}>
        <em>We watch this repo and trigger a smoke test on every push.</em>
      </div>

      {/* OAuth button / connected badge */}
      {oauthStatus !== "connected" ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.55rem" }}>
          <button
            type="button"
            onClick={() => void connectGitHub()}
            disabled={oauthStatus === "connecting"}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "0.55rem",
              padding: "0.75rem 1.5rem",
              borderRadius: 8,
              background: oauthStatus === "connecting"
                ? "color-mix(in srgb, var(--accent) 60%, transparent)"
                : "var(--accent)",
              color: "var(--bg)",
              border: "none",
              fontWeight: 700,
              fontSize: 14,
              cursor: oauthStatus === "connecting" ? "wait" : "pointer",
              width: "100%",
              transition: "background 0.15s",
            }}
          >
            <span style={{ fontSize: 18, lineHeight: 1 }} aria-hidden>
              {oauthStatus === "connecting" ? "⏳" : "🐙"}
            </span>
            {oauthStatus === "connecting" ? "Connecting to GitHub…" : "Connect GitHub"}
          </button>
          {oauthError && (
            <div style={{ color: "var(--warning)", fontSize: 12 }}>✗ {oauthError}</div>
          )}
        </div>
      ) : (
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: "0.5rem",
          padding: "0.45rem 0.75rem",
          background: "color-mix(in srgb, var(--accent) 8%, transparent)",
          border: "1px solid color-mix(in srgb, var(--accent) 35%, transparent)",
          borderRadius: 7,
          fontSize: 12,
          color: "var(--accent)",
          fontWeight: 600,
        }}>
          <span aria-hidden>✓</span>
          GitHub connected
          <button
            type="button"
            onClick={() => {
              setOauthStatus("idle");
              setRepos([]);
              setSelectedRepo(null);
              onRepoSelected("");
              setOauthError(null);
            }}
            style={{
              marginLeft: "auto",
              background: "transparent",
              border: "none",
              color: "var(--text-dim)",
              fontSize: 11,
              cursor: "pointer",
              padding: 0,
            }}
          >
            Disconnect
          </button>
        </div>
      )}

      {/* Repo selector — shown after OAuth */}
      {oauthStatus === "connected" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.65rem" }}>
          {/* Search */}
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search repos…"
            aria-label="Search GitHub repos"
            style={{
              width: "100%",
              padding: "0.5rem 0.75rem",
              background: "var(--bg)",
              border: "1px solid var(--border)",
              borderRadius: 7,
              color: "var(--text)",
              fontSize: 13,
              fontFamily: "inherit",
              outline: "none",
              boxSizing: "border-box",
            }}
          />

          {/* Repo list */}
          {loadingRepos && repos.length === 0 ? (
            <div style={{ color: "var(--text-dim)", fontSize: 13, textAlign: "center", padding: "1.5rem 0" }}>
              Loading repos…
            </div>
          ) : reposError ? (
            <div style={{ color: "var(--warning)", fontSize: 12 }}>✗ {reposError}</div>
          ) : filtered.length === 0 ? (
            <div style={{ color: "var(--text-dim)", fontSize: 13, textAlign: "center", padding: "1.25rem 0" }}>
              {query ? "No repos match your search." : "No repos found."}
            </div>
          ) : (
            <>
              <div
                role="listbox"
                aria-label="GitHub repositories"
                style={{ display: "flex", flexDirection: "column", gap: "0.35rem", maxHeight: 280, overflowY: "auto" }}
              >
                {filtered.map((repo) => {
                  const selected = selectedRepo === repo.full_name;
                  return (
                    <div
                      key={repo.id}
                      role="option"
                      aria-selected={selected}
                      onClick={() => handleSelect(repo.full_name)}
                      style={{
                        padding: "0.6rem 0.8rem",
                        borderRadius: 7,
                        border: `1px solid ${selected ? "var(--accent)" : "var(--border)"}`,
                        background: selected
                          ? "color-mix(in srgb, var(--accent) 10%, transparent)"
                          : "var(--bg)",
                        cursor: "pointer",
                        display: "flex",
                        flexDirection: "column",
                        gap: "0.2rem",
                        transition: "border-color 0.12s, background 0.12s",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "0.45rem" }}>
                        <span style={{
                          fontSize: 11,
                          color: "var(--text-dim)",
                          background: "var(--border)",
                          borderRadius: 3,
                          padding: "1px 5px",
                          fontWeight: 500,
                        }}>
                          {repo.private ? "private" : "public"}
                        </span>
                        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", fontFamily: "monospace" }}>
                          {repo.full_name}
                        </span>
                        {selected && (
                          <span style={{ marginLeft: "auto", color: "var(--accent)", fontSize: 13 }} aria-hidden>✓</span>
                        )}
                      </div>
                      {repo.description && (
                        <div style={{ fontSize: 11, color: "var(--text-dim)", lineHeight: 1.4 }}>
                          {repo.description}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Load more — only when not filtering and there are more pages */}
              {!query && hasMore && (
                <button
                  type="button"
                  onClick={handleLoadMore}
                  disabled={loadingRepos}
                  style={{
                    padding: "0.4rem 0.8rem",
                    borderRadius: 6,
                    border: "1px solid var(--border)",
                    background: "transparent",
                    color: "var(--text-dim)",
                    fontSize: 12,
                    cursor: loadingRepos ? "wait" : "pointer",
                    alignSelf: "center",
                  }}
                >
                  {loadingRepos ? "Loading…" : "Load more"}
                </button>
              )}
            </>
          )}
        </div>
      )}

      {/* Selected repo summary */}
      {selectedRepo && (
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: "0.4rem",
          padding: "0.45rem 0.75rem",
          background: "color-mix(in srgb, var(--accent) 6%, transparent)",
          borderRadius: 6,
          fontSize: 12,
          color: "var(--text-dim)",
        }}>
          <span style={{ color: "var(--accent)" }}>✓ Selected:</span>
          <code style={{ color: "var(--text)", fontWeight: 600 }}>{selectedRepo}</code>
        </div>
      )}
    </div>
  );
}
