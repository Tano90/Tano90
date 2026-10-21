"use client";

import { Camera, ClipboardList, Package as PackageIcon, ScanBarcode } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { closeCount, saveCountLines, startCount } from "@/app/actions";
import { Notice } from "@/components/app/notice";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { FilterBar } from "@/components/ui/filter-bar";
import { toast } from "@/components/ui/toast";
import { cleanDecimal } from "@/components/ui/money-input";
import type { CountBreakdown } from "@/domain/stock";
import type { BaseUnit } from "@/domain/units";
import { formatDate } from "@/lib/dates";
import { formatCents, formatQty } from "@/lib/format";
import { gtinKey } from "@/lib/gtin";
import { formatBase } from "@/lib/units-display";

type Item = { id: string; name: string; category: string; baseUnit: BaseUnit; expectedBase: number };
// Count in the unit people count in: kg, l, pieces.
const FACTOR: Record<BaseUnit, number> = { g: 1000, ml: 1000, piece: 1 };
const LABEL: Record<BaseUnit, string> = { g: "kg", ml: "l", piece: "Stk." };

export function StartCount({ past }: { past: { id: string; closedAt: string | null; lines: number; valueCents: number; by: string }[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-md border border-border bg-bg">
        <EmptyState
          icon={ClipboardList}
          title="Keine Inventur offen"
          body="Starte eine Inventur, zähle in Ruhe und schließe sie ab. Nicht gezählte Artikel behalten ihren Bestand."
          action={
            <Button
              loading={pending}
              onClick={() =>
                start(async () => {
                  const res = await startCount();
                  if (!res.ok) {
                    toast.error(res.error);
                    return;
                  }
                  router.refresh();
                })
              }
            >
              Inventur starten
            </Button>
          }
        />
      </div>
      {past.length > 0 && (
        <section aria-labelledby="past">
          <h2 id="past" className="mb-2 text-lg">Letzte Inventuren</h2>
          <ul className="divide-y divide-border rounded-md border border-border bg-bg">
            {past.map((p) => (
              <li key={p.id} className="flex flex-wrap justify-between gap-2 px-4 py-3">
                <span>{formatDate(p.closedAt)} · {p.by}</span>
                <span className="num text-text-muted">{p.lines} Differenzen · {formatCents(Math.round(p.valueCents))}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

type Pack = { id: string; label: string; quantityBase: number };
type PackValues = Record<string, string>; // package id or "loose" -> typed text
const num = (raw: string) => (raw.trim() ? Number(raw.replace(",", ".")) : 0);

export function CountSheet({ eventId, draft, breakdown, packages, items, barcodes }: {
  eventId: string; draft: Record<string, number>; breakdown: Record<string, CountBreakdown>; packages: Record<string, Pack[]>; items: Item[];
  barcodes: Record<string, { ingredientId: string; packageId: string }>;
}) {
  const router = useRouter();
  const unitOf = (id: string) => items.find((i) => i.id === id)?.baseUnit ?? "g";
  const [values, setValues] = useState<Record<string, string>>(
    Object.fromEntries(Object.entries(draft).map(([id, base]) => [id, formatQty(base / FACTOR[unitOf(id)])])),
  );
  // Items counted in packages: what was typed per package, plus the loose rest in kg, l or pieces.
  const [packValues, setPackValues] = useState<Record<string, PackValues>>(
    Object.fromEntries(Object.entries(breakdown).map(([id, b]) => [id, {
      ...Object.fromEntries(Object.entries(b.packs).map(([pk, n]) => [pk, formatQty(n)])),
      loose: b.looseBase ? formatQty(b.looseBase / FACTOR[unitOf(id)]) : "",
    }])),
  );
  const [query, setQuery] = useState("");
  const [saved, setSaved] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [pending, start] = useTransition();
  const [confirm, setConfirm] = useState(false);
  const dirty = useRef<Record<string, number | CountBreakdown | null>>({});
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Save the sheet a moment after typing stops, so a dead spot in the cold room costs seconds, not the count.
  const flush = async () => {
    const batch = dirty.current;
    if (!Object.keys(batch).length) return true;
    dirty.current = {};
    setSaved("saving");
    // A dropped connection makes the action call itself throw, not return an error result.
    const res = await saveCountLines(eventId, batch).catch(() => ({ ok: false as const, error: "offline" }));
    if (!res.ok) {
      dirty.current = { ...batch, ...dirty.current };
      setSaved("error");
      return false;
    }
    setSaved("saved");
    return true;
  };
  // While saving fails (offline), retry every few seconds and as soon as the browser is back online.
  useEffect(() => {
    if (saved !== "error") return;
    const retry = () => void flush();
    const t = setInterval(retry, 5000);
    window.addEventListener("online", retry);
    return () => {
      clearInterval(t);
      window.removeEventListener("online", retry);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saved]);
  useEffect(() => () => clearTimeout(timer.current), []);

  const change = (it: Item, raw: string) => {
    const clean = cleanDecimal(raw);
    setValues({ ...values, [it.id]: clean });
    const n = clean.trim() ? Number(clean.replace(",", ".")) : null;
    dirty.current[it.id] = n === null || Number.isNaN(n) ? null : n * FACTOR[it.baseUnit];
    clearTimeout(timer.current);
    timer.current = setTimeout(flush, 600);
  };

  const changePack = (it: Item, key: string, raw: string) => {
    const pv = { ...packValues[it.id], [key]: cleanDecimal(raw) };
    setPackValues({ ...packValues, [it.id]: pv });
    const packs = Object.fromEntries((packages[it.id] ?? []).filter((p) => pv[p.id]?.trim()).map((p) => [p.id, num(pv[p.id])]));
    const looseBase = num(pv.loose ?? "") * FACTOR[it.baseUnit];
    const empty = !Object.keys(packs).length && !pv.loose?.trim();
    const total = (packages[it.id] ?? []).reduce((sum, p) => sum + (packs[p.id] ?? 0) * p.quantityBase, looseBase);
    setValues((v) => ({ ...v, [it.id]: empty ? "" : formatQty(total / FACTOR[it.baseUnit]) }));
    dirty.current[it.id] = empty || Object.values(packs).some(Number.isNaN) || Number.isNaN(looseBase) ? null : { packs, looseBase };
    clearTimeout(timer.current);
    timer.current = setTimeout(flush, 600);
  };
  const togglePacks = (it: Item) => {
    if (packValues[it.id]) {
      // Back to a plain total: keep the sum that was counted.
      const { [it.id]: _, ...rest } = packValues;
      setPackValues(rest);
      change(it, values[it.id] ?? "");
    } else setPackValues({ ...packValues, [it.id]: {} });
  };

  // A scan counts one more of the scanned package (USB/Bluetooth scanners type the code and press Enter).
  const [scanMsg, setScanMsg] = useState<string | null>(null);
  const scan = (raw: string) => {
    const code = raw.replace(/\D/g, "");
    if (!code) return;
    const hit = barcodes[gtinKey(code)];
    const it = hit && items.find((i) => i.id === hit.ingredientId);
    const pack = hit && (packages[hit.ingredientId] ?? []).find((p) => p.id === hit.packageId);
    if (!it || !pack) {
      setScanMsg(`Barcode ${code} ist keinem Artikel zugeordnet. Hinterlege ihn bei der Zutat unter „Gebinde & Preise“.`);
      return;
    }
    const before = Number((packValues[it.id]?.[pack.id] ?? "0").replace(",", ".")) || 0;
    changePack(it, pack.id, formatQty(before + 1));
    setScanMsg(`${it.name}: ${pack.label} +1, jetzt ${formatQty(before + 1)}`);
    setQuery("");
  };

  const shown = useMemo(() => items.filter((i) => !query || i.name.toLowerCase().includes(query.toLowerCase())), [items, query]);
  const counted = Object.values(values).filter((v) => v.trim()).length;

  return (
    <div className="flex flex-col gap-4">
      <Notice>Starte während einer offenen Inventur keine Lieferungen oder Umbuchungen für dieses Outlet – sonst stimmen die Differenzen nicht.</Notice>
      <Scanner onCode={scan} message={scanMsg} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-56 flex-1"><FilterBar query={query} onQueryChange={setQuery} placeholder="Artikel suchen" /></div>
        <p role="status" className="text-xs text-text-muted">
          {counted} von {items.length} gezählt · {saved === "saving" ? "speichert …" : saved === "saved" ? "Zwischenstand gespeichert" : saved === "error" ? "Speichern fehlgeschlagen, wird erneut versucht" : "noch nichts gespeichert"}
        </p>
      </div>
      <ul className="flex flex-col divide-y divide-border rounded-md border border-border bg-bg">
        {shown.map((it) => {
          const id = `c-${it.id}`;
          const packs = packages[it.id] ?? [];
          const pv = packValues[it.id];
          return (
            <li key={it.id} className="flex flex-wrap items-center gap-3 px-3 py-2">
              <label htmlFor={id} className="min-w-40 flex-1">
                <span className="block font-semibold">{it.name}</span>
                <span className="block text-xs font-normal text-text-muted">{it.category} · laut System {formatBase(it.expectedBase, it.baseUnit)}</span>
              </label>
              <span className="flex items-center gap-2">
                <input
                  id={id}
                  inputMode="decimal"
                  className="num h-(--size-control-lg) w-28 rounded-sm border border-border-input bg-bg px-3 text-right text-base"
                  value={values[it.id] ?? ""}
                  placeholder="–"
                  readOnly={!!pv}
                  aria-describedby={pv ? `${id}-sum` : undefined}
                  onChange={(e) => change(it, e.target.value)}
                  onBlur={() => flush()}
                />
                <span className="w-8 text-text-muted">{LABEL[it.baseUnit]}</span>
                {packs.length > 0 && (
                  <Button variant="ghost" size="sm" aria-expanded={!!pv} aria-controls={`${id}-packs`} aria-label={`${it.name} in Gebinden zählen`} onClick={() => togglePacks(it)}>
                    <PackageIcon aria-hidden className="size-4" /> Gebinde
                  </Button>
                )}
              </span>
              {pv && (
                <fieldset id={`${id}-packs`} className="flex w-full flex-wrap items-end gap-3 rounded-sm bg-surface-sunken p-3">
                  <legend className="sr-only">{it.name} in Gebinden</legend>
                  <p id={`${id}-sum`} className="sr-only">Summe aus den Gebinden</p>
                  {packs.map((p) => (
                    <label key={p.id} className="flex flex-col gap-1 text-xs">
                      <span><span className="sr-only">{it.name}: </span>{p.label}</span>
                      <input
                        inputMode="numeric"
                        className="num h-(--size-control-md) w-24 rounded-sm border border-border-input bg-bg px-3 text-right text-base"
                        value={pv[p.id] ?? ""}
                        placeholder="0"
                        onChange={(e) => changePack(it, p.id, e.target.value)}
                        onBlur={() => flush()}
                      />
                    </label>
                  ))}
                  <label className="flex flex-col gap-1 text-xs">
                    <span><span className="sr-only">{it.name}: </span>lose ({LABEL[it.baseUnit]})</span>
                    <input
                      inputMode="decimal"
                      className="num h-(--size-control-md) w-24 rounded-sm border border-border-input bg-bg px-3 text-right text-base"
                      value={pv.loose ?? ""}
                      placeholder="0"
                      onChange={(e) => changePack(it, "loose", e.target.value)}
                      onBlur={() => flush()}
                    />
                  </label>
                </fieldset>
              )}
            </li>
          );
        })}
        {shown.length === 0 && <li className="px-3 py-6 text-center text-text-muted">Kein Artikel passt zur Suche.</li>}
      </ul>
      <div className="flex flex-wrap gap-2">
        <ConfirmDialog
          open={confirm}
          onOpenChange={setConfirm}
          trigger={<Button disabled={pending}>Inventur abschließen</Button>}
          title="Inventur abschließen?"
          description={`${counted} Artikel gezählt. Für diese wird die Differenz zum Systembestand gebucht. ${items.length - counted} nicht gezählte Artikel behalten ihren Bestand. Das lässt sich nicht rückgängig machen.`}
          confirmLabel="Abschließen"
          loading={pending}
          onConfirm={() =>
            start(async () => {
              clearTimeout(timer.current);
              if (!(await flush())) {
                toast.error("Zwischenstand konnte nicht gespeichert werden. Bitte erneut versuchen.");
                return;
              }
              const res = await closeCount(eventId);
              setConfirm(false);
              if (!res.ok) {
                toast.error(res.error);
                return;
              }
              toast.success("Inventur abgeschlossen", { description: `${res.data.changed} Bestände angepasst.` });
              router.push("/stock");
            })
          }
        />
      </div>
    </div>
  );
}

type Detector = { detect: (source: HTMLVideoElement) => Promise<{ rawValue: string }[]> };
type DetectorClass = new (opts: { formats: string[] }) => Detector;

/** Barcode field (works with any scanner that types) plus the phone camera where the browser can read barcodes. */
function Scanner({ onCode, message }: { onCode: (code: string) => void; message: string | null }) {
  const [code, setCode] = useState("");
  const [camera, setCamera] = useState<DetectorClass | null>(null);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const D = (window as unknown as { BarcodeDetector?: DetectorClass }).BarcodeDetector;
    if (D && "mediaDevices" in navigator) setCamera(() => D); // no mediaDevices outside HTTPS
  }, []);
  return (
    <div className="flex flex-col gap-2 rounded-md border border-border bg-bg p-3">
      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          onCode(code);
          setCode("");
        }}
      >
        <label className="flex min-w-56 flex-1 flex-col gap-1 text-xs">
          <span className="inline-flex items-center gap-1"><ScanBarcode aria-hidden className="size-4" /> Barcode scannen oder eintippen</span>
          <input
            inputMode="numeric"
            autoComplete="off"
            className="num h-(--size-control-lg) rounded-sm border border-border-input bg-bg px-3 text-base"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
          />
        </label>
        <Button type="submit" variant="secondary">Zählen</Button>
        {camera && <Button variant="secondary" onClick={() => setOpen(true)}><Camera aria-hidden className="size-4" /> Kamera</Button>}
      </form>
      <p role="status" className="text-xs text-text-muted">{message ?? "Jeder Scan zählt ein Gebinde dazu."}</p>
      {open && camera && <CameraScan Detector={camera} onCode={(c) => { onCode(c); setOpen(false); }} onClose={() => setOpen(false)} />}
    </div>
  );
}

function CameraScan({ Detector, onCode, onClose }: { Detector: DetectorClass; onCode: (code: string) => void; onClose: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let stream: MediaStream | null = null;
    let stop = false;
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        if (!video.current) return;
        video.current.srcObject = stream;
        await video.current.play();
        const detector = new Detector({ formats: ["ean_13", "ean_8", "upc_a", "code_128"] });
        while (!stop) {
          const [hit] = await detector.detect(video.current).catch(() => []);
          if (hit?.rawValue) return onCode(hit.rawValue);
          await new Promise((r) => setTimeout(r, 200));
        }
      } catch {
        setError("Kein Zugriff auf die Kamera. Erlaube ihn in den Browser-Einstellungen oder tippe den Barcode ein.");
      }
    })();
    return () => {
      stop = true;
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [Detector, onCode]);
  return (
    <div className="flex flex-col gap-2">
      {error ? <p role="alert" className="text-danger">{error}</p> : <video ref={video} muted playsInline aria-label="Kamerabild für den Barcode" className="w-full max-w-sm rounded-sm bg-surface-sunken" />}
      <div><Button variant="ghost" size="sm" onClick={onClose}>Kamera schließen</Button></div>
    </div>
  );
}
