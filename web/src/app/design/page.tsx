"use client";

import { ChefHat, Package } from "lucide-react";
import { useState } from "react";
import { AllergenMatrix, type Allergen, type AllergenStatus } from "@/components/ui/allergen-matrix";
import { AppShell } from "@/components/ui/app-shell";
import { Badge, OrderStatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import { DataTable, type Column } from "@/components/ui/data-table";
import { ConfirmDialog, Dialog } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { FileUpload } from "@/components/ui/file-upload";
import { FilterBar } from "@/components/ui/filter-bar";
import { LineEditor, type Line } from "@/components/ui/line-editor";
import { MoneyInput } from "@/components/ui/money-input";
import { QuantityInput, type Unit } from "@/components/ui/quantity-input";
import { StatTile } from "@/components/ui/stat-tile";
import { Tab, TabList, TabPanel, Tabs } from "@/components/ui/tabs";
import { toast } from "@/components/ui/toast";
import { formatBp, formatCents } from "@/lib/format";
import tokens from "@/styles/tokens.json";

// Demo data for the design check only. Not real products or prices.
type Row = { id: string; name: string; category: string; costCents: number; foodCostBp: number };
const ROWS: Row[] = [
  { id: "1", name: "Linsensuppe", category: "Suppen", costCents: 84, foodCostBp: 1870 },
  { id: "2", name: "Ofengemüse mit Kräuterquark", category: "Hauptgerichte", costCents: 312, foodCostBp: 2640 },
  { id: "3", name: "Apfelkuchen", category: "Desserts", costCents: 121, foodCostBp: 3420 },
];
const COLUMNS: Column<Row>[] = [
  { key: "name", header: "Name", cell: (r) => r.name, sortValue: (r) => r.name },
  { key: "category", header: "Kategorie", cell: (r) => r.category, sortValue: (r) => r.category },
  { key: "cost", header: "Kosten/Portion", align: "right", cell: (r) => formatCents(r.costCents), sortValue: (r) => r.costCents },
  {
    key: "fc", header: "Wareneinsatz", align: "right", sortValue: (r) => r.foodCostBp,
    cell: (r) => <Badge tone={r.foodCostBp > 3000 ? "danger" : "success"}>{formatBp(r.foodCostBp)}</Badge>,
  },
];
const OPTIONS = [
  { value: "i1", label: "Rote Linsen", hint: "Zutat" },
  { value: "i2", label: "Zwiebeln", hint: "Zutat" },
  { value: "i3", label: "Gemüsefond", hint: "Unterrezept" },
  { value: "i4", label: "Kreuzkümmel", hint: "Zutat" },
];

const TYPE_CLASS: Record<string, string> = {
  xs: "text-xs", sm: "text-sm", base: "text-base", lg: "text-lg", xl: "text-xl", display: "text-display",
};

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-4 rounded-lg border border-border bg-bg p-6">
      <h2 id={id} className="text-lg">{title}</h2>
      {children}
    </section>
  );
}

export default function DesignPage() {
  const [outlet, setOutlet] = useState("o1");
  const [qty, setQty] = useState("1,5");
  const [unit, setUnit] = useState<Unit>("kg");
  const [price, setPrice] = useState("12,90");
  const [incl, setIncl] = useState(true);
  const [combo, setCombo] = useState<string | null>("i1");
  const [query, setQuery] = useState("");
  const [chips, setChips] = useState([{ key: "cat", label: "Kategorie: Suppen" }]);
  const [selected, setSelected] = useState<Set<string>>(new Set(["2"]));
  const [allergens, setAllergens] = useState<Partial<Record<Allergen, AllergenStatus>>>({ gluten: "contains", celery: "may_contain", milk: "free" });
  const [lines, setLines] = useState<Line[]>([
    { id: "l1", itemId: "i1", quantity: "250", unit: "g", costCents: 61 },
    { id: "l2", itemId: "i2", quantity: "1", unit: "piece", costCents: null, warning: "Für „Zwiebeln“ fehlt das Gewicht pro Stück. Ohne Umrechnung keine Kosten." },
  ]);

  return (
    <AppShell outlets={[{ id: "o1", name: "Küche Mitte" }, { id: "o2", name: "Zentralküche" }]} outletId={outlet} onOutletChange={setOutlet} userName="Demo Nutzer">
      <div className="flex flex-col gap-6">
        <header>
          <h1 className="text-xl">Designsystem</h1>
          <p className="mt-1 max-w-2xl text-text-muted">
            Jede Basis-Komponente in ihren Zuständen. Werte stammen aus <code>replica/design/tokens.json</code>.
            Nicht gemessen – Platzhalter bis zu Referenz-Screenshots und <code>/replica-brand</code>.
          </p>
        </header>

        <Section id="colors" title="Farbrollen">
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
            {Object.entries(tokens.color).map(([name, hex]) => (
              <li key={name} className="flex flex-col gap-1">
                <span className="h-10 rounded-sm border border-border" style={{ background: hex }} />
                <span className="text-xs">{name}</span>
                <span className="num text-xs font-normal text-text-muted">{hex}</span>
              </li>
            ))}
          </ul>
        </Section>

        <Section id="type" title="Schrift">
          {Object.entries(tokens.type).map(([name, t]) => (
            <p key={name} className={TYPE_CLASS[name]}>
              <span className="num mr-3 inline-block w-28 text-xs font-normal text-text-muted">{name} {t.size}/{t.line}</span>
              Wareneinsatz pro Portion 1,23 €
            </p>
          ))}
        </Section>

        <Section id="buttons" title="Buttons">
          <div className="flex flex-wrap items-center gap-3">
            <Button>Speichern</Button>
            <Button variant="secondary">Abbrechen</Button>
            <Button variant="ghost">Mehr</Button>
            <Button variant="danger">Archivieren</Button>
            <Button loading>Bestellung senden</Button>
            <Button disabled>Deaktiviert</Button>
            <Button size="sm">Klein</Button>
            <Button size="lg">Groß</Button>
          </div>
        </Section>

        <Section id="forms" title="Formularfelder">
          <div className="grid max-w-(--size-form-max) gap-4 md:grid-cols-2">
            <Field label="Name" required hint="So erscheint die Zutat in Rezepten.">
              <Input defaultValue="Rote Linsen" />
            </Field>
            <Field label="Interne Nummer" error="Diese Nummer ist schon vergeben.">
              <Input defaultValue="ZT-0042" />
            </Field>
            <Field label="Menge">
              <QuantityInput value={qty} unit={unit} onValueChange={setQty} onUnitChange={setUnit} />
            </Field>
            <Field label="Verkaufspreis pro Portion">
              <MoneyInput value={price} onValueChange={setPrice} vat={{ includesVat: incl, onChange: setIncl }} />
            </Field>
            <Field label="Lieferant">
              <Combobox options={OPTIONS} value={combo} onChange={setCombo} onCreate={(q) => toast.success(`„${q}“ angelegt`)} />
            </Field>
            <Field label="Kategorie">
              <Select defaultValue="s"><option value="s">Suppen</option><option value="h">Hauptgerichte</option></Select>
            </Field>
            <Field label="Gesperrt" hint="Nur Admins dürfen das ändern.">
              <Input disabled defaultValue="Bibliothek Nord" />
            </Field>
            <Field label="Zubereitung" className="md:col-span-2">
              <Textarea defaultValue="Zwiebeln anschwitzen, Linsen zugeben, mit Fond auffüllen." />
            </Field>
          </div>
        </Section>

        <Section id="lines" title="Zeilen-Editor (Rezept)">
          <LineEditor
            label="Zutaten"
            lines={lines}
            options={OPTIONS}
            onChange={setLines}
            newLine={() => ({ id: crypto.randomUUID(), itemId: null, quantity: "", unit: "g", costCents: null })}
          />
        </Section>

        <Section id="tabs" title="Tabs">
          <Tabs defaultValue="general">
            <TabList aria-label="Rezept">
              <Tab value="general">Allgemein</Tab>
              <Tab value="financial" warning="1 Zutat ohne Preis">Kalkulation</Tab>
              <Tab value="allergens">Allergene</Tab>
            </TabList>
            <TabPanel value="general">Inhalt Allgemein</TabPanel>
            <TabPanel value="financial">Inhalt Kalkulation</TabPanel>
            <TabPanel value="allergens">Inhalt Allergene</TabPanel>
          </Tabs>
        </Section>

        <Section id="tables" title="Tabellen">
          <FilterBar
            query={query}
            onQueryChange={setQuery}
            placeholder="Rezepte suchen"
            chips={chips}
            onRemoveChip={(k) => setChips(chips.filter((c) => c.key !== k))}
          >
            <Select className="w-44" aria-label="Kategorie"><option>Alle Kategorien</option></Select>
          </FilterBar>
          <DataTable
            caption="Rezepte (gefüllt, auswählbar)"
            columns={COLUMNS}
            rows={ROWS.filter((r) => r.name.toLowerCase().includes(query.toLowerCase()))}
            rowKey={(r) => r.id}
            filtered={query.length > 0}
            onClearFilters={() => setQuery("")}
            selection={{ selected, onChange: setSelected }}
            onRowClick={(r) => toast(`${r.name} öffnen`)}
          />
          <div className="grid gap-4 lg:grid-cols-3">
            <DataTable caption="Lädt" columns={COLUMNS} rows={[]} rowKey={(r) => r.id} state="loading" compact />
            <DataTable caption="Fehler" columns={COLUMNS.slice(0, 2)} rows={[]} rowKey={(r) => r.id} state="error" onRetry={() => toast("Neuer Versuch")} />
            <DataTable
              caption="Leer"
              columns={COLUMNS.slice(0, 2)}
              rows={[]}
              rowKey={(r) => r.id}
              empty={<EmptyState icon={ChefHat} title="Noch keine Rezepte" body="Lege dein erstes Rezept an und sieh sofort, was eine Portion kostet." action={<Button>Rezept anlegen</Button>} />}
            />
          </div>
        </Section>

        <Section id="status" title="Status & Kennzahlen">
          <div className="flex flex-wrap gap-2">
            {["draft", "ordered", "partially_delivered", "delivered", "cancelled"].map((s) => <OrderStatusBadge key={s} status={s} />)}
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <StatTile label="Wareneinsatz (7 Tage)" value="28,4 %" delta={{ text: "+1,2 Pp. ggü. Vorwoche", direction: "up", good: false }} />
            <StatTile label="Lagerwert" value="14.820,00 €" delta={{ text: "−3,1 %", direction: "down", good: true }} />
            <StatTile label="Offene Bestellungen" value="6" />
          </div>
        </Section>

        <Section id="allergens" title="Allergen-Matrix">
          <div className="grid gap-6 lg:grid-cols-2">
            <AllergenMatrix value={allergens} onChange={(a, s) => setAllergens({ ...allergens, [a]: s })} />
            <AllergenMatrix value={allergens} inherited={new Set<Allergen>(["gluten", "celery"])} />
          </div>
        </Section>

        <Section id="overlays" title="Dialoge & Meldungen">
          <div className="flex flex-wrap gap-3">
            <Dialog trigger={<Button variant="secondary">Dialog öffnen</Button>} title="Gebinde hinzufügen" description="Wie der Lieferant die Ware verkauft." footer={<Button>Übernehmen</Button>}>
              <Field label="Bezeichnung"><Input placeholder="z. B. Karton 10 × 1 kg" /></Field>
            </Dialog>
            <ConfirmDialog trigger={<Button variant="danger">Inventur abschließen</Button>} title="Inventur abschließen?" description="Nicht gezählte Artikel behalten ihren Bestand. Das lässt sich nicht rückgängig machen." confirmLabel="Abschließen" danger onConfirm={() => toast.success("Inventur abgeschlossen")} />
            <Button variant="secondary" onClick={() => toast.success("Gespeichert")}>Erfolgsmeldung</Button>
            <Button variant="secondary" onClick={() => toast.error("Speichern fehlgeschlagen", { description: "Bitte erneut versuchen." })}>Fehlermeldung</Button>
          </div>
        </Section>

        <Section id="upload" title="Datei-Import">
          <div className="grid gap-4 lg:grid-cols-2">
            <FileUpload label="Preisliste importieren" onFile={(f) => toast(`${f.name} ausgewählt`)} />
            <FileUpload label="Preisliste importieren" state="done" errors={[{ row: 14, message: "Lieferant „Frischdienst Süd“ existiert nicht." }, { row: 22, message: "Einheit „Bund“ ist unbekannt." }]} onFile={() => {}} />
          </div>
        </Section>

        <Section id="empty" title="Leerer Zustand">
          <EmptyState icon={Package} title="Noch keine Zutaten" body="Importiere die Preisliste deines Lieferanten oder lege Zutaten einzeln an." action={<Button>Zutat anlegen</Button>} />
        </Section>
      </div>
    </AppShell>
  );
}
