// plain-text helpers shared by the ui and tests. no dom in here.

/** the cloud model sometimes answers in markdown. the letter goes into a textarea and an email, so flatten it. */
export function plainText(s: string): string {
  return String(s ?? "")
    .replace(/\r/g, "")
    .replace(/^\s{0,3}#{1,6}\s*/gm, "")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/__(.+?)__/g, "$1")
    .replace(/^(\s*)[*+]\s+/gm, "$1- ")
    .replace(/(^|[^\w*])\*(?!\s)([^*\n]+?)\*(?!\w)/g, "$1$2")
    .replace(/`([^`\n]+)`/g, "$1")
    .replace(/\*\*/g, "")
    .replace(/\[lender name\]\s*\(([^)]+)\)/gi, "$1")
    .replace(/\[lender name\]/gi, "the lender")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** the facts line for the lender, or nothing when we don't know who it is. */
export function lenderLine(lender?: string): string | null {
  const l = (lender || "").trim();
  return l ? `lender: ${l}` : null;
}
