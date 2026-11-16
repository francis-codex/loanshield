// pure maths, no ai. every number the user sees comes from here, never from a model.
export interface Terms {
  principal?: number;      // naira the borrower actually receives or is offered
  repayment?: number;      // total naira to pay back
  fees?: number;           // upfront fees deducted or added (naira)
  interestRate?: number;   // stated rate in percent for the tenor (e.g. 15 = 15%)
  tenorDays?: number;      // days until repayment is due
}

export interface Cost {
  disbursed: number;       // what actually lands in the account
  repay: number;           // total owed
  costOfCredit: number;    // repay - disbursed
  periodRate: number;      // cost / disbursed, as a fraction
  apr: number;             // simple annualised percentage rate, fraction
  effectiveAnnual: number; // compounded if rolled over every tenor, fraction
  tenorDays: number;
}

export type Missing = "principal" | "repayment" | "tenorDays";

/** which numbers we still need from the user before any maths is honest. */
export function missing(t: Terms): Missing[] {
  const m: Missing[] = [];
  if (!(t.principal! > 0)) m.push("principal");
  if (!(t.repayment! > 0) && !(t.interestRate! >= 0 && t.interestRate !== undefined)) m.push("repayment");
  if (!(t.tenorDays! > 0)) m.push("tenorDays");
  return m;
}

export function cost(t: Terms): Cost | null {
  if (missing(t).length) return null;
  const principal = t.principal!, fees = Math.max(0, t.fees ?? 0), days = t.tenorDays!;
  const repay = t.repayment! > 0 ? t.repayment! : principal * (1 + t.interestRate! / 100);
  // fees taken upfront shrink what the borrower actually gets.
  const disbursed = Math.max(1, principal - fees);
  const costOfCredit = repay - disbursed;
  const periodRate = costOfCredit / disbursed;
  const apr = periodRate * (365 / days);
  const effectiveAnnual = periodRate > -1 ? Math.pow(1 + periodRate, 365 / days) - 1 : -1;
  return { disbursed, repay, costOfCredit, periodRate, apr, effectiveAnnual, tenorDays: days };
}

export type Level = "ok" | "high" | "severe";
/** bands are ours, stated in the ui as our yardstick, not law. */
export function level(c: Cost): Level {
  if (c.apr >= 1) return "severe";   // 100%+ a year
  if (c.apr >= 0.5) return "high";   // 50%+ a year
  return "ok";
}

export const naira = (n: number) => "₦" + Math.round(n).toLocaleString("en-NG");
export const pct = (f: number) => (f >= 100 ? ">10,000" : (f * 100).toLocaleString("en-NG", { maximumFractionDigits: f < 0.1 ? 1 : 0 })) + "%";
