import { ImageResponse } from "next/og";

export const runtime = "edge";

function readParam(value: string | null, fallback: string): string {
  const normalized = value?.trim();
  return normalized ? normalized.slice(0, 160) : fallback;
}

function clamp(value: string, max: number): string {
  if (value.length <= max) return value;
  return `${value.slice(0, max - 1).trimEnd()}…`;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const eyebrow = readParam(searchParams.get("eyebrow"), "InsightAlpha AI");
  const title = clamp(readParam(searchParams.get("title"), "Institutional-grade market intelligence"), 72);
  const takeaway = clamp(readParam(searchParams.get("takeaway"), "See what changed, why it matters and where to look next."), 110);
  const context = clamp(readParam(searchParams.get("context"), "Make your insight legible outside the app."), 130);
  const scoreLabel = readParam(searchParams.get("scoreLabel"), "");
  const scoreValue = readParam(searchParams.get("scoreValue"), "");

  return new ImageResponse(
    (
      <div
        style={{
          width: 1200,
          height: 630,
          display: "flex",
          flexDirection: "column",
          background: "linear-gradient(135deg, #050816 0%, #0F172A 55%, #111827 100%)",
          padding: 0,
          fontFamily: "Arial, Helvetica, sans-serif",
          position: "relative",
        }}
      >
        {/* Glow accent */}
        <div
          style={{
            position: "absolute",
            top: 0,
            right: 0,
            width: 520,
            height: 520,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(245,158,11,0.22) 0%, transparent 70%)",
          }}
        />

        {/* Card border frame */}
        <div
          style={{
            position: "absolute",
            inset: 36,
            borderRadius: 28,
            border: "1.5px solid rgba(245,158,11,0.22)",
            background: "rgba(15,23,42,0.70)",
            display: "flex",
            flexDirection: "column",
            padding: "52px 64px 48px 64px",
            justifyContent: "space-between",
          }}
        >
          {/* Top section */}
          <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
            {/* Eyebrow row */}
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 28 }}>
              <div
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: "50%",
                  background: "#F59E0B",
                  flexShrink: 0,
                }}
              />
              <span
                style={{
                  color: "#FBBF24",
                  fontSize: 18,
                  fontWeight: 700,
                  letterSpacing: 4,
                  textTransform: "uppercase",
                }}
              >
                {eyebrow}
              </span>

              {scoreLabel && scoreValue && (
                <div
                  style={{
                    marginLeft: "auto",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    background: "rgba(255,255,255,0.05)",
                    border: "1px solid rgba(255,255,255,0.12)",
                    borderRadius: 16,
                    padding: "10px 24px",
                    minWidth: 100,
                  }}
                >
                  <span style={{ color: "#94A3B8", fontSize: 13, fontWeight: 700, letterSpacing: 3, textTransform: "uppercase" }}>
                    {scoreLabel}
                  </span>
                  <span style={{ color: "#F8FAFC", fontSize: 30, fontWeight: 800, marginTop: 2 }}>
                    {scoreValue}
                  </span>
                </div>
              )}
            </div>

            {/* Title */}
            <div
              style={{
                color: "#F8FAFC",
                fontSize: 52,
                fontWeight: 800,
                lineHeight: 1.15,
                marginBottom: 24,
                maxWidth: 980,
              }}
            >
              {title}
            </div>

            {/* Takeaway */}
            <div
              style={{
                color: "#E2E8F0",
                fontSize: 26,
                fontWeight: 600,
                lineHeight: 1.4,
                marginBottom: 16,
                maxWidth: 940,
              }}
            >
              {takeaway}
            </div>

            {/* Context */}
            <div
              style={{
                color: "#94A3B8",
                fontSize: 20,
                fontWeight: 400,
                lineHeight: 1.5,
                maxWidth: 900,
              }}
            >
              {context}
            </div>
          </div>

          {/* Footer */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              borderTop: "1px solid rgba(255,255,255,0.08)",
              paddingTop: 20,
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <span style={{ color: "#FBBF24", fontSize: 18, fontWeight: 700 }}>InsightAlpha AI</span>
              <span style={{ color: "#64748B", fontSize: 16, fontWeight: 400 }}>
                Retail clarity for institutional-grade market context
              </span>
            </div>
            <span style={{ color: "#CBD5E1", fontSize: 18, fontWeight: 700 }}>insightalpha.ai</span>
          </div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    },
  );
}
