"use client";

import { ALLERGENS } from "@/lib/allergen-labels";
import { cn } from "@/lib/cn";

export { ALLERGENS };
export type Allergen = (typeof ALLERGENS)[number][0];

// Same order as the database enum: a higher index wins when a recipe inherits from its ingredients.
export const STATUSES = [
  ["unknown", "Unbekannt"], ["free", "Frei"], ["may_contain", "Spuren"], ["contains", "Enthält"],
] as const;
export type AllergenStatus = (typeof STATUSES)[number][0];

const STATUS_STYLE: Record<AllergenStatus, string> = {
  unknown: "bg-warning-subtle text-warning",
  free: "bg-success-subtle text-success",
  may_contain: "bg-info-subtle text-info",
  contains: "bg-danger-subtle text-danger",
};

type Props = {
  value: Partial<Record<Allergen, AllergenStatus>>;
  /** Read-only when omitted (recipe view shows inherited values). */
  onChange?: (allergen: Allergen, status: AllergenStatus) => void;
  /** Allergens whose value comes from ingredients, marked "geerbt". */
  inherited?: Set<Allergen>;
};

/**
 * One row per allergen, one radio group per row: arrow keys move between statuses,
 * Tab moves to the next allergen. Unknown is shown as a warning, never as "free".
 */
export function AllergenMatrix({ value, onChange, inherited }: Props) {
  return (
    <div className="relative overflow-x-auto">
    <table className="w-full border-collapse text-sm">
      <caption className="sr-only">Allergene nach EU-Verordnung 1169/2011</caption>
      <thead>
        <tr className="h-(--size-table-row) border-b border-border text-xs text-text-muted">
          <th scope="col" className="px-3 text-left">Allergen</th>
          <th scope="col" className="px-3 text-left">Status</th>
        </tr>
      </thead>
      <tbody>
        {ALLERGENS.map(([key, label]) => {
          const status = value[key] ?? "unknown";
          return (
            <tr key={key} className="h-(--size-table-row) border-b border-border last:border-0">
              <th scope="row" className="px-2 text-left font-normal sm:px-3">
                {label}
                {inherited?.has(key) && <span className="ml-2 text-xs text-text-muted">geerbt</span>}
              </th>
              <td className="px-2 sm:px-3">
                {onChange ? (
                  <div role="radiogroup" aria-label={label} className="inline-flex rounded-sm border border-border-input">
                    {STATUSES.map(([s, sLabel]) => (
                      <label
                        key={s}
                        className={cn(
                          "cursor-pointer border-r border-border-input px-1.5 py-1 text-xs last:border-r-0 sm:px-2.5",
                          "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-focus-ring",
                          status === s ? STATUS_STYLE[s] : "text-text-muted",
                        )}
                      >
                        <input
                          type="radio"
                          className="sr-only"
                          name={`allergen-${key}`}
                          checked={status === s}
                          onChange={() => onChange(key, s)}
                        />
                        {sLabel}
                      </label>
                    ))}
                  </div>
                ) : (
                  <span className={cn("inline-flex h-6 items-center rounded-pill px-2 text-xs", STATUS_STYLE[status])}>
                    {STATUSES.find(([s]) => s === status)?.[1]}
                  </span>
                )}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
    </div>
  );
}
