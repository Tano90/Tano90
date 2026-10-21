import type { Industry } from "@/lib/industries";

// One illustration per industry, drawn for the GLB AI Suite, coloured only with design tokens.
const C = {
  cream: "var(--color-cream-deep)", accent: "var(--color-accent)", glow: "var(--color-accent-glow)", saffron: "var(--color-saffron)",
  carrot: "var(--color-carrot)", celery: "var(--color-celery)", onion: "var(--color-onion)", wood: "var(--color-wood)", woodDark: "var(--color-wood-dark)",
  white: "var(--color-on-accent)", line: "var(--color-border-input)", ink: "var(--color-ink)", soft: "var(--color-accent-subtle)",
};

function Blob() {
  return <path d="M70 200c0-90 80-150 190-150s200 50 200 140-70 170-200 170S70 290 70 200z" fill={C.cream} />;
}

function Restaurant() {
  return (
    <>
      <Blob />
      <ellipse cx="265" cy="214" rx="150" ry="120" fill={C.white} stroke={C.line} strokeWidth="2" />
      <ellipse cx="265" cy="214" rx="104" ry="82" fill={C.soft} />
      <ellipse cx="265" cy="214" rx="86" ry="66" fill={C.carrot} />
      <ellipse cx="248" cy="196" rx="40" ry="20" fill={C.saffron} opacity=".55" />
      {[[232, 214], [282, 196], [300, 236], [250, 246], [272, 222]].map(([x, y], i) => <rect key={i} x={x} y={y} width="14" height="14" rx="4" fill={i % 2 ? C.celery : C.onion} transform={`rotate(${i * 17} ${x + 7} ${y + 7})`} />)}
      <rect x="440" y="110" width="12" height="200" rx="6" fill={C.line} />
      <path d="M432 110v50a14 14 0 0 0 28 0v-50" stroke={C.line} strokeWidth="6" fill="none" />
      <rect x="82" y="120" width="12" height="190" rx="6" fill={C.line} />
      <path d="M88 110c22 0 22 60 0 70" fill={C.line} />
      {[[120, 90], [430, 330], [300, 60]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r="5" fill={C.saffron} />)}
    </>
  );
}

function Catering() {
  return (
    <>
      <Blob />
      <rect x="110" y="276" width="320" height="18" rx="9" fill={C.woodDark} />
      <path d="M140 276a130 130 0 0 1 260 0z" fill={C.accent} />
      <path d="M170 250a100 100 0 0 1 70-80" stroke={C.white} strokeWidth="8" strokeLinecap="round" fill="none" opacity=".35" />
      <circle cx="270" cy="140" r="14" fill={C.ink} />
      <rect x="330" y="300" width="110" height="40" rx="10" fill={C.saffron} />
      <rect x="350" y="290" width="70" height="14" rx="6" fill={C.wood} />
      <rect x="90" y="300" width="110" height="40" rx="10" fill={C.celery} />
      <rect x="110" y="290" width="70" height="14" rx="6" fill={C.wood} />
      {[[100, 120], [450, 150], [280, 70]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r="5" fill={C.saffron} />)}
    </>
  );
}

function Kantine() {
  return (
    <>
      <Blob />
      <rect x="100" y="120" width="340" height="210" rx="26" fill={C.line} />
      <rect x="100" y="112" width="340" height="210" rx="26" fill={C.white} stroke={C.line} strokeWidth="2" />
      <rect x="124" y="136" width="170" height="96" rx="14" fill={C.carrot} />
      <rect x="306" y="136" width="110" height="96" rx="14" fill={C.celery} />
      <rect x="124" y="244" width="110" height="56" rx="14" fill={C.saffron} />
      <rect x="246" y="244" width="170" height="56" rx="14" fill={C.soft} />
      {[[150, 160], [190, 176], [234, 156], [170, 200], [250, 196]].map(([x, y], i) => <rect key={i} x={x} y={y} width="16" height="16" rx="4" fill={C.onion} transform={`rotate(${i * 13} ${x + 8} ${y + 8})`} />)}
      <circle cx="330" cy="272" r="16" fill={C.accent} />
      <circle cx="370" cy="272" r="16" fill={C.glow} />
      {[[90, 100], [460, 320], [280, 80]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r="5" fill={C.saffron} />)}
    </>
  );
}

const SCENES = { restaurant: Restaurant, catering: Catering, kantine: Kantine } as const;

export function Scene({ industry, className }: { industry: Industry["slug"]; className?: string }) {
  const S = SCENES[industry];
  return <svg viewBox="40 40 460 320" className={className} aria-hidden><S /></svg>;
}
