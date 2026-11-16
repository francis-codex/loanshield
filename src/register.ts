import data from "./data/register.json";

export type ListName = "approved" | "conditional" | "watchlist" | "delisted" | "waiver_cbn_licensed";
export interface Hit { list: ListName; company?: string; apps: string; remark?: string; score: number }

export const SCRAPED = data.scraped as string;
export const SOURCE = data.source as string;

const STOP = new Set(["app", "apps", "limited", "ltd", "nigeria", "nig", "the", "under", "developer", "name", "loan", "loans", "credit", "finance", "microfinance", "bank", "mfb", "plc", "and", "of", "by", "tech", "technologies", "technology", "company", "services", "n/a"]);
export const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
const words = (s: string) => norm(s).split(" ").filter(w => w.length > 1 && !STOP.has(w));

interface Row { list: ListName; company?: string; apps: string; remark?: string; names: string[] }
const ROWS: Row[] = [];
for (const [list, rows] of Object.entries(data.lists) as [ListName, Record<string, string>[]][]) {
  for (const r of rows) {
    const apps = r["name of app(s)"] ?? "", company = r["name of company"];
    const names = apps.split(/,|\/|\band\b/i).map(norm).filter(Boolean);
    if (company) names.push(norm(company));
    ROWS.push({ list, company, apps, remark: r["remark"] || undefined, names });
  }
}

/** best matches for an app or company name. exact app name beats word overlap. */
export function lookup(q: string, limit = 3): Hit[] {
  const qn = norm(q), qw = words(q);
  if (!qn) return [];
  const hits: Hit[] = [];
  for (const r of ROWS) {
    let best = 0;
    for (const n of r.names) {
      const nn = n.replace(/\b(app|apps|limited|ltd)\b/g, "").trim();
      if (n === qn || nn === qn.replace(/\b(app|apps)\b/g, "").trim()) best = Math.max(best, 1);
      else {
        const nw = words(n); if (!nw.length || !qw.length) continue;
        const common = qw.filter(w => nw.includes(w)).length;
        if (common) best = Math.max(best, 0.9 * common / Math.max(qw.length, nw.length));
      }
    }
    if (best >= 0.45) hits.push({ list: r.list, company: r.company, apps: r.apps, remark: r.remark, score: best });
  }
  return hits.sort((a, b) => b.score - a.score).slice(0, limit);
}

export const LIST_LABEL: Record<ListName, string> = {
  approved: "on the fccpc approved list",
  conditional: "on the fccpc conditional approval list",
  watchlist: "on the fccpc watchlist",
  delisted: "on the fccpc delisted list",
  waiver_cbn_licensed: "listed by fccpc as cbn-licensed",
};
