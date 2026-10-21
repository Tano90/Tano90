import { Check, ClipboardList, Send, Thermometer, TrendingDown } from "lucide-react";
import { cn } from "@/lib/cn";

// Our own illustration: a mirepoix on a cutting board (carrot, celery, onion, diced), the dish the name comes from.
// The floating cards show what Mirepa does with it. Their values are examples in the style of the demo data.

type Cube = [x: number, y: number, rot: number, kind: "carrot" | "celery" | "onion"];
const CUBES: Cube[] = [
  [168, 196, -8, "carrot"], [204, 182, 12, "carrot"], [186, 228, 4, "carrot"], [226, 222, -14, "carrot"], [150, 236, 18, "carrot"],
  [262, 172, 6, "celery"], [298, 190, -10, "celery"], [276, 214, 16, "celery"], [312, 232, -4, "celery"], [250, 250, 9, "celery"],
  [340, 196, -6, "onion"], [372, 214, 14, "onion"], [350, 244, -16, "onion"], [384, 252, 5, "onion"], [326, 270, 11, "onion"],
  [214, 262, -3, "carrot"], [290, 280, 7, "celery"], [400, 182, -12, "carrot"],
];
const FILL = { carrot: "var(--color-carrot)", celery: "var(--color-celery)", onion: "var(--color-onion)" } as const;

function Board() {
  return (
    <svg viewBox="0 0 560 440" className="h-auto w-full" aria-hidden>
      <path d="M92 214c0-96 92-168 214-170 120-2 196 66 196 160 0 104-86 196-214 196C164 400 92 314 92 214z" fill="var(--color-cream-deep)" />
      <g transform="rotate(-7 290 236)">
        <rect x="104" y="140" width="352" height="196" rx="28" fill="var(--color-wood-dark)" />
        <rect x="104" y="132" width="352" height="196" rx="28" fill="var(--color-wood)" />
        <circle cx="424" cy="166" r="11" fill="var(--color-wood-dark)" />
        <path d="M140 300c60 8 140 10 210 2" stroke="var(--color-wood-dark)" strokeWidth="3" strokeLinecap="round" fill="none" opacity=".35" />
      </g>
      {CUBES.map(([x, y, rot, kind], i) => (
        <g key={i} transform={`rotate(${rot} ${x + 13} ${y + 13})`}>
          <rect x={x} y={y + 3} width="26" height="26" rx="6" fill="var(--color-text)" opacity=".12" />
          <rect x={x} y={y} width="26" height="26" rx="6" fill={FILL[kind]} stroke={kind === "onion" ? "var(--color-cream-deep)" : "none"} strokeWidth="2" />
          <rect x={x + 5} y={y + 4} width="10" height="4" rx="2" fill="var(--color-on-accent)" opacity=".45" />
        </g>
      ))}
      <g transform="rotate(-24 430 300)">
        <rect x="350" y="292" width="120" height="20" rx="10" fill="var(--color-border-input)" />
        <rect x="350" y="292" width="120" height="8" rx="4" fill="var(--color-on-accent)" opacity=".6" />
        <rect x="462" y="288" width="70" height="28" rx="12" fill="var(--color-accent)" />
        <circle cx="482" cy="302" r="3" fill="var(--color-saffron)" /><circle cx="512" cy="302" r="3" fill="var(--color-saffron)" />
      </g>
      {[[120, 110], [470, 120], [480, 360], [110, 340], [300, 70]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r="5" fill="var(--color-saffron)" />)}
    </svg>
  );
}

function Card({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn("absolute rounded-md border border-border bg-bg/95 p-3 shadow-pop backdrop-blur-sm", className)}>{children}</div>;
}

export function HeroArt() {
  return (
    <div className="relative mx-auto w-full max-w-xl">
      <Board />
      <Card className="top-[2%] left-0 w-44 animate-float sm:w-48">
        <p className="flex items-center gap-1 text-xs text-text-muted"><TrendingDown aria-hidden className="size-3.5 text-success" /> Wareneinsatz / Portion</p>
        <p className="num text-xl">0,63 €</p>
        <div className="mt-1 h-1.5 rounded-pill bg-surface-sunken"><div className="h-1.5 w-[28%] rounded-pill bg-accent" /></div>
        <p className="mt-1 text-xs text-text-muted">8,5 % · Ziel 30 %</p>
      </Card>
      <Card className="top-[6%] right-0 hidden w-56 animate-float [animation-delay:1.5s] sm:block">
        <p className="flex items-center gap-2 text-sm font-semibold"><span className="inline-flex size-6 items-center justify-center rounded-pill bg-accent-subtle text-accent"><Send aria-hidden className="size-3.5" /></span> Bestellung ist raus</p>
        <p className="mt-1 text-xs text-text-muted">Frischehof · 6 Artikel · 84,20 €</p>
      </Card>
      <Card className="bottom-[4%] left-[4%] hidden w-44 animate-float [animation-delay:3s] sm:block">
        <p className="flex items-center gap-2 text-sm font-semibold"><ClipboardList aria-hidden className="size-4 text-accent" /> Inventur</p>
        <p className="mt-1 text-xs text-text-muted">12 von 18 gezählt, offline gespeichert</p>
        <div className="mt-2 flex gap-1">{Array.from({ length: 18 }, (_, i) => <span key={i} className={cn("h-1.5 flex-1 rounded-pill", i < 12 ? "bg-celery" : "bg-surface-sunken")} />)}</div>
      </Card>
      <Card className="right-[2%] bottom-0 w-48 animate-float [animation-delay:4.5s]">
        <p className="flex items-center gap-2 text-sm font-semibold"><Thermometer aria-hidden className="size-4 text-accent" /> Kühlraum 3,5 °C</p>
        <p className="mt-1 flex items-center gap-1 text-xs text-success"><Check aria-hidden className="size-3.5" /> im Soll · HACCP eingetragen</p>
      </Card>
    </div>
  );
}
