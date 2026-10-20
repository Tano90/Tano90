"use client";

import { AlertTriangle, ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { archiveMenu, saveMenu } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { Field, Input, Select } from "@/components/ui/field";
import { MoneyInput, parseCents } from "@/components/ui/money-input";
import { parseQuantity } from "@/components/ui/quantity-input";
import { toast } from "@/components/ui/toast";
import type { Menu } from "@/data/types";
import { cn } from "@/lib/cn";
import { formatBp, formatCents } from "@/lib/format";

type RecipeOption = { id: string; name: string; perPortionCents: number; missing: number };
type Item = { key: string; recipeId: string; portions: string };
type Course = { key: string; name: string; items: Item[] };

const str = (n: number | null | undefined, f = 1) => (n == null ? "" : String(n / f).replace(".", ","));
const pctToBp = (v: string) => (v.trim() ? Math.round((parseQuantity(v) ?? 0) * 100) : null);
const cents = (n: number) => formatCents(Math.round(n));
let keySeq = 0;
const key = () => `k${++keySeq}`;

export function MenuEditor({ menu, recipes, categories, defaultVatBp, canEdit }: {
  menu: Menu | null; recipes: RecipeOption[]; categories: { value: string; label: string }[]; defaultVatBp: number; canEdit: boolean;
}) {
  const router = useRouter();
  const byId = new Map(recipes.map((r) => [r.id, r]));
  const [f, setF] = useState({
    name: menu?.name ?? "",
    categoryId: menu?.categoryId ?? "",
    price: str(menu?.priceCents, 100),
    includesVat: menu?.priceIncludesVat ?? true,
    vat: str(menu?.vatBp ?? defaultVatBp, 100),
    target: str(menu?.targetMarginBp ?? 7000, 100),
    validFrom: menu?.validFrom ?? "",
    validTo: menu?.validTo ?? "",
  });
  const [courses, setCourses] = useState<Course[]>(
    menu?.courses.map((c) => ({ key: key(), name: c.name, items: c.items.map((i) => ({ key: key(), recipeId: i.recipeId, portions: str(i.portions) })) }))
      ?? [{ key: key(), name: "Vorspeise", items: [] }, { key: key(), name: "Hauptgang", items: [] }, { key: key(), name: "Dessert", items: [] }],
  );
  const [error, setError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, startSave] = useTransition();
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const field = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setF({ ...f, [k]: e.target.value });
    setDirty(true);
  };
  const editCourses = (next: Course[]) => {
    setCourses(next);
    setDirty(true);
  };
  const editCourse = (ci: number, patch: Partial<Course>) => editCourses(courses.map((c, i) => (i === ci ? { ...c, ...patch } : c)));
  const editItem = (ci: number, ii: number, patch: Partial<Item>) =>
    editCourse(ci, { items: courses[ci].items.map((it, i) => (i === ii ? { ...it, ...patch } : it)) });
  const move = (ci: number, by: -1 | 1) => {
    const next = [...courses];
    [next[ci], next[ci + by]] = [next[ci + by], next[ci]];
    editCourses(next);
  };

  // Live costing from the recipes' current cost per portion: the same numbers the recipe list shows.
  let costCents = 0;
  let missing = 0;
  const courseCost = courses.map((c) =>
    c.items.reduce((sum, it) => {
      const r = byId.get(it.recipeId);
      const p = parseQuantity(it.portions) ?? 0;
      if (!r || !p) return sum;
      if (r.missing > 0) missing++;
      return sum + r.perPortionCents * p;
    }, 0),
  );
  costCents = courseCost.reduce((a, b) => a + b, 0);
  const vatBp = pctToBp(f.vat) ?? defaultVatBp;
  const price = parseCents(f.price);
  const net = price ? (f.includesVat ? price / (1 + vatBp / 10000) : price) : null;
  const marginBp = net ? Math.round(((net - costCents) / net) * 10000) : null;
  const target = pctToBp(f.target);
  const below = marginBp !== null && target !== null && marginBp < target;

  const save = () =>
    startSave(async () => {
      const res = await saveMenu({
        id: menu?.id,
        name: f.name,
        categoryId: f.categoryId || null,
        priceCents: price,
        priceIncludesVat: f.includesVat,
        vatBp: pctToBp(f.vat),
        targetMarginBp: target,
        validFrom: f.validFrom || null,
        validTo: f.validTo || null,
        courses: courses.map((c) => ({
          name: c.name,
          items: c.items.filter((it) => it.recipeId).map((it) => ({ recipeId: it.recipeId, portions: parseQuantity(it.portions) ?? 0 })),
        })),
      });
      if (!res.ok) return setError(res.error);
      setError(null);
      setDirty(false);
      toast.success("Menü gespeichert");
      if (!menu) router.push(`/menus/${res.data}`);
      else router.refresh();
    });

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_20rem]">
      <div className="flex min-w-0 flex-col gap-6">
        {error && <p role="alert" className="rounded-sm bg-danger-subtle px-3 py-2 text-danger">{error}</p>}
        <fieldset disabled={!canEdit} className="grid gap-4 md:grid-cols-6">
          <legend className="sr-only">Stammdaten</legend>
          <Field label="Name" required className="md:col-span-4">
            <Input value={f.name} onChange={field("name")} maxLength={120} />
          </Field>
          <Field label="Kategorie" className="md:col-span-2">
            <Select value={f.categoryId} onChange={field("categoryId")}>
              <option value="">Keine</option>
              {categories.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </Select>
          </Field>
          <Field label="Menüpreis pro Gast" className="md:col-span-3">
            <MoneyInput value={f.price} onValueChange={(v) => { setF({ ...f, price: v }); setDirty(true); }} vat={{ includesVat: f.includesVat, onChange: (v) => { setF({ ...f, includesVat: v }); setDirty(true); } }} />
          </Field>
          <Field label="Mehrwertsteuer (%)" className="md:col-span-1">
            <Input inputMode="decimal" className="text-right" value={f.vat} onChange={field("vat")} />
          </Field>
          <Field label="Zielmarge (%)" hint="Liegt das Menü darunter, wird es markiert." className="md:col-span-2">
            <Input inputMode="decimal" className="text-right" value={f.target} onChange={field("target")} />
          </Field>
          <Field label="Gültig ab" className="md:col-span-3">
            <Input type="date" value={f.validFrom} onChange={field("validFrom")} />
          </Field>
          <Field label="Gültig bis" className="md:col-span-3">
            <Input type="date" value={f.validTo} onChange={field("validTo")} />
          </Field>
        </fieldset>

        <section aria-labelledby="courses" className="flex flex-col gap-4">
          <h2 id="courses" className="text-lg">Gänge</h2>
          {courses.map((c, ci) => {
            const label = c.name.trim() || `Gang ${ci + 1}`;
            return (
              <fieldset key={c.key} disabled={!canEdit} className="flex flex-col gap-3 rounded-md border border-border bg-bg p-4">
                <legend className="sr-only">{label}</legend>
                <div className="flex flex-wrap items-end gap-2">
                  <Field label={`Gang ${ci + 1}`} className="min-w-48 flex-1">
                    <Input value={c.name} onChange={(e) => editCourse(ci, { name: e.target.value })} maxLength={80} />
                  </Field>
                  <span className="num pb-2 text-text-muted">{cents(courseCost[ci])}</span>
                  {canEdit && (
                    <span className="flex gap-1">
                      <Button variant="ghost" size="sm" aria-label={`${label} nach oben`} disabled={ci === 0} onClick={() => move(ci, -1)}><ArrowUp aria-hidden className="size-4" /></Button>
                      <Button variant="ghost" size="sm" aria-label={`${label} nach unten`} disabled={ci === courses.length - 1} onClick={() => move(ci, 1)}><ArrowDown aria-hidden className="size-4" /></Button>
                      <Button variant="ghost" size="sm" aria-label={`${label} entfernen`} onClick={() => editCourses(courses.filter((_, i) => i !== ci))}><Trash2 aria-hidden className="size-4" /></Button>
                    </span>
                  )}
                </div>
                <ul className="flex flex-col gap-2">
                  {c.items.map((it, ii) => {
                    const r = byId.get(it.recipeId);
                    const p = parseQuantity(it.portions) ?? 0;
                    return (
                      <li key={it.key} className="flex flex-wrap items-center gap-2">
                        <Select aria-label={`Gericht ${ii + 1} in ${label}`} className="w-full sm:w-auto sm:min-w-48 sm:flex-1" value={it.recipeId} onChange={(e) => editItem(ci, ii, { recipeId: e.target.value })}>
                          <option value="">Rezept wählen …</option>
                          {recipes.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                        </Select>
                        <Input aria-label={`Portionen für Gericht ${ii + 1} in ${label}`} inputMode="decimal" className="w-20 text-right" value={it.portions} onChange={(e) => editItem(ci, ii, { portions: e.target.value.replace(/[^\d,]/g, "") })} />
                        <span className="w-6 text-text-muted">Port.</span>
                        <span className="num w-20 text-right">
                          {r && r.missing > 0 && <AlertTriangle className="mr-1 inline size-4 text-warning" aria-label="Preis unvollständig" />}
                          {r && p ? cents(r.perPortionCents * p) : "–"}
                        </span>
                        {canEdit && (
                          <Button variant="ghost" size="sm" aria-label={`Gericht ${ii + 1} aus ${label} entfernen`} onClick={() => editCourse(ci, { items: c.items.filter((_, i) => i !== ii) })}>
                            <Trash2 aria-hidden className="size-4" />
                          </Button>
                        )}
                      </li>
                    );
                  })}
                  {c.items.length === 0 && <li className="text-text-muted">Noch kein Gericht in diesem Gang.</li>}
                </ul>
                {canEdit && (
                  <div>
                    <Button variant="secondary" size="sm" onClick={() => editCourse(ci, { items: [...c.items, { key: key(), recipeId: "", portions: "1" }] })}>
                      <Plus aria-hidden className="size-4" /> Gericht zu {label}
                    </Button>
                  </div>
                )}
              </fieldset>
            );
          })}
          {canEdit && (
            <div>
              <Button variant="secondary" onClick={() => editCourses([...courses, { key: key(), name: "", items: [] }])}>
                <Plus aria-hidden className="size-4" /> Gang hinzufügen
              </Button>
            </div>
          )}
        </section>
      </div>

      <aside aria-label="Kalkulation" className="flex flex-col gap-3 xl:sticky xl:top-20 xl:self-start">
        <div className="rounded-md border border-border bg-surface-raised p-4 shadow-card" aria-live="polite">
          <p className="text-xs font-normal text-text-muted">Wareneinsatz pro Gast</p>
          <p className="num text-xl">{cents(costCents)}</p>
          {missing > 0 && (
            <p className="mt-1 flex items-start gap-1 text-xs text-warning">
              <AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0" />
              {missing} Gericht(e) mit fehlenden Preisen – der echte Wareneinsatz liegt höher.
            </p>
          )}
          <dl className="mt-4 grid grid-cols-[1fr_auto] gap-x-4 gap-y-2 text-sm">
            <dt className="text-text-muted">Menüpreis netto</dt>
            <dd className="num text-right">{net ? cents(net) : "–"}</dd>
            <dt className="text-text-muted">Rohertrag pro Gast</dt>
            <dd className="num text-right">{net ? cents(net - costCents) : "–"}</dd>
            <dt className="text-text-muted">Wareneinsatz</dt>
            <dd className="num text-right">{net ? formatBp(Math.round((costCents / net) * 10000)) : "–"}</dd>
          </dl>
          {marginBp !== null && (
            <div className="mt-4">
              <div className="flex items-baseline justify-between">
                <span className="text-xs text-text-muted">Marge</span>
                <span className={cn("num font-semibold", below ? "text-danger" : "text-success")}>
                  {formatBp(marginBp)}{target !== null && ` (Ziel ${formatBp(target)})`}
                </span>
              </div>
              <div className="mt-1 h-2 overflow-hidden rounded-pill bg-surface-sunken" aria-hidden>
                <div className={cn("h-full", below ? "bg-danger" : "bg-success")} style={{ width: `${Math.min(Math.max(marginBp / 100, 0), 100)}%` }} />
              </div>
            </div>
          )}
        </div>
        {canEdit && (
          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={save} loading={saving}>{menu ? "Speichern" : "Menü anlegen"}</Button>
            {dirty && <span className="text-xs font-normal text-text-muted" role="status">Ungespeicherte Änderungen</span>}
            {menu && <ArchiveMenu id={menu.id} name={menu.name} />}
          </div>
        )}
      </aside>
    </div>
  );
}

function ArchiveMenu({ id, name }: { id: string; name: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={setOpen}
      trigger={<Button variant="ghost">Archivieren</Button>}
      title={`„${name}“ archivieren?`}
      description="Das Menü verschwindet aus der Liste. Die Rezepte bleiben unverändert."
      confirmLabel="Archivieren"
      danger
      loading={pending}
      onConfirm={() =>
        start(async () => {
          const res = await archiveMenu(id);
          setOpen(false);
          if (!res.ok) return void toast.error("Archivieren nicht möglich", { description: res.error });
          router.push("/menus");
        })
      }
    />
  );
}
