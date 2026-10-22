// Baut eine eigenständige Vorschau (eine HTML-Datei, Schriften als data:-URIs) nach dist/camperteil-vorschau.html.
// Für Hosts, die nur eine Datei annehmen. Die eigentliche Website sind index.html und assets/.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const html = readFileSync(join(root, "index.html"), "utf8");
let css = readFileSync(join(root, "assets/css/site.css"), "utf8");
css = css.replace(/url\("\.\.\/fonts\/([^"]+)"\)/g, (_, f) => `url("data:font/woff2;base64,${readFileSync(join(root, "assets/fonts", f)).toString("base64")}")`);
const js = readFileSync(join(root, "assets/js/app.js"), "utf8");
const body = html.split("<!--BODY-START-->")[1].split("<!--BODY-END-->")[0]
  .replace(/href="(impressum|datenschutz)\.html"/g, 'href="#fragen"');

const out = `<title>Camperteil</title>
<meta name="claude:viewport-fit-sides" content="cover">
<style>${css}</style>
${body}
<script>${js}</script>
`;
mkdirSync(join(root, "dist"), { recursive: true });
writeFileSync(join(root, "dist/camperteil-vorschau.html"), out);
console.log("dist/camperteil-vorschau.html", Math.round(out.length / 1024), "KB");
