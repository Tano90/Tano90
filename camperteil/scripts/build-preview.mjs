// Baut die Seite für eine private Claude-Artifact-Vorschau: preview/index.html ohne <html>/<head>/<body>,
// weil der Artifact-Dienst das Gerüst selbst ergänzt. Alle Assets bleiben getrennte Dateien aus dist/.
// Die eigentliche Website ist und bleibt dist/.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const html = readFileSync(join(root, "dist/index.html"), "utf8");
const head = html.slice(html.indexOf("<head>") + 6, html.indexOf("</head>"))
  .replace(/<meta charset[^>]*>\s*/, "")
  .replace(/<meta name="viewport"[^>]*>\s*/, "");
const body = html.slice(html.indexOf("<body>") + 6, html.indexOf("</body>"));
const out = `<meta name="claude:viewport-fit-sides" content="cover">\n${head.trim()}\n${body.trim()}\n`;
mkdirSync(join(root, "preview"), { recursive: true });
writeFileSync(join(root, "preview/index.html"), out);
console.log("preview/index.html", Math.round(out.length / 1024), "KB");
