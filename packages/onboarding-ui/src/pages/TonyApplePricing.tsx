/**
 * /pricing — Tony Apple QA Studio
 * Board-approved pricing table + FAQ for the tony-apple-qa site.
 */

const TIERS = [
  {
    key: "free",
    name: "Free",
    price: "$0",
    cadence: "/mo",
    limits: "1 app · 100 runs/mo",
    features: ["Smoke tests", "Community support", "Public dashboard"],
    cta: "Start free →",
    ctaHref: "/signup",
    featured: false,
  },
  {
    key: "team",
    name: "Team",
    price: "$299",
    cadence: "/mo",
    limits: "3 apps · unlimited runs",
    features: ["CI/CD integrations", "Email support", "Private reports"],
    cta: "Start 14-day trial →",
    ctaHref: "/signup?plan=team",
    featured: true,
  },
  {
    key: "enterprise",
    name: "Enterprise",
    price: "Custom",
    cadence: "",
    limits: "Unlimited",
    features: ["SSO", "SLAs", "Dedicated Slack", "Custom test suites"],
    cta: "Talk to sales →",
    ctaHref: "mailto:hello@tonyappleqa.com",
    featured: false,
  },
] as const;

const FAQ = [
  {
    q: 'What counts as a "run"?',
    a: "A run is one full smoke test execution across your defined test suite for one app version.",
  },
  {
    q: "Can I upgrade or downgrade anytime?",
    a: "Yes, changes take effect at the next billing cycle.",
  },
  {
    q: "Is the Free tier really free forever?",
    a: "Yes — no credit card required.",
  },
  {
    q: "What CI/CD systems do you support?",
    a: "GitHub Actions, Bitrise, CircleCI, and GitLab CI out of the box. More on request.",
  },
  {
    q: "Do you support both iOS and Android?",
    a: "Yes, both platforms are supported on all paid plans.",
  },
];

function TierCard({ tier }: { tier: (typeof TIERS)[number] }): JSX.Element {
  return (
    <div
      style={{
        background: tier.featured ? "#0e1f1a" : "var(--surface)",
        border: `1px solid ${tier.featured ? "var(--accent)" : "var(--border)"}`,
        borderRadius: 12,
        padding: "28px 24px",
        display: "flex",
        flexDirection: "column",
        gap: 16,
        position: "relative",
      }}
    >
      {tier.featured && (
        <div
          style={{
            position: "absolute",
            top: -11,
            left: "50%",
            transform: "translateX(-50%)",
            background: "var(--accent)",
            color: "#08221d",
            padding: "3px 14px",
            borderRadius: 20,
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: 0.5,
            fontFamily: "ui-monospace, JetBrains Mono, Menlo, monospace",
            whiteSpace: "nowrap",
          }}
        >
          MOST POPULAR
        </div>
      )}

      <div>
        <div
          style={{
            fontSize: 12,
            color: "var(--text-dim)",
            fontFamily: "ui-monospace, JetBrains Mono, Menlo, monospace",
            letterSpacing: 0.8,
            marginBottom: 6,
          }}
        >
          {tier.key.toUpperCase()}
        </div>
        <div style={{ fontSize: 30, fontWeight: 700 }}>
          {tier.price}
          {tier.cadence && (
            <span style={{ fontSize: 16, fontWeight: 400, color: "var(--text-dim)" }}>
              {tier.cadence}
            </span>
          )}
        </div>
        <div style={{ fontSize: 13, color: "var(--text-dim)", marginTop: 4 }}>{tier.limits}</div>
      </div>

      <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 8, flexGrow: 1 }}>
        {tier.features.map((f) => (
          <li key={f} style={{ fontSize: 14, paddingLeft: 20, position: "relative" }}>
            <span style={{ position: "absolute", left: 0, color: "var(--accent)" }}>✓</span>
            {f}
          </li>
        ))}
      </ul>

      <a
        href={tier.ctaHref}
        style={{
          display: "block",
          textAlign: "center",
          padding: "11px 16px",
          borderRadius: 8,
          fontSize: 14,
          fontWeight: 600,
          textDecoration: "none",
          background: tier.featured ? "var(--accent)" : "transparent",
          color: tier.featured ? "#08221d" : "var(--text)",
          border: `1px solid ${tier.featured ? "var(--accent)" : "var(--border)"}`,
          transition: "opacity 80ms",
        }}
      >
        {tier.cta}
      </a>
    </div>
  );
}

export default function TonyApplePricing(): JSX.Element {
  return (
    <>
      <head>
        <title>Pricing | Tony Apple QA Studio</title>
        <meta name="description" content="Simple, transparent pricing for mobile QA. Free for developers, $299/mo for teams, Enterprise for scaled operations." />
        <meta property="og:title" content="Pricing | Tony Apple QA Studio" />
        <meta property="og:description" content="Simple, transparent pricing for mobile QA. Free for developers, $299/mo for teams, Enterprise for scaled operations." />
        <meta property="og:image" content="/og-pricing.png" />
      </head>

      <div
        style={{
          background: "var(--bg)",
          color: "var(--text)",
          minHeight: "100vh",
          padding: "64px 24px 80px",
          fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif",
        }}
      >
        <div style={{ maxWidth: 960, margin: "0 auto" }}>

          {/* Nav */}
          <nav style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 72 }}>
            <a href="/" style={{ fontWeight: 700, fontSize: 16, color: "var(--text)", textDecoration: "none" }}>
              Tony Apple QA
            </a>
            <div style={{ display: "flex", gap: 24, alignItems: "center" }}>
              <a href="/pricing" style={{ fontSize: 14, color: "var(--accent)", textDecoration: "none" }}>Pricing</a>
              <a href="/lp/design-partners" style={{ fontSize: 14, color: "var(--text-dim)", textDecoration: "none" }}>Design Partners</a>
              <a
                href="/signup"
                style={{
                  fontSize: 14,
                  fontWeight: 600,
                  padding: "7px 16px",
                  background: "var(--accent)",
                  color: "#08221d",
                  borderRadius: 8,
                  textDecoration: "none",
                }}
              >
                Start free
              </a>
            </div>
          </nav>

          {/* Hero */}
          <header style={{ textAlign: "center", marginBottom: 56 }}>
            <h1 style={{ fontSize: 42, fontWeight: 700, margin: "0 0 16px", lineHeight: 1.15 }}>
              Simple, transparent pricing for mobile QA
            </h1>
            <p style={{ fontSize: 18, color: "var(--text-dim)", maxWidth: 640, margin: "0 auto", lineHeight: 1.6 }}>
              From solo developers to enterprise mobile teams — automated iOS and Android smoke tests
              that run every CI build.
            </p>
          </header>

          {/* Trust bar */}
          <div
            style={{
              textAlign: "center",
              fontSize: 13,
              color: "var(--text-dim)",
              marginBottom: 48,
              padding: "12px 0",
              borderTop: "1px solid var(--border)",
              borderBottom: "1px solid var(--border)",
            }}
          >
            Trusted by mobile teams shipping on iOS and Android
          </div>

          {/* Pricing cards */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
              gap: 20,
              marginBottom: 72,
            }}
          >
            {TIERS.map((t) => (
              <TierCard key={t.key} tier={t} />
            ))}
          </div>

          {/* FAQ */}
          <section style={{ maxWidth: 680, margin: "0 auto" }}>
            <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 28, textAlign: "center" }}>
              Frequently asked questions
            </h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
              {FAQ.map((item, i) => (
                <div
                  key={i}
                  style={{
                    padding: "20px 0",
                    borderBottom: "1px solid var(--border)",
                  }}
                >
                  <div style={{ fontWeight: 600, marginBottom: 8, fontSize: 15 }}>{item.q}</div>
                  <div style={{ color: "var(--text-dim)", fontSize: 14, lineHeight: 1.6 }}>{item.a}</div>
                </div>
              ))}
            </div>
          </section>

          {/* Footer */}
          <footer
            style={{
              marginTop: 72,
              paddingTop: 32,
              borderTop: "1px solid var(--border)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              fontSize: 13,
              color: "var(--text-dim)",
              flexWrap: "wrap",
              gap: 12,
            }}
          >
            <span>© 2026 Tony Apple QA Studio</span>
            <div style={{ display: "flex", gap: 20 }}>
              <a href="/pricing" style={{ color: "var(--text-dim)", textDecoration: "none" }}>Pricing</a>
              <a href="/lp/design-partners" style={{ color: "var(--text-dim)", textDecoration: "none" }}>Design Partners</a>
              <a href="mailto:hello@tonyappleqa.com" style={{ color: "var(--text-dim)", textDecoration: "none" }}>Contact</a>
            </div>
          </footer>
        </div>
      </div>
    </>
  );
}
