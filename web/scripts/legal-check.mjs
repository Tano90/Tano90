// Fails while the operator details for the legal pages are incomplete. Part of the /replica-deploy preflight.
import { readFileSync } from "node:fs";
const src = readFileSync(new URL("../src/lib/legal.ts", import.meta.url), "utf8");
const block = src.slice(src.indexOf("export const OPERATOR"), src.indexOf("};", src.indexOf("export const OPERATOR")));
const missing = [...block.matchAll(/^\s+(\w+): null as/gm)].map((m) => m[1]);
if (missing.length) {
  console.error(`Legal pages incomplete. Fill in src/lib/legal.ts → OPERATOR: ${missing.join(", ")}`);
  process.exit(1);
}
console.log("Operator details complete. Have a lawyer review /legal/imprint, /legal/privacy and /legal/terms before launch.");
