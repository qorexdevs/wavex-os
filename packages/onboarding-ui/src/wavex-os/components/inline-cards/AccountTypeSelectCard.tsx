/** Gateway card shown to fresh visitors at /onboarding-chat. Three account
 *  types branch the rest of the flow:
 *    - Avatar       → 5-step personal-AI onboarding (profile, tools, voice,
 *                     suggestions, /avatar/:id dashboard).
 *    - Solo Founder → existing welcome textarea + full-org pillar flow.
 *    - Hybrid       → existing welcome textarea, scope picker pre-seeded
 *                     to focused so the operator just picks departments.
 *
 *  Resuming operators (?companyId= or ?avatarId= in URL) never see this
 *  card — they go straight into their existing track. */

import type { AccountType } from "../../state/onboarding-reducer";

interface OptionDef {
  type: AccountType;
  icon: string;
  title: string;
  tagline: string;
  body: string;
  cta: string;
  comingSoon?: boolean;
}

const OPTIONS: OptionDef[] = [
  {
    type: "avatar",
    icon: "🪞",
    title: "Avatar",
    tagline: "A digital avatar of yourself",
    body: "Connect your tools. Your avatar learns from you and automates your work.",
    cta: "Set up my avatar",
  },
  {
    type: "solo_founder",
    icon: "👤",
    title: "Solo Founder",
    tagline: "Your full org, run by AI",
    body: "Spin up the whole 35-agent company — every department active, you in the CEO seat.",
    cta: "Build my full org",
  },
  {
    type: "hybrid",
    icon: "🧩",
    title: "Hybrid",
    tagline: "Fill the gaps in your team",
    body: "Pick which departments to staff with AI agents and keep the rest in-house.",
    cta: "Choose departments",
  },
];

interface Props {
  onChoose: (type: AccountType) => void;
}

export function AccountTypeSelectCard({ onChoose }: Props) {
  return (
    <div style={{ marginTop: "0.5rem", display: "flex", flexDirection: "column", gap: "0.85rem" }}>
      <div className="text-dim" style={{ fontSize: 12 }}>
        How do you want to work with WaveX OS?
      </div>
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
        gap: "0.7rem",
        alignItems: "stretch",
      }}>
        {OPTIONS.map((opt) => (
          <button
            key={opt.type}
            type="button"
            onClick={() => onChoose(opt.type)}
            disabled={opt.comingSoon}
            style={{
              textAlign: "left",
              padding: "1rem 1.1rem",
              background: opt.comingSoon ? "color-mix(in srgb, var(--surface) 70%, transparent)" : "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: 10,
              cursor: opt.comingSoon ? "not-allowed" : "pointer",
              opacity: opt.comingSoon ? 0.65 : 1,
              display: "flex",
              flexDirection: "column",
              gap: "0.5rem",
              transition: "border-color 0.2s ease, box-shadow 0.25s ease, background 0.2s ease",
              boxShadow: "0 0 0 0 transparent",
              height: "100%",
            }}
            onMouseEnter={(e) => {
              if (opt.comingSoon) return;
              e.currentTarget.style.borderColor = "var(--accent)";
              e.currentTarget.style.boxShadow =
                "0 0 24px -4px color-mix(in srgb, var(--accent) 35%, transparent), 0 0 0 1px color-mix(in srgb, var(--accent) 20%, transparent)";
            }}
            onMouseLeave={(e) => {
              if (opt.comingSoon) return;
              e.currentTarget.style.borderColor = "var(--border)";
              e.currentTarget.style.boxShadow = "0 0 0 0 transparent";
            }}
          >
            <div style={{ fontSize: 24, lineHeight: 1, marginBottom: "0.1rem" }}>{opt.icon}</div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", flexWrap: "wrap" }}>
              <span style={{ fontWeight: 700, fontSize: 14, color: "var(--text)" }}>{opt.title}</span>
              {opt.comingSoon && (
                <span
                  style={{
                    fontSize: 9,
                    padding: "0.1rem 0.45rem",
                    border: "1px solid var(--warning)",
                    color: "var(--warning)",
                    borderRadius: 999,
                    letterSpacing: "0.05em",
                    textTransform: "uppercase",
                  }}
                >
                  Coming next
                </span>
              )}
            </div>
            <div className="text-dim" style={{ fontSize: 11, lineHeight: 1.4 }}>
              {opt.tagline}
            </div>
            <div className="text-dim" style={{ fontSize: 12, lineHeight: 1.5 }}>
              {opt.body}
            </div>
            <div style={{
              marginTop: "auto",
              paddingTop: "0.35rem",
              fontSize: 12,
              color: opt.comingSoon ? "var(--text-dim)" : "var(--accent)",
              fontWeight: 600,
            }}>
              {opt.cta} →
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
