/** Welcome screen — entry point at /onboarding (no companyId yet).
 *  Either resume an existing draft, reset one to a clean slate, or start
 *  a new company. The wavex-os pipeline auto-creates the company state on
 *  first pillar-1 POST, so no separate "create" call is needed. */

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { wavexOsOnboardingApi, ApiError } from "../lib/api";
import { slugifyCompanyId } from "../lib/CompanyContext";
import { Card, H2, P, Field, NavRow } from "./primitives";
import { ConfirmResetModal } from "./ConfirmResetModal";
import { preserveDevFlags } from "../lib/dev-flags";

export function WelcomeScreen() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["companies"],
    queryFn: () => wavexOsOnboardingApi.listCompanies(),
  });
  const [name, setName] = useState("");
  const [confirmReset, setConfirmReset] = useState<string | null>(null);
  const [resetting, setResetting] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);
  const [resetReport, setResetReport] = useState<{ companyId: string; rows: number } | null>(null);

  const proposedSlug = slugifyCompanyId(name);
  const companies = data?.companies ?? [];
  const slugConflict = companies.some((c) => c.id === proposedSlug);

  function start(): void {
    if (!proposedSlug) return;
    navigate(`/onboarding?${preserveDevFlags(`companyId=${encodeURIComponent(proposedSlug)}`)}`);
  }

  async function doReset(companyId: string, restart: boolean): Promise<void> {
    setResetting(true);
    setResetError(null);
    try {
      const r = await wavexOsOnboardingApi.resetCompany(companyId);
      const totalRows = Object.values(r.dbDeletedRows).reduce((a, n) => a + n, 0);
      setResetReport({ companyId, rows: totalRows });
      setConfirmReset(null);
      // Refresh the company list
      await qc.invalidateQueries({ queryKey: ["companies"] });
      if (restart) {
        navigate(`/onboarding?${preserveDevFlags(`companyId=${encodeURIComponent(companyId)}`)}`);
      }
    } catch (e) {
      setResetError(e instanceof ApiError ? e.message : (e as Error).message);
    } finally {
      setResetting(false);
    }
  }

  return (
    <div style={{ maxWidth: 760, margin: "0 auto", padding: "2rem" }}>
      <H2>Onboarding</H2>
      <P>
        Define your company's identity, choose your headline KPI, and materialize the kernel
        fleet — CEO + Chief of Staff at minimum, with C-suite roles activated by your stage
        and GTM motion.
      </P>

      {resetReport && (
        <Card accent>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--accent)" }}>
            ✓ Reset <code>{resetReport.companyId}</code> — wiped {resetReport.rows} db row{resetReport.rows === 1 ? "" : "s"} + onboarding artifacts.
          </div>
        </Card>
      )}

      {resetError && (
        <Card>
          <p style={{ color: "var(--warning)", margin: 0 }}>✗ Reset failed: {resetError}</p>
        </Card>
      )}

      <Card>
        <H2>Start a new company</H2>
        <Field label="Company name" required>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Acme Concierge"
            autoFocus
          />
        </Field>
        {name.trim() && (
          <div className="text-dim" style={{ fontSize: 13, marginBottom: "0.75rem" }}>
            slug: <code>{proposedSlug}</code>
            {slugConflict && <span style={{ color: "var(--warning)", marginLeft: "0.5rem" }}>(already exists — resume or reset below)</span>}
          </div>
        )}
        <NavRow
          next={{ onClick: start, label: "Start →" }}
          nextDisabled={!name.trim() || slugConflict}
        />
      </Card>

      {!isLoading && companies.length > 0 && (
        <Card>
          <H2>Resume or reset an existing draft</H2>
          <div style={{ display: "grid", gap: "0.5rem", marginTop: "0.75rem" }}>
            {companies.map((c) => (
              <div
                key={c.id}
                style={{
                  display: "flex",
                  alignItems: "stretch",
                  gap: "0.4rem",
                }}
              >
                <button
                  type="button"
                  className="secondary"
                  style={{ flex: 1, textAlign: "left", padding: "0.6rem 0.75rem" }}
                  onClick={() => navigate(`/onboarding?${preserveDevFlags(`companyId=${encodeURIComponent(c.id)}`)}`)}
                >
                  <code>{c.id}</code>{c.name !== c.id && <> · {c.name}</>}
                </button>
                <button
                  type="button"
                  style={{
                    padding: "0.4rem 0.7rem",
                    background: "transparent",
                    color: "var(--warning)",
                    border: "1px solid var(--warning)",
                    borderRadius: 4,
                    fontSize: 12,
                    cursor: "pointer",
                  }}
                  onClick={() => { setConfirmReset(c.id); setResetError(null); setResetReport(null); }}
                  title="Wipe all state and start over from Pillar 1"
                >
                  Reset
                </button>
              </div>
            ))}
          </div>
        </Card>
      )}

      {confirmReset && (
        <ConfirmResetModal
          companyId={confirmReset}
          busy={resetting}
          onCancel={() => setConfirmReset(null)}
          onConfirm={(restart) => void doReset(confirmReset, restart)}
        />
      )}
    </div>
  );
}
