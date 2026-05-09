/** Welcome screen — entry point at /onboarding (no companyId yet).
 * Either resume an existing draft OR create a new company. */

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import { opOmegaOnboardingApi } from "../lib/api";
import { slugifyCompanyId } from "../lib/CompanyContext";
import { Card, H2, P, Field, NavRow } from "./primitives";

export function WelcomeScreen() {
  const navigate = useNavigate();
  const { data, isLoading } = useQuery({
    queryKey: ["companies"],
    queryFn: () => opOmegaOnboardingApi.listCompanies(),
  });
  const [name, setName] = useState("");
  const create = useMutation({
    mutationFn: (slug: string) => opOmegaOnboardingApi.createCompany(slug),
    onSuccess: (_data, slug) => {
      navigate(`/onboarding?companyId=${encodeURIComponent(slug)}`);
    },
  });

  const proposedSlug = slugifyCompanyId(name);
  const slugConflict = (data?.companies ?? []).includes(proposedSlug);

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
            {slugConflict && <span style={{ color: "var(--warning)", marginLeft: "0.5rem" }}>(already exists — pick a different name or resume below)</span>}
          </div>
        )}
        <NavRow
          next={{
            onClick: () => create.mutate(proposedSlug),
            label: create.isPending ? "Creating..." : "Create + start →",
          }}
          nextDisabled={!name.trim() || slugConflict || create.isPending}
        />
        {create.isError && (
          <div style={{ color: "var(--warning)", fontSize: 13, marginTop: "0.5rem" }}>
            {(create.error as Error).message}
          </div>
        )}
      </Card>

      {!isLoading && (data?.companies?.length ?? 0) > 0 && (
        <Card>
          <H2>Resume an existing draft</H2>
          <div style={{ display: "grid", gap: "0.5rem", marginTop: "0.75rem" }}>
            {data!.companies.map((c) => (
              <button
                key={c}
                type="button"
                className="secondary"
                style={{ textAlign: "left", padding: "0.6rem 0.75rem" }}
                onClick={() => navigate(`/onboarding?companyId=${encodeURIComponent(c)}`)}
              >
                <code>{c}</code>
              </button>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
