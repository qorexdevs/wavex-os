/** GitHub repository listing for the QA onboarding wizard step 1 (WAVAAAA-51).
 *
 *  GET /api/github/repos?page=1&per_page=30
 *    Returns the authenticated user's GitHub repos (name, description, private).
 *    In dev mode (WAVEX_COMPOSIO_DISABLED=1 or no GITHUB_TOKEN), returns a
 *    mock list so the wizard is testable without a real GitHub token.
 *    In production, calls the GitHub API using GITHUB_TOKEN env var. */

import type { FastifyInstance } from "fastify";

export interface GitHubRepo {
  id: string;
  full_name: string;
  description: string | null;
  private: boolean;
  updated_at: string;
  html_url: string;
}

const MOCK_REPOS: GitHubRepo[] = [
  { id: "m1", full_name: "acme/frontend",       description: "React web app",         private: false, updated_at: "2026-05-15T10:00:00Z", html_url: "https://github.com/acme/frontend" },
  { id: "m2", full_name: "acme/backend-api",     description: "Node.js REST API",      private: false, updated_at: "2026-05-14T09:00:00Z", html_url: "https://github.com/acme/backend-api" },
  { id: "m3", full_name: "acme/mobile-app",      description: "iOS + Android (RN)",    private: true,  updated_at: "2026-05-13T08:00:00Z", html_url: "https://github.com/acme/mobile-app" },
  { id: "m4", full_name: "acme/design-system",   description: "Shared component lib",  private: false, updated_at: "2026-05-12T07:00:00Z", html_url: "https://github.com/acme/design-system" },
  { id: "m5", full_name: "acme/data-pipeline",   description: "ETL + analytics",       private: true,  updated_at: "2026-05-11T06:00:00Z", html_url: "https://github.com/acme/data-pipeline" },
  { id: "m6", full_name: "acme/infra",           description: "Terraform + k8s",       private: true,  updated_at: "2026-05-10T05:00:00Z", html_url: "https://github.com/acme/infra" },
  { id: "m7", full_name: "acme/docs",            description: "Documentation site",    private: false, updated_at: "2026-05-09T04:00:00Z", html_url: "https://github.com/acme/docs" },
  { id: "m8", full_name: "acme/cli",             description: "Developer CLI tool",    private: false, updated_at: "2026-05-08T03:00:00Z", html_url: "https://github.com/acme/cli" },
  { id: "m9", full_name: "acme/auth-service",    description: "OAuth + session layer", private: true,  updated_at: "2026-05-07T02:00:00Z", html_url: "https://github.com/acme/auth-service" },
  { id: "m10", full_name: "acme/webhooks",       description: "Inbound webhook relay", private: false, updated_at: "2026-05-06T01:00:00Z", html_url: "https://github.com/acme/webhooks" },
];

function isDevMode(): boolean {
  return process.env.WAVEX_COMPOSIO_DISABLED === "1"
    || process.env.NODE_ENV !== "production"
    || !process.env.GITHUB_TOKEN;
}

async function fetchGitHubRepos(token: string, page: number, perPage: number): Promise<GitHubRepo[]> {
  const url = `https://api.github.com/user/repos?sort=updated&direction=desc&page=${page}&per_page=${perPage}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });
  if (!res.ok) {
    throw new Error(`GitHub API error: ${res.status}`);
  }
  const raw = (await res.json()) as Array<{
    id: number;
    full_name: string;
    description: string | null;
    private: boolean;
    updated_at: string;
    html_url: string;
  }>;
  return raw.map((r) => ({
    id: String(r.id),
    full_name: r.full_name,
    description: r.description,
    private: r.private,
    updated_at: r.updated_at,
    html_url: r.html_url,
  }));
}

export function registerGitHubReposRoute(app: FastifyInstance): void {
  app.get<{ Querystring: { page?: string; per_page?: string } }>(
    "/api/github/repos",
    async (req, reply) => {
      const page = Math.max(1, parseInt(req.query.page ?? "1", 10) || 1);
      const perPage = Math.min(100, Math.max(1, parseInt(req.query.per_page ?? "30", 10) || 30));

      if (isDevMode()) {
        const start = (page - 1) * perPage;
        const slice = MOCK_REPOS.slice(start, start + perPage);
        return reply.send({
          repos: slice,
          total: MOCK_REPOS.length,
          page,
          per_page: perPage,
          mock: true,
        });
      }

      try {
        const repos = await fetchGitHubRepos(process.env.GITHUB_TOKEN!, page, perPage);
        return reply.send({ repos, total: null, page, per_page: perPage, mock: false });
      } catch (e) {
        const msg = e instanceof Error ? e.message : "GitHub API unavailable";
        return reply.status(502).send({ error: msg });
      }
    },
  );
}
