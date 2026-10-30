// Builds ui-en.json: every piece of English text the Offrava site shows (buttons, labels, pages).
// The "translate" edge function only translates strings from this list, so nobody can use it for anything else.
// Run from the site folder after changing any screen:  node app/scripts/extract-ui.mjs
// (uses the pinned copy in app/scripts/vendor — nothing is downloaded)
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const acorn = require(process.env.ACORN || new URL("./vendor/acorn.js", import.meta.url).pathname);   // vendored, pinned copy (no install at build time)

const SITE = process.argv[2] || ".";
const SKIP = new Set(["sw.js", "config.js", "native.js"]);
const out = new Set();
const ent = (s) => s.replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&middot;/g, "·");
const norm = (s) => ent(s).replace(/\s+/g, " ").trim();
const looksUi = (s) => /[A-Za-z]{2}/.test(s) && !/^[a-z0-9_.\-/#?=&:]+$/.test(s) && !/^(https?:|#\/|\.\/|data:|mailto:)/.test(s)
  && !/[{};]|=>|\bfunction\b|^\s*[.#][\w-]+\s*$/.test(s) && s.length <= 400
  && !/^[\w-]+(\s[\w-]+)*$/.test(s) || /^[A-Z][a-z]/.test(s) || /\s/.test(s) && /[A-Za-z]/.test(s);
function addText(t) {
  // split HTML into text pieces; "\u0000" marks an inserted value (becomes #)
  for (const piece of t.split(/<[^>]*>/)) {
    const s = norm(piece.replace(/\u0000+/g, "#")).replace(/^[#·\s|,—-]+$/, "");
    if (s && /[A-Za-z]{2}/.test(s) && looksUi(s) && !/^#$/.test(s)) out.add(s);
  }
  for (const m of t.matchAll(/\b(?:placeholder|title|aria-label|alt)="([^"\u0000]*[A-Za-z]{2}[^"\u0000]*)"/g)) out.add(norm(m[1]));
}
function walk(node, fn) {
  if (!node || typeof node.type !== "string") return;
  fn(node);
  for (const k of Object.keys(node)) { const v = node[k]; if (Array.isArray(v)) v.forEach((x) => walk(x, fn)); else if (v && typeof v.type === "string") walk(v, fn); }
}
for (const f of fs.readdirSync(SITE).filter((f) => f.endsWith(".js") && !SKIP.has(f))) {
  const src = fs.readFileSync(path.join(SITE, f), "utf8");
  let ast; try { ast = acorn.parse(src, { ecmaVersion: "latest", sourceType: "script", allowReturnOutsideFunction: true }); } catch (e) { console.error(f, e.message); continue; }
  walk(ast, (n) => {
    if (n.type === "TemplateLiteral") addText(n.quasis.map((q) => q.value.cooked ?? "").join("\u0000"));
    else if (n.type === "Literal" && typeof n.value === "string") {
      const v = n.value;
      if (/<[a-z]/i.test(v)) addText(v);
      else if (/[A-Za-z]{2}/.test(v) && /\s/.test(v.trim()) || /^[A-Z][a-z]+[.!?…]?$/.test(v)) { const s = norm(v); if (looksUi(s)) out.add(s); }
    }
  });
}
// index.html static text
const html = fs.readFileSync(path.join(SITE, "index.html"), "utf8").replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, "");
addText(html);
const list = [...out].filter((s) => s.length >= 2 && s.length <= 400 && !/="|sans-serif|\d+px|rgba?\(|^[a-z-]+:|var\(--/.test(s)).sort();
fs.writeFileSync(path.join(SITE, "ui-en.json"), JSON.stringify({ version: Date.now(), strings: list }));
console.log("ui-en.json:", list.length, "strings");
