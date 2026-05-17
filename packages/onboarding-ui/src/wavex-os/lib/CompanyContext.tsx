/** Active company context. Read from URL param `?companyId=<slug>` so the
 * browser URL is the source of truth (shareable, refresh-survives,
 * no localStorage dance). */

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useSearchParams } from "react-router-dom";

interface CompanyContextValue {
  companyId: string | null;
  setCompanyId: (id: string | null) => void;
}

const Ctx = createContext<CompanyContextValue>({ companyId: null, setCompanyId: () => {} });

export function CompanyProvider({ children }: { children: ReactNode }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const value = useMemo<CompanyContextValue>(
    () => ({
      companyId: searchParams.get("companyId"),
      setCompanyId: (id) => {
        const next = new URLSearchParams(searchParams);
        if (id) next.set("companyId", id);
        else next.delete("companyId");
        setSearchParams(next, { replace: true });
      },
    }),
    [searchParams, setSearchParams],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCompany(): CompanyContextValue {
  return useContext(Ctx);
}

/** Slugify a company name to a URL-safe id (lowercase, alphanum + dash). */
export function slugifyCompanyId(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-") || "default";
}
