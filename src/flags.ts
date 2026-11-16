// deterministic safety net under the on-device model: if either sees it, we show it.
export type FlagKind = "contacts" | "shaming" | "threat" | "fake_legal" | "abuse" | "hidden_charges";
export interface Flag { kind: FlagKind; quote: string; source: "rule" | "model" }

export const FLAG_LABEL: Record<FlagKind, string> = {
  contacts: "threatens or contacts your family, friends or phone contacts",
  shaming: "debt-shaming: calls you a thief/fraudster or threatens to publish you",
  threat: "threats or intimidation",
  fake_legal: "police, efcc, court or arrest threats used to scare you",
  abuse: "insults or abusive language",
  hidden_charges: "charges or penalties you were not told about",
};

const RULES: [FlagKind, RegExp][] = [
  ["contacts", /\b(your )?(contacts?|family|relatives|friends|colleagues|employer|guarantors?|phone ?book)\b.{0,60}\b(call|message|text|inform|tell|contact|broadcast|send|notify)|\b(call|message|text|inform|tell|contact|broadcast|send|notify)\w*\b.{0,60}\b(your )?(contacts|family|relatives|friends|colleagues|employer|phone ?book)\b/i],
  ["shaming", /\b(thief|fraudster|scammer|criminal|debtor|ole|wanted)\b|\b(post|publish|broadcast|share|circulate)\w*\b.{0,40}\b(picture|photo|face|name|status|social media|facebook|whatsapp)/i],
  ["threat", /\b(deal with you|regret|you will see|last warning|we are coming|we know where|your house|your office|consequences|by force)\b/i],
  ["fake_legal", /\b(police|efcc|dss|arrest|warrant|court|jail|prison|lawsuit|prosecut\w*|interpol)\b/i],
  ["abuse", /\b(idiot|stupid|fool|useless|mumu|ode|bastard|animal|shameless|goat)\b/i],
  ["hidden_charges", /\b(penalty|late fee|daily charge|rollover|extension fee|service charge)\b/i],
];

export function ruleFlags(text: string): Flag[] {
  const out: Flag[] = [];
  const lines = text.split(/(?<=[.!?\n])\s+/).map(s => s.trim()).filter(Boolean);
  for (const [kind, re] of RULES) {
    const line = lines.find(l => re.test(l));
    if (line) out.push({ kind, quote: line.slice(0, 220), source: "rule" });
  }
  return out;
}

export function merge(model: Flag[], rules: Flag[]): Flag[] {
  const seen = new Map<FlagKind, Flag>();
  for (const f of [...model, ...rules]) if (!seen.has(f.kind)) seen.set(f.kind, f);
  return [...seen.values()];
}
