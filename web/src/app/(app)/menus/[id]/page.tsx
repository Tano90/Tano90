import { notFound } from "next/navigation";
import { PageHeader } from "@/components/app/page-header";
import { getLibrary, getMenu, listCategories, listRecipes } from "@/data/repo";
import { canEditLibrary, requireSession } from "@/data/session";
import { formatCents, formatQty } from "@/lib/format";
import { formatBase } from "@/lib/units-display";
import { MenuEditor } from "../menu-editor";
import { ServingsPicker } from "../servings-picker";

export default async function MenuPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ servings?: string }> }) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const s = await requireSession();
  const isNew = id === "new";
  const servings = Math.min(Math.max(Math.round(Number(sp.servings) || 1), 1), 10000);
  const found = isNew ? null : await getMenu(s, id, servings);
  if (!isNew && (!found || found.menu.archivedAt)) notFound();
  const [recipes, categories, library] = await Promise.all([listRecipes(s), listCategories(s, "menu"), getLibrary(s)]);
  const bomTotal = found?.bom.lines.reduce((sum, l) => sum + (l.costCents ?? 0), 0) ?? 0;
  return (
    <>
      <PageHeader title={found?.menu.name ?? "Neues Menü"} back={{ href: "/menus", label: "Menüs" }} />
      <MenuEditor
        menu={found?.menu ?? null}
        recipes={recipes.map((r) => ({ id: r.id, name: r.name, perPortionCents: r.perPortionCents, missing: r.missing }))}
        categories={categories.map((c) => ({ value: c.id, label: c.name }))}
        defaultVatBp={library.defaultVatBp}
        canEdit={canEditLibrary(s.role)}
      />
      {found && (
        <section aria-labelledby="bom" className="mt-10 flex flex-col gap-3">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 id="bom" className="text-lg">Stückliste</h2>
              <p className="text-text-muted">Alle Zutaten über alle Unterrezepte, für {formatQty(servings)} {servings === 1 ? "Gast" : "Gäste"}. Gespeicherter Stand.</p>
            </div>
            <ServingsPicker value={servings} />
          </div>
          {found.bom.unknown > 0 && (
            <p className="text-sm text-warning">{found.bom.unknown} Zeile(n) ließen sich nicht umrechnen (fehlende Ausbeute oder Umrechnung) und fehlen in der Liste.</p>
          )}
          <div className="overflow-x-auto rounded-md border border-border bg-bg">
            <table className="w-full text-sm">
              <caption className="sr-only">Stückliste</caption>
              <thead className="bg-surface text-xs text-text-muted">
                <tr className="h-(--size-table-row)">
                  <th scope="col" className="px-3 text-left">Zutat</th>
                  <th scope="col" className="px-3 text-right">Menge</th>
                  <th scope="col" className="px-3 text-right">Kosten</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {found.bom.lines.map((l) => (
                  <tr key={l.ingredientId} className="h-(--size-table-row)">
                    <td className="px-3">{l.name}</td>
                    <td className="num px-3 text-right">{formatBase(l.quantityBase, l.baseUnit)}</td>
                    <td className="num px-3 text-right">{l.costCents === null ? "kein Preis" : formatCents(Math.round(l.costCents))}</td>
                  </tr>
                ))}
                {found.bom.lines.length === 0 && (
                  <tr><td colSpan={3} className="px-3 py-6 text-center text-text-muted">Noch keine Gerichte im Menü.</td></tr>
                )}
              </tbody>
              {found.bom.lines.length > 0 && (
                <tfoot>
                  <tr className="h-(--size-table-row) border-t border-border font-semibold">
                    <td className="px-3" colSpan={2}>Summe</td>
                    <td className="num px-3 text-right">{formatCents(Math.round(bomTotal))}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </section>
      )}
    </>
  );
}
