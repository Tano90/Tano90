"use client";

import { AlertTriangle } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { type RecipeInput, archiveRecipe, previewRecipe, saveRecipe, setRecipeOutletPrice } from "@/app/actions";
import { Notice } from "@/components/app/notice";
import { AllergenMatrix } from "@/components/ui/allergen-matrix";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { type Line, LineEditor } from "@/components/ui/line-editor";
import { MoneyInput, parseCents, readCents } from "@/components/ui/money-input";
import { UNITS, type Unit, parseQuantity } from "@/components/ui/quantity-input";
import { Tab, TabList, TabPanel, Tabs } from "@/components/ui/tabs";
import { toast } from "@/components/ui/toast";
import type { AllergenMap, AllergenStatus } from "@/domain/allergens";
import type { RecipeCost } from "@/domain/costing";
import { type BaseUnit } from "@/domain/units";
import type { Recipe } from "@/data/types";
import { cn } from "@/lib/cn";
import { formatBp, formatCents } from "@/lib/format";
import { formatBase } from "@/lib/units-display";

type Option = { value: string; label: string; hint: string; baseUnit: BaseUnit };
type Preview = { cost: RecipeCost; foodCostBp: number | null; prepCostCents: number | null; allergens: Record<string, AllergenStatus> };

type Props = {
  recipe: Recipe | null;
  usedIn: { id: string; name: string }[];
  options: Option[];
  categories: { value: string; label: string }[];
  defaultVatBp: number;
  canEdit: boolean;
  outlets: { id: string; name: string }[];
  outletPrices: { outletId: string; sellPriceCents: number }[];
};

const DEFAULT_UNIT: Record<BaseUnit, Unit> = { g: "g", ml: "ml", piece: "piece" };
const str = (n: number | null | undefined, f = 1) => (n == null ? "" : String(n / f).replace(".", ","));
const pctToBp = (v: string) => (v.trim() ? Math.round((parseQuantity(v) ?? 0) * 100) : null);
const cents = (n: number) => formatCents(Math.round(n));

export function RecipeEditor({ recipe, usedIn, options, categories, defaultVatBp, canEdit, outlets, outletPrices }: Props) {
  const router = useRouter();
  const byId = useMemo(() => new Map(options.map((o) => [o.value, o])), [options]);
  const isSub = (id: string | null) => !!id && byId.get(id)?.hint === "Unterrezept";

  const [f, setF] = useState({
    name: recipe?.name ?? "",
    categoryId: recipe?.categoryId ?? "",
    productType: recipe?.productType ?? "finished",
    portions: str(recipe?.portions ?? 1),
    net: str(recipe?.netQuantityBase, recipe?.netUnit === "piece" ? 1 : 1000),
    netUnit: (recipe?.netUnit ?? "g") as BaseUnit,
    sellPrice: str(recipe?.sellPriceCents, 100),
    includesVat: recipe?.sellPriceIncludesVat ?? true,
    vat: str(recipe?.vatBp ?? defaultVatBp, 100),
    target: str(recipe?.targetFoodCostBp ?? 3000, 100),
    prepMinutes: str(recipe?.prepMinutes),
    instructions: recipe?.instructions ?? "",
  });
  const [extra, setExtra] = useState<AllergenMap>(recipe?.extraAllergens ?? {});
  const [lines, setLines] = useState<Line[]>(
    (recipe?.lines ?? []).map((l) => ({ id: l.id, itemId: l.ingredientId ?? l.subRecipeId, quantity: str(l.quantity), unit: l.unit as Unit, costCents: null })),
  );
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, startSave] = useTransition();
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault(); // browser shows its "leave page?" dialog
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setF({ ...f, [k]: e.target.value });
    setDirty(true);
  };

  const draft = useMemo((): RecipeInput | null => {
    const portions = parseQuantity(f.portions);
    if (!portions) return null;
    const net = parseQuantity(f.net);
    return {
      id: recipe?.id,
      name: f.name || "Ohne Namen",
      categoryId: f.categoryId || null,
      productType: f.productType,
      portions,
      netQuantityBase: net ? net * (f.netUnit === "piece" ? 1 : 1000) : null,
      netUnit: f.netUnit,
      sellPriceCents: parseCents(f.sellPrice),
      sellPriceIncludesVat: f.includesVat,
      vatBp: pctToBp(f.vat),
      targetFoodCostBp: pctToBp(f.target),
      prepMinutes: f.prepMinutes.trim() ? Math.round(parseQuantity(f.prepMinutes) ?? 0) : null,
      instructions: f.instructions || null,
      extraAllergens: extra as Record<string, AllergenStatus>,
      lines: lines.flatMap((l, i) => {
        const q = parseQuantity(l.quantity);
        if (!l.itemId || !q) return [];
        return [{ ingredientId: isSub(l.itemId) ? null : l.itemId, subRecipeId: isSub(l.itemId) ? l.itemId : null, quantity: q, unit: l.unit, position: i }];
      }),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [f, extra, lines, recipe?.id]);

  // Live costing: ask the server after the user pauses typing.
  const seq = useRef(0);
  useEffect(() => {
    if (!draft) return;
    const mine = ++seq.current;
    const t = setTimeout(async () => {
      const res = await previewRecipe(draft);
      if (res.ok && mine === seq.current) setPreview(res.data as Preview);
    }, 250);
    return () => clearTimeout(t);
  }, [draft]);

  // Map preview line costs back onto editor lines (only complete lines are sent).
  const shownLines = useMemo(() => {
    let k = 0;
    return lines.map((l) => {
      const complete = l.itemId && parseQuantity(l.quantity);
      if (!complete) return { ...l, costCents: null, warning: undefined };
      const pc = preview?.cost.lines[k++];
      return { ...l, costCents: pc?.costCents ?? null, warning: pc?.warning };
    });
  }, [lines, preview]);

  const changeLines = (next: Line[]) => {
    setDirty(true);
    setLines(
      next.map((l) => {
        const prev = lines.find((p) => p.id === l.id);
        if (prev && prev.itemId !== l.itemId && l.itemId) {
          const o = byId.get(l.itemId);
          return { ...l, unit: o ? DEFAULT_UNIT[o.baseUnit] : l.unit };
        }
        return l;
      }),
    );
  };

  const save = () =>
    startSave(async () => {
      if (!draft) return setError("Bitte die Portionen angeben.");
      if (!f.name.trim()) return setError("Bitte einen Namen angeben.");
      const price = readCents(f.sellPrice);
      if (!price.ok) return setError(price.error);
      const incomplete = lines.filter((l) => l.itemId || l.quantity).length - draft.lines.length;
      const res = await saveRecipe({ ...draft, name: f.name });
      if (!res.ok) return setError(res.error);
      setError(null);
      setDirty(false);
      toast.success("Rezept gespeichert", incomplete > 0 ? { description: `${incomplete} unvollständige Zeile(n) wurden nicht übernommen.` } : undefined);
      if (!recipe) router.push(`/recipes/${res.data}`);
      else router.refresh();
    });

  const c = preview?.cost;
  const vatBp = pctToBp(f.vat) ?? defaultVatBp;
  const sell = parseCents(f.sellPrice);
  const net = sell ? (f.includesVat ? sell / (1 + vatBp / 10000) : sell) : null;
  const target = pctToBp(f.target);
  const over = preview?.foodCostBp != null && target != null && preview.foodCostBp > target;
  const unknownAllergens = preview ? Object.values(preview.allergens).filter((s) => s === "unknown").length : 0;

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_20rem]">
      <div className="flex min-w-0 flex-col gap-4">
        {!canEdit && <Notice tone="locked">Du kannst Rezepte ansehen, aber nicht ändern.</Notice>}
        {error && <Notice tone="warning">{error}</Notice>}
        <fieldset disabled={!canEdit} className="grid gap-4 md:grid-cols-6">
          <legend className="sr-only">Rezept</legend>
          <Field label="Name" required className="md:col-span-4">
            <Input value={f.name} onChange={set("name")} maxLength={120} autoFocus={!recipe} />
          </Field>
          <Field label="Kategorie" className="md:col-span-2">
            <Select value={f.categoryId} onChange={set("categoryId")}>
              <option value="">Keine</option>
              {categories.map((x) => <option key={x.value} value={x.value}>{x.label}</option>)}
            </Select>
          </Field>
          <Field label="Art" hint="Halbfertige Rezepte lassen sich in anderen Rezepten verwenden." className="md:col-span-2">
            <Select value={f.productType} onChange={set("productType")}>
              <option value="finished">Fertiges Gericht</option>
              <option value="semi_finished">Halbfertig (Unterrezept)</option>
            </Select>
          </Field>
          <Field label="Portionen" required className="md:col-span-1">
            <Input inputMode="decimal" className="num text-right" value={f.portions} onChange={set("portions")} />
          </Field>
          <Field label={`Ausbeute in ${f.netUnit === "g" ? "kg" : f.netUnit === "ml" ? "l" : "Stk."}`} hint="Leer = Summe der Zutaten." className="md:col-span-2">
            <Input inputMode="decimal" className="num text-right" value={f.net} onChange={set("net")} />
          </Field>
          <Field label="Einheit" className="md:col-span-1">
            <Select value={f.netUnit} onChange={set("netUnit")}>
              <option value="g">kg</option>
              <option value="ml">l</option>
              <option value="piece">Stk.</option>
            </Select>
          </Field>
        </fieldset>

        <Tabs defaultValue="lines">
          <TabList aria-label="Rezeptteile">
            <Tab value="lines" warning={c && c.missing > 0 ? `${c.missing} Zeilen ohne Preis` : undefined}>Zutaten</Tab>
            <Tab value="financial">Kalkulation</Tab>
            <Tab value="prep">Zubereitung</Tab>
            <Tab value="allergens" warning={unknownAllergens ? `${unknownAllergens} unbekannt` : undefined}>Allergene</Tab>
            {recipe && <Tab value="usage">Verwendung ({usedIn.length})</Tab>}
          </TabList>
          <TabPanel value="lines">
            <LineEditor
              label="Zutaten"
              lines={shownLines}
              options={options}
              onChange={changeLines}
              readOnly={!canEdit}
              unitsFor={(id) => (isSub(id) ? [...UNITS, "portion"] : UNITS)}
              newLine={() => ({ id: crypto.randomUUID(), itemId: null, quantity: "", unit: "g", costCents: null })}
            />
            {options.length === 0 && <p className="mt-2 text-text-muted">Lege zuerst <Link className="text-accent underline" href="/ingredients/new">eine Zutat</Link> an.</p>}
          </TabPanel>
          <TabPanel value="financial">
            <fieldset disabled={!canEdit} className="grid max-w-(--size-form-max) gap-4 md:grid-cols-2">
              <legend className="sr-only">Kalkulation</legend>
              <Field label="Verkaufspreis pro Portion" className="md:col-span-2">
                <MoneyInput value={f.sellPrice} onValueChange={(v) => { setF({ ...f, sellPrice: v }); setDirty(true); }} vat={{ includesVat: f.includesVat, onChange: (v) => { setF({ ...f, includesVat: v }); setDirty(true); } }} />
              </Field>
              <Field label="Mehrwertsteuer (%)">
                <Input inputMode="decimal" className="num text-right" value={f.vat} onChange={set("vat")} />
              </Field>
              <Field label="Ziel-Wareneinsatz (%)" hint="Liegt das Rezept darüber, wird es markiert.">
                <Input inputMode="decimal" className="num text-right" value={f.target} onChange={set("target")} />
              </Field>
            </fieldset>
            {recipe && outlets.length > 1 && (
              <OutletPrices
                recipeId={recipe.id}
                outlets={outlets}
                prices={outletPrices}
                perPortionCents={c?.perPortionCents ?? null}
                vatBp={vatBp}
                includesVat={f.includesVat}
                defaultPrice={parseCents(f.sellPrice)}
                target={target}
                canEdit={canEdit}
              />
            )}
          </TabPanel>
          <TabPanel value="prep">
            <fieldset disabled={!canEdit} className="grid max-w-(--size-form-max) gap-4">
              <legend className="sr-only">Zubereitung</legend>
              <Field label="Arbeitszeit (Minuten, für das ganze Rezept)" hint="Mit dem Stundenlohn aus den Einstellungen ergibt das die Personalkosten pro Portion.">
                <Input inputMode="numeric" className="num w-32 text-right" value={f.prepMinutes} onChange={set("prepMinutes")} />
              </Field>
              <Field label="Zubereitung">
                <Textarea rows={8} value={f.instructions} onChange={set("instructions")} />
              </Field>
            </fieldset>
          </TabPanel>
          <TabPanel value="allergens">
            <div className="grid gap-6 lg:grid-cols-2">
              <section aria-labelledby="al-res">
                <h2 id="al-res" className="mb-2 text-base font-semibold">Ergebnis aus allen Zutaten</h2>
                {preview ? <AllergenMatrix value={preview.allergens} /> : <p className="text-text-muted">Wird berechnet …</p>}
              </section>
              <section aria-labelledby="al-extra">
                <h2 id="al-extra" className="mb-1 text-base font-semibold">Ergänzungen für dieses Rezept</h2>
                <p className="mb-2 text-text-muted">Zum Beispiel Spuren, weil in derselben Küche Nüsse verarbeitet werden. Ergänzungen können einen Status nur verschärfen.</p>
                <AllergenMatrix value={extra} onChange={canEdit ? (a, s) => { setExtra({ ...extra, [a]: s }); setDirty(true); } : undefined} />
              </section>
            </div>
          </TabPanel>
          {recipe && (
            <TabPanel value="usage">
              {usedIn.length === 0 ? <p className="text-text-muted">Dieses Rezept steckt in keinem anderen Rezept.</p> : (
                <ul className="flex flex-col gap-1">{usedIn.map((r) => <li key={r.id}><Link className="text-accent underline" href={`/recipes/${r.id}`}>{r.name}</Link></li>)}</ul>
              )}
            </TabPanel>
          )}
        </Tabs>
      </div>

      <aside aria-label="Kalkulation" className="flex flex-col gap-3 xl:sticky xl:top-20 xl:self-start">
        <div className="rounded-md border border-border bg-surface-raised p-4 shadow-card" aria-live="polite">
          <p className="text-xs font-normal text-text-muted">Wareneinsatz pro Portion</p>
          <p className="num text-xl">{c ? cents(c.perPortionCents) : "–"}</p>
          {c && c.missing > 0 && (
            <p className="mt-1 flex items-start gap-1 text-xs text-warning">
              <AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0" />
              {c.missing} Zeile(n) ohne Preis – der echte Wareneinsatz liegt höher.
            </p>
          )}
          <dl className="mt-4 grid grid-cols-[1fr_auto] gap-x-4 gap-y-2 text-sm">
            <dt className="text-text-muted">Gesamt ({f.portions || "–"} Port.)</dt>
            <dd className="num text-right">{c ? cents(c.totalCents) : "–"}</dd>
            <dt className="text-text-muted">Ausbeute</dt>
            <dd className="num text-right">{c?.yieldBase ? formatBase(c.yieldBase, f.netUnit) : "unbekannt"}</dd>
            <dt className="text-text-muted">Verkaufspreis netto</dt>
            <dd className="num text-right">{net ? cents(net) : "–"}</dd>
            {preview?.prepCostCents != null && (
              <>
                <dt className="text-text-muted">Personalkosten/Port.</dt>
                <dd className="num text-right">{cents(preview.prepCostCents)}</dd>
              </>
            )}
            {net && c && (
              <>
                <dt className="text-text-muted">Rohertrag/Port.</dt>
                <dd className="num text-right">{cents(net - c.perPortionCents - (preview?.prepCostCents ?? 0))}</dd>
              </>
            )}
          </dl>
          {preview?.foodCostBp != null && (
            <div className="mt-4">
              <div className="flex items-baseline justify-between">
                <span className="text-xs text-text-muted">Wareneinsatz</span>
                <span className={cn("num font-semibold", over ? "text-danger" : "text-success")}>
                  {formatBp(preview.foodCostBp)}{target != null && ` (Ziel ${formatBp(target)})`}
                </span>
              </div>
              <div className="mt-1 h-2 overflow-hidden rounded-pill bg-surface-sunken" aria-hidden>
                <div className={cn("h-full", over ? "bg-danger" : "bg-success")} style={{ width: `${Math.min(preview.foodCostBp / 100, 100)}%` }} />
              </div>
            </div>
          )}
        </div>
        {canEdit && (
          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={save} loading={saving}>{recipe ? "Speichern" : "Rezept anlegen"}</Button>
            {dirty && <span className="text-xs font-normal text-text-muted" role="status">Ungespeicherte Änderungen</span>}
            {recipe && <ArchiveRecipe id={recipe.id} name={recipe.name} />}
          </div>
        )}
      </aside>
    </div>
  );
}

function ArchiveRecipe({ id, name }: { id: string; name: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={setOpen}
      trigger={<Button variant="ghost">Archivieren</Button>}
      title={`„${name}“ archivieren?`}
      description="Das Rezept verschwindet aus Listen. Verknüpfungen mit Kassenartikeln bleiben erhalten."
      confirmLabel="Archivieren"
      danger
      loading={pending}
      onConfirm={() =>
        start(async () => {
          const res = await archiveRecipe(id);
          setOpen(false);
          if (!res.ok) {
            toast.error("Archivieren nicht möglich", { description: res.error });
            return;
          }
          router.push("/recipes");
        })
      }
    />
  );
}

type OutletPricesProps = {
  recipeId: string; outlets: { id: string; name: string }[]; prices: { outletId: string; sellPriceCents: number }[];
  perPortionCents: number | null; vatBp: number; includesVat: boolean; defaultPrice: number | null; target: number | null; canEdit: boolean;
};

/** Own sell price per outlet (catering, airport branch ...). Empty = the recipe's price above. */
function OutletPrices({ recipeId, outlets, prices, perPortionCents, vatBp, includesVat, defaultPrice, target, canEdit }: OutletPricesProps) {
  const router = useRouter();
  const [values, setValues] = useState<Record<string, string>>(
    Object.fromEntries(prices.map((p) => [p.outletId, str(p.sellPriceCents, 100)])),
  );
  const [pending, start] = useTransition();
  const save = (o: { id: string; name: string }) =>
    start(async () => {
      const read = readCents(values[o.id] ?? "");
      if (!read.ok) return void toast.error(read.error);
      const cents = read.cents;
      const res = await setRecipeOutletPrice(recipeId, o.id, cents);
      if (!res.ok) return void toast.error(res.error);
      toast.success(cents === null ? `${o.name}: Standardpreis` : `${o.name}: eigener Preis gespeichert`);
      router.refresh();
    });
  return (
    <section aria-labelledby="outlet-prices" className="mt-6 flex max-w-(--size-form-max) flex-col gap-2">
      <h3 id="outlet-prices" className="font-semibold">Preis pro Outlet</h3>
      <p className="text-text-muted">Leer lassen, wenn das Outlet den Preis oben verwendet. {includesVat ? "Brutto" : "Netto"}, wie oben.</p>
      <ul className="flex flex-col gap-2">
        {outlets.map((o) => {
          const price = (values[o.id] ?? "").trim() ? parseCents(values[o.id]) : defaultPrice;
          const net = price ? (includesVat ? price / (1 + vatBp / 10000) : price) : null;
          const fc = net && perPortionCents !== null ? Math.round((perPortionCents / net) * 10000) : null;
          const over = fc !== null && target !== null && fc > target;
          const saved = prices.find((p) => p.outletId === o.id);
          return (
            <li key={o.id} className="grid items-center gap-2 sm:grid-cols-[1fr_10rem_6rem_auto]">
              <span>{o.name}{saved && <span className="ml-2 text-xs text-text-muted">eigener Preis</span>}</span>
              <MoneyInput
                aria-label={`Verkaufspreis ${o.name}`}
                placeholder={defaultPrice ? str(defaultPrice, 100) : "–"}
                value={values[o.id] ?? ""}
                disabled={!canEdit}
                onValueChange={(v) => setValues({ ...values, [o.id]: v })}
              />
              <span className={cn("num text-right", fc === null ? "text-text-muted" : over ? "text-danger" : "text-success")} aria-label={`Wareneinsatz ${o.name}`}>
                {fc === null ? "–" : formatBp(fc)}
              </span>
              {canEdit && <Button variant="secondary" size="sm" loading={pending} onClick={() => save(o)}>Speichern</Button>}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
