// Generates CSS custom properties and the Tailwind v4 theme from replica/design/tokens.json.
// Run after every token change (npm run tokens; dev and build run it automatically).
//   replica/design/tokens.css     plain custom properties, for reference and non-Tailwind use
//   web/src/styles/tokens.css     the same, plus the @theme mapping Tailwind reads
//   web/src/styles/tokens.json    a copy for code (the bundler cannot import from outside web/)
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "../..");
const tokens = JSON.parse(readFileSync(resolve(root, "replica/design/tokens.json"), "utf8"));

const px = (n) => (n === 0 ? "0" : `${n / 16}rem`);
const header = "/* Generated from replica/design/tokens.json by web/scripts/build-tokens.mjs. Do not edit. */\n";

const vars = [];
for (const [name, value] of Object.entries(tokens.color)) vars.push(`--color-${name}: ${value};`);
for (const [name, value] of Object.entries(tokens.font)) vars.push(`--font-${name}: ${value};`);
for (const [name, t] of Object.entries(tokens.type)) {
  vars.push(`--text-${name}: ${px(t.size)};`);
  vars.push(`--text-${name}--line-height: ${px(t.line)};`);
  vars.push(`--text-${name}--font-weight: ${t.weight};`);
}
for (const [name, value] of Object.entries(tokens.radius)) vars.push(`--radius-${name}: ${value === 999 ? "9999px" : px(value)};`);
for (const [name, value] of Object.entries(tokens.shadow)) vars.push(`--shadow-${name}: ${value};`);
vars.push(`--duration-fast: ${tokens.motion.fast};`, `--duration-base: ${tokens.motion.base};`, `--ease-standard: ${tokens.motion.ease};`);
for (const [name, value] of Object.entries(tokens.layout)) {
  if (typeof value === "number") vars.push(`--size-${name}: ${px(value)};`);
}

const plain = `${header}:root {\n${vars.map((v) => `  ${v}`).join("\n")}\n}\n`;
writeFileSync(resolve(root, "replica/design/tokens.css"), plain);

// Tailwind v4: a namespace reset (--color-*: initial) removes the default palette,
// so components can only use token roles (bg-surface, text-muted), never raw colours.
const breakpoints = Object.entries(tokens.layout.breakpoints).map(([k, v]) => `  --breakpoint-${k}: ${px(v)};`);
const theme = `${header}@theme {
  --color-*: initial;
  --font-*: initial;
  --text-*: initial;
  --radius-*: initial;
  --shadow-*: initial;
  --breakpoint-*: initial;
  --color-transparent: transparent;
  --color-current: currentColor;
  /* 4px base: use p-0 1 2 3 4 6 8 12 16 only (tokens.space) */
  --spacing: 0.25rem;
${vars.map((v) => `  ${v}`).join("\n")}
${breakpoints.join("\n")}
}
`;
writeFileSync(resolve(root, "web/src/styles/tokens.css"), theme);
writeFileSync(resolve(root, "web/src/styles/tokens.json"), JSON.stringify(tokens, null, 2) + "\n");
console.log(`tokens: ${vars.length} variables written`);
