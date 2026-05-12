/** Sub-fleet scope detection — keyword sniff over the operator's Pillar 1
 *  raw_input. Returns the canonical departments the prose hints at, or
 *  an empty array when the input gives no signal. Used by the shell to
 *  pre-select chips in ScopePromptCard.
 *
 *  Canonical departments (mirror vendor/op-omega base-roster.ts):
 *    product · marketing · revenue · finance · data · ops
 *
 *  This is a no-T2 heuristic. v2 can swap to a dedicated scope-extraction
 *  T2 call once we have data on misclassifications. */

export type Department = "product" | "marketing" | "revenue" | "finance" | "data" | "ops";

interface Rule {
  dept: Department;
  patterns: RegExp[];
}

const RULES: Rule[] = [
  {
    dept: "marketing",
    patterns: [/marketing/i, /brand/i, /\bseo\b/i, /\bppc\b/i, /content\s+(team|strategy|marketing)/i, /demand\s+gen/i, /\bads?\b/i, /\bsocial\b/i],
  },
  {
    dept: "revenue",
    patterns: [/\bsales\b/i, /outbound/i, /\bcold\s+(email|call)/i, /demo/i, /\bclos(e|ing)\b/i, /pipeline/i, /\bsdr\b/i, /\bbdr\b/i, /\bcrm\b/i],
  },
  {
    dept: "product",
    patterns: [/\bproduct\b/i, /\bengineering\b/i, /\bbuild(ing)?\b/i, /\bdev\b/i, /\bship(ping)?\b/i, /roadmap/i, /\bqa\b/i, /backlog/i],
  },
  {
    dept: "finance",
    patterns: [/\bfinanc(e|ial)\b/i, /\baccounting\b/i, /\bbookkeep/i, /\binvoic/i, /\bbilling\b/i, /\brunway\b/i, /\bcash\s*flow/i],
  },
  {
    dept: "data",
    patterns: [/\bdata\b/i, /\banalytics\b/i, /\bbi\b/i, /\bdashboard/i, /\bmetrics\b/i, /\battribution\b/i, /\bml\b/i],
  },
  {
    dept: "ops",
    patterns: [/\bops\b/i, /\boperations\b/i, /\bback\s*office\b/i, /\binfra\b/i, /\bautomation\b/i, /\bcustomer\s+support\b/i, /\bsupport\s+team\b/i],
  },
];

export function detectScope(rawInput: string): Department[] {
  if (!rawInput) return [];
  const hits = new Set<Department>();
  for (const rule of RULES) {
    if (rule.patterns.some((re) => re.test(rawInput))) {
      hits.add(rule.dept);
    }
  }
  return [...hits];
}

/** Human-friendly label per canonical department. */
export const DEPARTMENT_LABEL: Record<Department, string> = {
  product: "Product & Engineering",
  marketing: "Marketing",
  revenue: "Sales & Revenue",
  finance: "Finance",
  data: "Data & Analytics",
  ops: "Operations",
};

export const ALL_DEPARTMENTS: Department[] = ["product", "marketing", "revenue", "finance", "data", "ops"];
