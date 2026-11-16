// fails the build if a dev-only secret ended up in dist. vite inlines import.meta.env values,
// so a debug token can leak into the public bundle if code reads it the wrong way.
import fs from "node:fs"; import path from "node:path";
const env = Object.fromEntries((fs.existsSync(".env") ? fs.readFileSync(".env", "utf8") : "").split("\n")
  .filter(l => /^[A-Z_]+=/.test(l)).map(l => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]));
const secrets = ["VITE_APPCHECK_DEBUG"].map(k => process.env[k] || env[k]).filter(v => v && v.length > 8);
const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
const hits = secrets.length ? walk("dist").filter(f => { const s = fs.readFileSync(f, "utf8"); return secrets.some(t => s.includes(t)); }) : [];
if (hits.length) { console.error("dev secret found in dist:", hits.join(", ")); process.exit(1); }
console.log("dist clean: no dev secrets");
