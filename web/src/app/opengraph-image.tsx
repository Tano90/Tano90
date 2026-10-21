import { ImageResponse } from "next/og";
import tokens from "@/styles/tokens.json";
import { APP_NAME } from "@/lib/brand";

// The preview image when the site is shared (LinkedIn, WhatsApp, Slack). Colours come from the design tokens.
export const alt = `${APP_NAME}: Was jeder Teller kostet. Live.`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const c = tokens.color;
const cube = (x: number, y: number, fill: string, rotate = 0) => (
  <div style={{ position: "absolute", left: x, top: y, width: 21, height: 21, borderRadius: 5, background: fill, transform: `rotate(${rotate}deg)` }} />
);

export default function OgImage() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 72, background: `radial-gradient(60% 70% at 85% 10%, ${c.accent} 0%, ${c.ink} 70%)`, color: c["on-ink"], fontFamily: "sans-serif" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div style={{ position: "relative", width: 112, height: 112, borderRadius: 28, background: c.accent, display: "flex" }}>
            {/* the 32-unit mark scaled by 3.5 */}{cube(21, 31.5, c["on-accent"])}{cube(21, 59.5, c["on-accent"])}{cube(45.5, 42, c.saffron, 8)}{cube(70, 31.5, c["on-accent"])}{cube(70, 59.5, c["on-accent"])}
          </div>
          <div style={{ fontSize: 64, fontWeight: 800, letterSpacing: -2 }}>{APP_NAME.toLowerCase()}</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 84, fontWeight: 800, lineHeight: 1.05, letterSpacing: -3, display: "flex", flexWrap: "wrap" }}>
            Was jeder Teller kostet.&nbsp;<span style={{ color: c.saffron }}>Live.</span>
          </div>
          <div style={{ fontSize: 32, marginTop: 24, color: c["on-ink-muted"] }}>Rezepte, Einkauf, Lager und Zentralküche in einem Werkzeug.</div>
        </div>
      </div>
    ),
    size,
  );
}
