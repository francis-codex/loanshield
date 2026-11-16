import { describe, it, expect } from "vitest";
import { cost, missing, level } from "../src/cost";
import { lookup } from "../src/register";
import { redact } from "../src/redact";
import { ruleFlags } from "../src/flags";

describe("cost", () => {
  it("needs principal, repayment and tenor before any maths", () => {
    expect(missing({ principal: 10000 })).toEqual(["repayment", "tenorDays"]);
    expect(cost({ principal: 10000, tenorDays: 7 })).toBeNull();
  });
  it("upfront fees shrink what you actually get", () => {
    const c = cost({ principal: 10000, fees: 1500, repayment: 12000, tenorDays: 7 })!;
    expect(c.disbursed).toBe(8500);
    expect(c.costOfCredit).toBe(3500);
    expect(c.apr).toBeCloseTo((3500 / 8500) * (365 / 7), 6);
    expect(level(c)).toBe("severe");
  });
  it("stated rate works without a repayment figure", () => {
    const c = cost({ principal: 100000, interestRate: 2, tenorDays: 30 })!;
    expect(c.repay).toBe(102000);
    expect(level(c)).toBe("ok");
  });
});

describe("register", () => {
  it("finds an approved app by name", () => {
    expect(lookup("Clan App")[0]?.list).toBe("approved");
  });
  it("finds a watchlist app", () => {
    expect(lookup("cashlawn")[0]?.list).toBe("watchlist");
  });
  it("made-up names do not match", () => {
    expect(lookup("zzqx kudirush")).toEqual([]);
  });
});

describe("redact", () => {
  it("strips phones, accounts, bvn, emails and named people", () => {
    const r = redact("Dear Chidi Okeke, pay 0123456789 or call 08031234567, bvn 22123456789, mail a@b.com. Tunde too.", ["Tunde"]);
    expect(r.text).not.toMatch(/Chidi|0803|0123456789|22123456789|a@b.com|Tunde/);
    expect(r.count).toBeGreaterThanOrEqual(6);
  });
});

describe("flags", () => {
  it("catches contacts, shaming and fake legal threats", () => {
    const f = ruleFlags("Pay today or we will message all your contacts that you are a thief. EFCC will arrest you.").map(x => x.kind);
    expect(f).toEqual(expect.arrayContaining(["contacts", "shaming", "fake_legal"]));
  });
  it("a polite reminder raises nothing", () => {
    expect(ruleFlags("Hi, a reminder that your repayment of N12,000 is due on Friday. Thank you.")).toEqual([]);
  });
});
