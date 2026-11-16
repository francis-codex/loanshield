// runs on the phone before anything goes to the cloud. regex first, then the names the user typed.
export interface Redaction { text: string; count: number }
const RULES: [RegExp, string][] = [
  [/[\w.+-]+@[\w-]+\.[\w.]+/g, "[email]"],
  [/(?:\+?234|0)[789][01]\d[\s-]?\d{3}[\s-]?\d{4}\b/g, "[phone]"],
  [/\b\d{11}\b/g, "[id number]"],         // bvn / nin length
  [/\b\d{10}\b/g, "[account number]"],    // nuban
  [/\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{2,4}\b/g, "[card]"],
  [/\b(?:[Dd]ear|[Hh]ello|[Hh]i|M[Rr]|M[Rr][Ss]|M[Ii][Ss][Ss]|M[Ss]|[Aa]ttention|DEAR|HELLO)\.?,?\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/g, "$NAME"],
];
export function redact(input: string, names: string[] = []): Redaction {
  let text = input, count = 0;
  for (const [re, rep] of RULES) {
    text = text.replace(re, (m, g1) => {
      count++;
      return rep === "$NAME" ? m.replace(g1, "[name]") : rep;
    });
  }
  for (const n of names.map(s => s.trim()).filter(s => s.length > 1)) {
    const re = new RegExp(n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
    text = text.replace(re, () => (count++, "[name]"));
  }
  return { text, count };
}
