/** Welcome screen — entry point at /onboarding (no companyId yet).
 *  Either resume an existing draft OR start a new company. The op-omega
 *  pipeline auto-creates the company state on first pillar-1 POST, so no
 *  separate "create" call is needed. */

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { opOmegaOnboardingApi } from "../lib/api";
import { slugifyCompanyId } from "../lib/CompanyContext";
import { Card, H2, P, Field, NavRow } from "./primitives";
import { preserveDevFlags } from "../lib/dev-flags";

export function WelcomeScreen() {
  const navigate = useNavigate();
  const { data, isLoading } = useQuery({
    queryKey: ["companies"],
    queryFn: () => opOmegaOnboardingApi.listCompanies(),
  });
  const [name, setName] = useState("");

  const proposedSlug = slugifyCompanyId(name);
  const companies = data?.companies ?? [];
  const slugConflict = companies.some((c) => c.id === proposedSlug);

  function start(): void {
    if (!proposedSlug) return;
    navigate(`/onboarding?${preserveDevFlags(`companyId=${encodeURIComponent(proposedSlug)}`)}`);
  }

  return (
    <div style={{ maxWidth: 760, margin: "0 auto", padding: "2rem" }}>
      <H2>Onboarding</H2>
      <P>
        Define your company's identity, choose your headline KPI, and materialize the kernel
        fleet — CEO + Chief of Staff at minimum, with C-suite roles activated by your stage
        and GTM motion.
      </P>

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
            {slugConflict && <span style={{ color: "var(--warning)", marginLeft: "0.5rem" }}>(already exists — resume below)</span>}
          </div>
        )}
        <NavRow
          next={{ onClick: start, label: "Start →" }}
          nextDisabled={!name.trim() || slugConflict}
        />
      </Card>

      {!isLoading && companies.length > 0 && (
        <Card>
          <H2>Resume an existing draft</H2>
          <div style={{ display: "grid", gap: "0.5rem", marginTop: "0.75rem" }}>
            {companies.map((c) => (
              <button
                key={c.id}
                type="button"
                className="secondary"
                style={{ textAlign: "left", padding: "0.6rem 0.75rem" }}
                onClick={() => navigate(`/onboarding?${preserveDevFlags(`companyId=${encodeURIComponent(c.id)}`)}`)}
              >
                <code>{c.id}</code>{c.name !== c.id && <> · {c.name}</>}
              </button>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
