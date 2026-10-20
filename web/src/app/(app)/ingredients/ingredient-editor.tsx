"use client";

import { Pencil, Plus, Star, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  archiveIngredient, archiveStockItem, deletePackage, savePackage, saveIngredient, saveStockItem, setAllergens, setNutrition, setOutletCarried,
} from "@/app/actions";
import { Notice } from "@/components/app/notice";
import { AllergenMatrix } from "@/components/ui/allergen-matrix";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog, Dialog } from "@/components/ui/dialog";
import { Field, Input, Select } from "@/components/ui/field";
import { MoneyInput, parseCents } from "@/components/ui/money-input";
import { parseQuantity } from "@/components/ui/quantity-input";
import { Tab, TabList, TabPanel, Tabs } from "@/components/ui/tabs";
import { toast } from "@/components/ui/toast";
import type { AllergenMap } from "@/domain/allergens";
import type { BaseUnit } from "@/domain/units";
import type { Ingredient, Nutrition, Package, StockItem } from "@/data/types";
import { formatCents } from "@/lib/format";
import { formatBase, formatUnitPrice } from "@/lib/units-display";

type Opt = { value: string; label: string };
type Detail = {
  ingredient: Ingredient;
  packages: Package[];
  stockItems: (StockItem & { supplier: string; packageLabel: string })[];
  costPerBaseCents: number | null;
  allergens: AllergenMap;
  verified: boolean;
  nutrition: Nutrition | null;
  usedIn: { id: string; name: string }[];
  outlets: { id: string; name: string; carried: boolean; onHandBase: number }[];
};

type Props = { detail: Detail | null; categories: Opt[]; suppliers: Opt[]; canEdit: boolean; initialTab: string };

const num = (v: string) => (v.trim() ? parseQuantity(v) : null);
const show = (n: number | null | undefined) => (n == null ? "" : String(n).replace(".", ","));

export function IngredientEditor({ detail, categories, suppliers, canEdit, initialTab }: Props) {
  const isNew = !detail;
  const missingPrice = detail && detail.costPerBaseCents === null;
  return (
    <div className="flex max-w-(--size-content-max) flex-col gap-4">
      {!canEdit && <Notice tone="locked">Du kannst Zutaten ansehen, aber nicht ändern.</Notice>}
      <Tabs defaultValue={initialTab}>
        <TabList aria-label="Zutat">
          <Tab value="general">Allgemein</Tab>
          {!isNew && <Tab value="packages" warning={missingPrice ? "kein Preis hinterlegt" : undefined}>Gebinde & Preise</Tab>}
          {!isNew && <Tab value="allergens" warning={!detail.verified ? "ungeprüft" : undefined}>Allergene</Tab>}
          {!isNew && <Tab value="nutrition">Nährwerte</Tab>}
          {!isNew && detail.outlets.length > 1 && <Tab value="outlets">Outlets</Tab>}
          {!isNew && <Tab value="usage">Verwendung ({detail.usedIn.length})</Tab>}
        </TabList>
        <TabPanel value="general"><GeneralForm detail={detail} categories={categories} canEdit={canEdit} /></TabPanel>
        {detail && (
          <>
            <TabPanel value="packages"><PackagesAndPrices detail={detail} suppliers={suppliers} canEdit={canEdit} /></TabPanel>
            <TabPanel value="allergens"><AllergenForm detail={detail} canEdit={canEdit} /></TabPanel>
            <TabPanel value="nutrition"><NutritionForm detail={detail} canEdit={canEdit} /></TabPanel>
            <TabPanel value="outlets"><OutletsForm detail={detail} canEdit={canEdit} /></TabPanel>
            <TabPanel value="usage">
              {detail.usedIn.length === 0 ? (
                <p className="text-text-muted">Diese Zutat steckt noch in keinem Rezept.</p>
              ) : (
                <ul className="flex flex-col gap-1">
                  {detail.usedIn.map((r) => (
                    <li key={r.id}><Link className="text-accent underline" href={`/recipes/${r.id}`}>{r.name}</Link></li>
                  ))}
                </ul>
              )}
            </TabPanel>
          </>
        )}
      </Tabs>
    </div>
  );
}

function GeneralForm({ detail, categories, canEdit }: { detail: Detail | null; categories: Opt[]; canEdit: boolean }) {
  const router = useRouter();
  const i = detail?.ingredient;
  const [form, setForm] = useState({
    name: i?.name ?? "",
    shortName: i?.shortName ?? "",
    internalUid: i?.internalUid ?? "",
    categoryId: i?.categoryId ?? "",
    baseUnit: (i?.baseUnit ?? "g") as BaseUnit,
    gramsPerPiece: show(i?.gramsPerPiece),
    mlPerGram: show(i?.mlPerGram),
  });
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm({ ...form, [k]: e.target.value });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    start(async () => {
      const res = await saveIngredient({
        id: i?.id,
        name: form.name,
        shortName: form.shortName,
        internalUid: form.internalUid,
        categoryId: form.categoryId || null,
        baseUnit: form.baseUnit,
        gramsPerPiece: num(form.gramsPerPiece),
        mlPerGram: num(form.mlPerGram),
      });
      if (!res.ok) return setError(res.error);
      setError(null);
      toast.success("Zutat gespeichert");
      if (!i) router.push(`/ingredients/${res.data}?tab=packages`);
      else router.refresh();
    });
  };

  return (
    <form onSubmit={submit} className="flex max-w-(--size-form-max) flex-col gap-4" noValidate>
      <fieldset disabled={!canEdit} className="grid gap-4 md:grid-cols-2">
        <legend className="sr-only">Stammdaten</legend>
        <Field label="Name" required error={error ?? undefined} className="md:col-span-2">
          <Input value={form.name} onChange={set("name")} maxLength={120} autoFocus={!i} />
        </Field>
        <Field label="Kurzname" hint="Für Etiketten und Zähllisten.">
          <Input value={form.shortName} onChange={set("shortName")} maxLength={40} />
        </Field>
        <Field label="Interne Nummer">
          <Input value={form.internalUid} onChange={set("internalUid")} maxLength={40} />
        </Field>
        <Field label="Kategorie">
          <Select value={form.categoryId} onChange={set("categoryId")}>
            <option value="">Keine</option>
            {categories.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </Select>
        </Field>
        <Field label="Grundeinheit" hint="Darin werden Bestand und Kosten geführt.">
          <Select value={form.baseUnit} onChange={set("baseUnit")} disabled={!!i}>
            <option value="g">Gewicht (g)</option>
            <option value="ml">Volumen (ml)</option>
            <option value="piece">Stück</option>
          </Select>
        </Field>
        <Field label="Gewicht pro Stück (g)" hint="Damit „2 Stk.“ im Rezept in Gramm umgerechnet werden kann.">
          <Input inputMode="decimal" className="num text-right" value={form.gramsPerPiece} onChange={set("gramsPerPiece")} />
        </Field>
        <Field label="Dichte (ml pro g)" hint="Nur für Flüssigkeiten, z. B. Öl 1,09.">
          <Input inputMode="decimal" className="num text-right" value={form.mlPerGram} onChange={set("mlPerGram")} />
        </Field>
      </fieldset>
      {canEdit && (
        <div className="flex flex-wrap gap-2">
          <Button type="submit" loading={pending}>{i ? "Speichern" : "Anlegen und weiter zu Gebinden"}</Button>
          {i && <ArchiveButton id={i.id} name={i.name} />}
        </div>
      )}
    </form>
  );
}

function ArchiveButton({ id, name }: { id: string; name: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={setOpen}
      trigger={<Button variant="ghost">Archivieren</Button>}
      title={`„${name}“ archivieren?`}
      description="Die Zutat verschwindet aus Listen und Auswahlfeldern. Bestellungen und Lagerbewegungen bleiben erhalten."
      confirmLabel="Archivieren"
      danger
      loading={pending}
      onConfirm={() =>
        start(async () => {
          const res = await archiveIngredient(id);
          if (!res.ok) {
            toast.error("Archivieren nicht möglich", { description: res.error });
            setOpen(false);
            return;
          }
          toast.success("Zutat archiviert");
          router.push("/ingredients");
        })
      }
    />
  );
}

// ---------------------------------------------------------------- packages & prices

function PackagesAndPrices({ detail, suppliers, canEdit }: { detail: Detail; suppliers: Opt[]; canEdit: boolean }) {
  const router = useRouter();
  const unit = detail.ingredient.baseUnit;
  const [, start] = useTransition();
  return (
    <div className="flex flex-col gap-8">
      <section aria-labelledby="pk-h" className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h2 id="pk-h" className="text-lg">Gebinde</h2>
            <p className="text-text-muted">So wie der Lieferant verkauft, z. B. Beutel 150 g, dann Karton 30 × 150 g.</p>
          </div>
          {canEdit && <PackageDialog ingredient={detail.ingredient} packages={detail.packages} />}
        </div>
        {detail.packages.length === 0 ? (
          <Notice tone="warning">Noch kein Gebinde. Ohne Gebinde gibt es keinen Preis und keine Kalkulation.</Notice>
        ) : (
          <ul className="flex flex-col divide-y divide-border rounded-md border border-border bg-bg">
            {detail.packages.map((p) => {
              const parent = detail.packages.find((x) => x.id === p.parentPackageId);
              return (
                <li key={p.id} className="flex min-h-(--size-table-row) items-center gap-3 px-3 py-2">
                  <span className="flex-1 font-semibold">{p.label}</span>
                  <span className="num text-text-muted">{parent ? `${p.count} × ${parent.label} = ` : ""}{formatBase(p.quantityBase, unit)}</span>
                  {canEdit && (
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Gebinde ${p.label} löschen`}
                      onClick={() =>
                        start(async () => {
                          const res = await deletePackage(p.id);
                          if (!res.ok) toast.error("Löschen nicht möglich", { description: res.error });
                          else router.refresh();
                        })
                      }
                    >
                      <Trash2 aria-hidden className="size-4" />
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section aria-labelledby="si-h" className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h2 id="si-h" className="text-lg">Lieferantenpreise</h2>
            <p className="text-text-muted">Netto, ohne Mehrwertsteuer, wie auf der Rechnung. Der bevorzugte Preis zählt für die Kalkulation.</p>
          </div>
          {canEdit && detail.packages.length > 0 && <StockItemDialog detail={detail} suppliers={suppliers} />}
        </div>
        {detail.stockItems.length === 0 ? (
          <Notice tone="warning">Noch kein Preis. Rezepte mit dieser Zutat zeigen deshalb unvollständige Kosten.</Notice>
        ) : (
          <div className="relative overflow-x-auto rounded-md border border-border bg-bg">
            <table className="w-full text-sm">
              <caption className="sr-only">Lieferantenpreise</caption>
              <thead className="bg-surface text-xs text-text-muted">
                <tr className="h-(--size-table-row)">
                  <th scope="col" className="px-3 text-left">Lieferant</th>
                  <th scope="col" className="px-3 text-left">Gebinde</th>
                  <th scope="col" className="px-3 text-right">Preis</th>
                  <th scope="col" className="px-3 text-right">umgerechnet</th>
                  <th scope="col" className="px-3"><span className="sr-only">Aktionen</span></th>
                </tr>
              </thead>
              <tbody>
                {detail.stockItems.map((si) => {
                  const pack = detail.packages.find((p) => p.id === si.packageId);
                  const perBase = si.priceType === "per_pack" ? (pack ? si.priceCents / pack.quantityBase : null) : si.priceCents / (si.priceUnitQuantity || 1);
                  return (
                    <tr key={si.id} className="h-(--size-table-row) border-t border-border">
                      <td className="px-3">
                        <span className="inline-flex items-center gap-2">
                          {si.isPreferred && <Star aria-label="bevorzugt" className="size-4 fill-current text-warning" />}
                          {si.supplier}
                          {si.weighted && <Badge tone="info">gewogen</Badge>}
                        </span>
                      </td>
                      <td className="px-3">{si.packageLabel}</td>
                      <td className="num px-3 text-right">{formatCents(si.priceCents)}{si.priceType === "per_unit" ? ` / ${formatBase(si.priceUnitQuantity ?? 1, si.priceUnit ?? unit)}` : ""}</td>
                      <td className="num px-3 text-right">{formatUnitPrice(perBase, unit)}</td>
                      <td className="px-3 text-right">
                        {canEdit && (
                          <span className="inline-flex gap-1">
                            <StockItemDialog detail={detail} suppliers={suppliers} item={si} />
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label={`Preis von ${si.supplier} entfernen`}
                              onClick={() =>
                                start(async () => {
                                  const res = await archiveStockItem(si.id);
                                  if (!res.ok) toast.error(res.error);
                                  else router.refresh();
                                })
                              }
                            >
                              <Trash2 aria-hidden className="size-4" />
                            </Button>
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function PackageDialog({ ingredient, packages }: { ingredient: Ingredient; packages: Package[] }) {
  const router = useRouter();
  const unit = ingredient.baseUnit;
  const [open, setOpen] = useState(false);
  const [parentId, setParentId] = useState("");
  const [count, setCount] = useState("1");
  const [quantity, setQuantity] = useState("");
  const [label, setLabel] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const parent = packages.find((p) => p.id === parentId);
  const unitFactor = unit === "piece" ? 1 : 1000; // entered in kg or l for readability
  const total = parent ? (parseQuantity(count) ?? 0) * parent.quantityBase : (parseQuantity(quantity) ?? 0) * unitFactor;

  const submit = () =>
    start(async () => {
      const res = await savePackage({
        ingredientId: ingredient.id,
        parentPackageId: parent?.id ?? null,
        count: parent ? Math.round(parseQuantity(count) ?? 0) : 1,
        quantityBase: total,
        label: label || (parent ? `${count} × ${parent.label}` : formatBase(total, unit)),
      });
      if (!res.ok) return setError(res.error);
      setOpen(false);
      setQuantity("");
      setLabel("");
      router.refresh();
    });

  return (
    <Dialog
      open={open}
      onOpenChange={setOpen}
      trigger={<Button variant="secondary"><Plus aria-hidden className="size-4" /> Gebinde</Button>}
      title="Gebinde hinzufügen"
      description="Ein Gebinde ist eine Menge, in der du kaufst oder zählst."
      footer={<Button loading={pending} onClick={submit} disabled={total <= 0}>Hinzufügen</Button>}
    >
      <div className="flex flex-col gap-4">
        <Field label="Besteht aus" hint="Für Kartons aus kleineren Einheiten.">
          <Select value={parentId} onChange={(e) => setParentId(e.target.value)}>
            <option value="">Lose Menge</option>
            {packages.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
          </Select>
        </Field>
        {parent ? (
          <Field label={`Anzahl × ${parent.label}`} required>
            <Input inputMode="numeric" className="num text-right" value={count} onChange={(e) => setCount(e.target.value)} />
          </Field>
        ) : (
          <Field label={unit === "g" ? "Menge in kg" : unit === "ml" ? "Menge in Litern" : "Anzahl Stück"} required error={error ?? undefined}>
            <Input inputMode="decimal" className="num text-right" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
          </Field>
        )}
        <Field label="Bezeichnung" hint={`Leer lassen für „${parent ? `${count} × ${parent.label}` : formatBase(total, unit)}“.`}>
          <Input value={label} onChange={(e) => setLabel(e.target.value)} maxLength={60} />
        </Field>
        <p className="num text-text-muted" aria-live="polite">Gesamt: {formatBase(total, unit)}</p>
      </div>
    </Dialog>
  );
}

function StockItemDialog({ detail, suppliers, item }: { detail: Detail; suppliers: Opt[]; item?: Detail["stockItems"][number] }) {
  const router = useRouter();
  const unit = detail.ingredient.baseUnit;
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({
    supplierId: item?.supplierId ?? suppliers[0]?.value ?? "",
    packageId: item?.packageId ?? detail.packages[detail.packages.length - 1]?.id ?? "",
    priceType: item?.priceType ?? "per_pack",
    price: item ? show(item.priceCents / 100) : "",
    isPreferred: item?.isPreferred ?? detail.stockItems.length === 0,
    weighted: item?.weighted ?? false,
    gtin: item?.gtin ?? "",
  });
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const perUnitLabel = unit === "g" ? "pro kg" : unit === "ml" ? "pro Liter" : "pro Stück";

  const submit = () =>
    start(async () => {
      const priceCents = parseCents(f.price);
      if (priceCents === null) return setError("Bitte einen Preis angeben.");
      const res = await saveStockItem({
        id: item?.id,
        ingredientId: detail.ingredient.id,
        supplierId: f.supplierId || null,
        packageId: f.packageId,
        priceType: f.priceType,
        priceCents,
        priceUnit: f.priceType === "per_unit" ? unit : null,
        priceUnitQuantity: f.priceType === "per_unit" ? (unit === "piece" ? 1 : 1000) : null,
        isPreferred: f.isPreferred,
        supplierSku: null,
        gtin: f.gtin,
        weighted: f.weighted,
      });
      if (!res.ok) return setError(res.error);
      setOpen(false);
      toast.success("Preis gespeichert");
      router.refresh();
    });

  return (
    <Dialog
      open={open}
      onOpenChange={setOpen}
      trigger={item ? <Button variant="ghost" size="icon" aria-label={`Preis von ${item.supplier} bearbeiten`}><Pencil aria-hidden className="size-4" /></Button> : <Button variant="secondary"><Plus aria-hidden className="size-4" /> Preis</Button>}
      title={item ? "Preis bearbeiten" : "Lieferantenpreis hinzufügen"}
      footer={<Button loading={pending} onClick={submit}>Speichern</Button>}
    >
      <div className="flex flex-col gap-4">
        <Field label="Lieferant" hint={suppliers.length === 0 ? "Lege zuerst einen Lieferanten an." : undefined}>
          <Select value={f.supplierId} onChange={(e) => setF({ ...f, supplierId: e.target.value })}>
            {suppliers.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </Select>
        </Field>
        <Field label="Bestelleinheit (Gebinde)">
          <Select value={f.packageId} onChange={(e) => setF({ ...f, packageId: e.target.value })}>
            {detail.packages.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
          </Select>
        </Field>
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-xs">Preis gilt</legend>
          <label className="flex items-center gap-2"><input type="radio" name="pt" checked={f.priceType === "per_pack"} onChange={() => setF({ ...f, priceType: "per_pack" })} /> pro Gebinde</label>
          <label className="flex items-center gap-2"><input type="radio" name="pt" checked={f.priceType === "per_unit"} onChange={() => setF({ ...f, priceType: "per_unit" })} /> {perUnitLabel}</label>
        </fieldset>
        <Field label={f.priceType === "per_pack" ? "Preis pro Gebinde (netto)" : `Preis ${perUnitLabel} (netto)`} required error={error ?? undefined}>
          <MoneyInput value={f.price} onValueChange={(price) => setF({ ...f, price })} />
        </Field>
        <Field label="GTIN / EAN" hint="Optional, für das Scannen bei der Inventur.">
          <Input inputMode="numeric" value={f.gtin} onChange={(e) => setF({ ...f, gtin: e.target.value })} maxLength={14} />
        </Field>
        <label className="flex items-center gap-2"><input type="checkbox" checked={f.isPreferred} onChange={(e) => setF({ ...f, isPreferred: e.target.checked })} /> Bevorzugter Preis für die Kalkulation</label>
        <label className="flex items-center gap-2"><input type="checkbox" checked={f.weighted} onChange={(e) => setF({ ...f, weighted: e.target.checked })} /> Wird nach Gewicht geliefert und abgerechnet</label>
      </div>
    </Dialog>
  );
}

// ---------------------------------------------------------------- allergens & nutrition

function AllergenForm({ detail, canEdit }: { detail: Detail; canEdit: boolean }) {
  const router = useRouter();
  const [map, setMap] = useState<AllergenMap>(detail.allergens);
  const [verified, setVerified] = useState(detail.verified);
  const [pending, start] = useTransition();
  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <p className="text-text-muted">Nicht ausgefüllte Allergene gelten als <strong>unbekannt</strong> und werden in jedem Rezept als Warnung angezeigt.</p>
      <AllergenMatrix value={map} onChange={canEdit ? (a, s) => setMap({ ...map, [a]: s }) : undefined} />
      {canEdit && (
        <>
          <label className="flex items-center gap-2"><input type="checkbox" checked={verified} onChange={(e) => setVerified(e.target.checked)} /> Angaben mit dem Datenblatt des Lieferanten geprüft</label>
          <div>
            <Button
              loading={pending}
              onClick={() =>
                start(async () => {
                  const res = await setAllergens(detail.ingredient.id, map as Record<string, string>, verified);
                  if (!res.ok) {
                    toast.error(res.error);
                    return;
                  }
                  toast.success("Allergene gespeichert");
                  router.refresh();
                })
              }
            >
              Allergene speichern
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

const NUTRIENTS: [keyof Nutrition, string][] = [
  ["energyKcal", "Energie (kcal)"], ["fatG", "Fett (g)"], ["saturatedFatG", "davon gesättigte Fettsäuren (g)"],
  ["carbohydrateG", "Kohlenhydrate (g)"], ["sugarsG", "davon Zucker (g)"], ["proteinG", "Eiweiß (g)"], ["saltG", "Salz (g)"],
];

function NutritionForm({ detail, canEdit }: { detail: Detail; canEdit: boolean }) {
  const [values, setValues] = useState<Record<string, string>>(Object.fromEntries(NUTRIENTS.map(([k]) => [k, show(detail.nutrition?.[k])])));
  const [pending, start] = useTransition();
  const per = detail.ingredient.baseUnit === "ml" ? "100 ml" : "100 g";
  return (
    <form
      className="flex max-w-md flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const n = Object.fromEntries(NUTRIENTS.map(([k]) => [k, values[k].trim() ? Number(values[k].replace(",", ".")) : null])) as Nutrition;
          const res = await setNutrition(detail.ingredient.id, n);
          if (!res.ok) toast.error(res.error);
          else toast.success("Nährwerte gespeichert");
        });
      }}
    >
      <p className="text-text-muted">Werte pro {per}, wie auf dem Etikett oder Datenblatt.</p>
      <fieldset disabled={!canEdit} className="flex flex-col gap-3">
        <legend className="sr-only">Nährwerte pro {per}</legend>
        {NUTRIENTS.map(([k, label]) => (
          <Field key={k} label={label}>
            <Input inputMode="decimal" className="num text-right" value={values[k]} onChange={(e) => setValues({ ...values, [k]: e.target.value })} />
          </Field>
        ))}
      </fieldset>
      {canEdit && <div><Button type="submit" loading={pending}>Nährwerte speichern</Button></div>}
    </form>
  );
}


function OutletsForm({ detail, canEdit }: { detail: Detail; canEdit: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <fieldset disabled={!canEdit || pending} className="flex max-w-(--size-form-max) flex-col gap-3">
      <legend className="mb-2 text-text-muted">Welche Outlets diese Zutat führen. Nur dort erscheint sie im Lager, in der Inventur und beim Bestellen.</legend>
      {error && <p role="alert" className="text-danger">{error}</p>}
      {detail.outlets.map((o) => (
        <label key={o.id} className="flex items-center justify-between gap-3 rounded-sm border border-border bg-bg px-3 py-2">
          <span className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={o.carried}
              onChange={(e) => {
                const carried = e.target.checked;
                start(async () => {
                  const res = await setOutletCarried(detail.ingredient.id, o.id, carried);
                  if (!res.ok) return setError(res.error);
                  setError(null);
                  toast.success(carried ? `Wird in ${o.name} geführt` : `In ${o.name} ausgeblendet`);
                  router.refresh();
                });
              }}
            />
            {o.name}
          </span>
          <span className="num text-xs text-text-muted">{o.carried ? `Bestand ${formatBase(o.onHandBase, detail.ingredient.baseUnit)}` : "nicht geführt"}</span>
        </label>
      ))}
    </fieldset>
  );
}
