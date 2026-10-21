import { ImageResponse } from "next/og";
import tokens from "@/styles/tokens.json";
import { APP_NAME, APP_SHORT } from "@/lib/brand";

// The preview image when the site is shared (LinkedIn, WhatsApp, Slack). Colours come from the design tokens.
export const alt = `${APP_NAME}: Gastro führen mit echten Zahlen.`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const c = tokens.color;
// The 32-unit mark scaled by 3.5.
const bar = (x: number, y: number, h: number) => <div style={{ position: "absolute", left: x * 3.5, top: y * 3.5, width: 4.5 * 3.5, height: h * 3.5, borderRadius: 5, background: c["on-accent"] }} />;

export default function OgImage() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 72, background: `radial-gradient(60% 70% at 85% 10%, ${c.accent} 0%, ${c.ink} 70%)`, color: c["on-ink"], fontFamily: "sans-serif" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div style={{ position: "relative", width: 112, height: 112, borderRadius: 28, background: c.accent, display: "flex" }}>
            {bar(7, 17, 8)}{bar(13.75, 13, 12)}{bar(20.5, 9, 16)}
            <div style={{ position: "absolute", left: 22 * 3.5, top: 4 * 3.5, width: 17.5, height: 17.5, borderRadius: 9, background: c.saffron }} />
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 16 }}><span style={{ fontSize: 72, fontWeight: 800, letterSpacing: -2 }}>{APP_SHORT}</span><span style={{ fontSize: 40, fontWeight: 600, color: c["on-ink-muted"] }}>{APP_NAME.slice(APP_SHORT.length).trim()}</span></div>
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 84, fontWeight: 800, lineHeight: 1.05, letterSpacing: -3, display: "flex", flexWrap: "wrap" }}>
            Gastro führen mit&nbsp;<span style={{ color: c.saffron }}>echten Zahlen.</span>
          </div>
          <div style={{ fontSize: 32, marginTop: 24, color: c["on-ink-muted"] }}>Controlling, Kalkulation, Warenwirtschaft und Einkauf in einer Suite.</div>
        </div>
      </div>
    ),
    size,
  );
}
