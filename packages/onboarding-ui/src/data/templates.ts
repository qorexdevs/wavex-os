// Typed accessor for the agent-templates registry.
// The registry is bundled at build time. Skill markdown is lazy-loaded
// from /agent-templates/<id>/SKILL.md (served from /public/).

import registryRaw from "./registry.json";

export type TemplateOrigin = "wavex" | "agency-agents";

export interface AgentTemplate {
  templateId: string;
  role: string;
  tier: 1 | 2 | 3 | 4;
  division: string;
  defaultKpis: string[];
  skillPath: string;
  origin: TemplateOrigin;
  status?: "stub" | "ready";
  sizeBytes?: number;
  upstream?: {
    repo: string;
    ref: string;
    path: string;
    license: string;
  };
}

export interface Registry {
  version: number;
  generatedAt: string;
  upstream: { repo: string; ref: string };
  templates: AgentTemplate[];
}

export const registry = registryRaw as Registry;

export const TEMPLATES: AgentTemplate[] = registry.templates;

export const TEMPLATES_BY_ID: Record<string, AgentTemplate> = Object.fromEntries(
  TEMPLATES.map((t) => [t.templateId, t]),
);

// Division ordering used in the picker UI.
export const DIVISION_ORDER: { id: string; label: string }[] = [
  { id: "c-suite",     label: "C-Suite" },
  { id: "engineering", label: "Engineering" },
  { id: "marketing",   label: "Marketing" },
  { id: "sales",       label: "Sales" },
  { id: "product",     label: "Product" },
  { id: "finance",     label: "Finance" },
  { id: "support",     label: "Support" },
  { id: "testing",     label: "QA / Testing" },
  { id: "specialized", label: "Specialized" },
];

export function templatesByDivision(): { division: string; label: string; templates: AgentTemplate[] }[] {
  return DIVISION_ORDER.map((d) => ({
    division: d.id,
    label: d.label,
    templates: TEMPLATES.filter((t) => t.division === d.id),
  })).filter((g) => g.templates.length > 0);
}

/** Default starter org for the wizard's preview. */
export interface OrgNode {
  slot: string;
  label: string;
  templateId: string;
  reportsToSlot?: string;
}

export const DEFAULT_ORG: OrgNode[] = [
  { slot: "ceo",            label: "CEO",            templateId: "ceo" },
  { slot: "chief_of_staff", label: "Chief of Staff", templateId: "chief-of-staff", reportsToSlot: "ceo" },
  { slot: "cmo",            label: "CMO",            templateId: "cmo",            reportsToSlot: "ceo" },
  { slot: "cro",            label: "CRO",            templateId: "cro",            reportsToSlot: "ceo" },
  { slot: "cto",            label: "CTO",            templateId: "cto",            reportsToSlot: "ceo" },
  { slot: "cdo",            label: "CDO",            templateId: "cdo",            reportsToSlot: "ceo" },
  { slot: "engineer",       label: "Backend Architect", templateId: "backend-architect", reportsToSlot: "cto" },
  { slot: "growth",         label: "Growth Hacker",  templateId: "growth-hacker",     reportsToSlot: "cmo" },
];

/** Lazy-load a template's full skill markdown. */
export async function loadSkill(templateId: string): Promise<string> {
  const res = await fetch(`/agent-templates/${templateId}/SKILL.md`);
  if (!res.ok) throw new Error(`Failed to load skill for ${templateId}: ${res.status}`);
  return res.text();
}
