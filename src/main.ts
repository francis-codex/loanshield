import "./style.css";
import { cost, level, missing, naira, pct, type Terms } from "./cost";
import { lookup, LIST_LABEL, SCRAPED, SOURCE, type Hit } from "./register";
import { redact } from "./redact";
import { ruleFlags, merge, FLAG_LABEL, type Flag, type FlagKind } from "./flags";
import { readOffer, readMessage, draftComplaint, deviceStatus, prepareDevice, cloudReady, type Source, type Offer } from "./ai";

const $ = <T extends HTMLElement = HTMLElement>(s: string) => document.querySelector(s) as T;
const esc = (s: unknown) => String(s ?? "").replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`);
const badge = (s: Source) => s === "on_device"
  ? `<span class="badge dev">read on your phone, nothing uploaded</span>`
  : `<span class="badge cloud">checked in the cloud</span>`;

// evidence collected across tabs, feeds the complaint
const evidence: { lender?: string; offer?: Offer; flags: Flag[]; messages: string[] } = { flags: [], messages: [] };

$("#app").innerHTML = `
<header><div class="logo">loanshield</div><p class="tag">know the real cost. fight back against harassment.</p></header>
<nav role="tablist">
  <button data-tab="offer" class="on">check offer</button>
  <button data-tab="msg">check message</button>
  <button data-tab="fight">fight back</button>
  <button data-tab="privacy">privacy</button>
</nav>
<div id="device" class="note" hidden></div>

<section id="offer" class="tab on">
  <p class="lead">upload a screenshot of the loan offer. we read the numbers and show what it really costs.</p>
  <label class="drop"><input type="file" accept="image/*" id="offerImg"><span>tap to pick a screenshot</span></label>
  <label class="row"><input type="checkbox" id="allowCloud"> if my phone can't read it, use the cloud (the screenshot leaves your phone)</label>
  <button id="offerGo" class="go" disabled>check this offer</button>
  <details><summary>or type the terms</summary>
    <div class="grid">
      <label>lender / app<input id="t_app"></label>
      <label>you get (₦)<input id="t_p" inputmode="decimal"></label>
      <label>you repay (₦)<input id="t_r" inputmode="decimal"></label>
      <label>upfront fee (₦)<input id="t_f" inputmode="decimal"></label>
      <label>days<input id="t_d" inputmode="numeric"></label>
    </div>
    <button id="typedGo" class="go ghost">work it out</button>
  </details>
  <div id="offerOut"></div>
</section>

<section id="msg" class="tab">
  <p class="lead">got a threatening message from a loan app? check it here. it never leaves your phone.</p>
  <label class="drop"><input type="file" accept="image/*" id="msgImg"><span>tap to pick a screenshot</span></label>
  <textarea id="msgText" rows="5" placeholder="or paste the message"></textarea>
  <button id="msgGo" class="go">check this message</button>
  <div id="msgOut"></div>
</section>

<section id="fight" class="tab">
  <p class="lead">we turn what you checked into a complaint to the fccpc. your name, phone, bvn and account numbers are removed on your phone first.</p>
  <label>your name (we strip it out before anything is sent)<input id="myName" autocomplete="off"></label>
  <label>anything else to add<textarea id="extra" rows="3" placeholder="e.g. they called my sister on 3 nov"></textarea></label>
  <button id="preview" class="go ghost">show what will be sent</button>
  <pre id="redacted" hidden></pre>
  <button id="draftGo" class="go" hidden>draft my complaint</button>
  <div id="draftOut"></div>
</section>

<section id="privacy" class="tab">
  <h3>where your data goes</h3>
  <ul class="plain">
    <li><b>recovery messages:</b> read by gemini nano on your phone. never uploaded, not even as a fallback.</li>
    <li><b>offer screenshots:</b> read on your phone. the cloud is used only if you tick the box.</li>
    <li><b>complaints:</b> drafted in the cloud from text that was already stripped of names, phone numbers, bvn/nin, account and card numbers. you see exactly what is sent first.</li>
    <li><b>lender register:</b> a copy of the fccpc public register ships inside the app. lookups never leave your phone.</li>
  </ul>
  <p class="small">register copied ${esc(SCRAPED)} from <a href="${esc(SOURCE)}" target="_blank" rel="noopener">fccpc.gov.ng</a>. always check the live list before acting.</p>
  <p class="small">loanshield gives information, not legal advice. the cost yardstick (over 50% a year = high, over 100% = severe) is ours, not a legal limit.</p>
</section>
<footer>open source · apache-2.0</footer>`;

document.querySelectorAll<HTMLButtonElement>("nav button").forEach(b => b.onclick = () => {
  document.querySelectorAll("nav button, .tab").forEach(e => e.classList.remove("on"));
  b.classList.add("on"); $("#" + b.dataset.tab).classList.add("on");
});

// ---------- device readiness ----------
async function checkDevice() {
  const s = await deviceStatus(true), box = $("#device");
  if (s === "available") { box.hidden = true; return; }
  box.hidden = false;
  if (s === "unavailable") box.innerHTML = `on-device ai isn't available in this browser. use chrome on desktop or a supported android phone. you can still type offer terms and paste messages; our rule checks still run on your phone.`;
  else { box.innerHTML = `the on-device model needs a one-time download. <button id="dl">download now</button> <span id="dlp"></span>`;
    $("#dl").onclick = async () => { $("#dlp").textContent = "starting…"; try { await prepareDevice(f => $("#dlp").textContent = Math.round(f * 100) + "%"); box.hidden = true; } catch (e) { $("#dlp").textContent = String(e); } }; }
}
checkDevice();

// ---------- register ----------
function registerHtml(name: string): string {
  if (!name) return "";
  const hits = lookup(name);
  const when = `fccpc register, copied ${esc(SCRAPED)}`;
  if (!hits.length) return `<div class="card warn"><b>${esc(name)}</b> is not on the fccpc list as of ${esc(SCRAPED)}. lenders must be approved by fccpc to lend through an app. check the live list before you borrow.<div class="small">${when}</div></div>`;
  const h: Hit = hits[0];
  const tone = h.list === "approved" || h.list === "waiver_cbn_licensed" ? "good" : h.list === "conditional" ? "mid" : "bad";
  const more = hits.length > 1 ? `<div class="small">close matches: ${hits.slice(1).map(x => esc(x.apps || x.company)).join(", ")}</div>` : "";
  return `<div class="card ${tone}"><b>${esc(h.apps || h.company)}</b>${h.company ? ` (${esc(h.company)})` : ""} is on the fccpc <b>${esc(LIST_LABEL[h.list])}</b> list${h.score < 1 ? " (closest match, check the name)" : ""}.${h.remark ? `<div class="small">remark: ${esc(h.remark)}</div>` : ""}${more}<div class="small">${when}</div></div>`;
}

// ---------- offer ----------
function offerHtml(o: Offer, src?: Source) {
  const t: Terms = { principal: o.principal, repayment: o.repayment, fees: o.fees, interestRate: o.interestRate, tenorDays: o.tenorDays };
  const c = cost(t), miss = missing(t);
  let h = src ? badge(src) : "";
  h += registerHtml(o.appName);
  if (c) {
    const lv = level(c);
    h += `<div class="card cost ${lv}">
      <div class="big">${pct(c.apr)} <span>a year</span></div>
      <div class="lines"><div>you get <b>${naira(c.disbursed)}</b></div><div>you repay <b>${naira(c.repay)}</b> in ${c.tenorDays} days</div><div>cost of the loan <b>${naira(c.costOfCredit)}</b> (${pct(c.periodRate)} for ${c.tenorDays} days)</div></div>
      <div class="verdict">${lv === "severe" ? "very expensive. this costs more than double a year." : lv === "high" ? "expensive. look for a cheaper option." : "within our yardstick."}</div></div>`;
  } else h += `<div class="card">need ${miss.map(m => ({ principal: "the amount you get", repayment: "the amount you repay", tenorDays: "the number of days" }[m])).join(", ")} to work out the real cost. type them below.</div>`;
  if (o.otherCharges?.length) h += `<div class="card warn"><b>other charges:</b><ul>${o.otherCharges.map(x => `<li>${esc(x)}</li>`).join("")}</ul></div>`;
  const risky = (o.permissions || []).filter(p => /contact|sms|gallery|photo|call log/i.test(p));
  if (risky.length) h += `<div class="card bad">this app asks for <b>${risky.map(esc).join(", ")}</b>. fccpc rules ban lenders from using your contacts or photos to recover debt.</div>`;
  return h;
}
let offerFile: File | null = null;
$<HTMLInputElement>("#offerImg").onchange = e => { offerFile = (e.target as HTMLInputElement).files?.[0] || null; $<HTMLButtonElement>("#offerGo").disabled = !offerFile; (e.target as HTMLElement).nextElementSibling!.textContent = offerFile?.name || "tap to pick a screenshot"; };
$("#offerGo").onclick = async () => {
  if (!offerFile) return; const out = $("#offerOut"); out.innerHTML = `<div class="spin">reading the screenshot…</div>`;
  try {
    const r = await readOffer(offerFile, $<HTMLInputElement>("#allowCloud").checked);
    evidence.offer = r.data; evidence.lender = r.data.appName;
    out.innerHTML = offerHtml(r.data, r.source);
    const fill = (id: string, v?: number | string) => { if (v != null) $<HTMLInputElement>(id).value = String(v); };
    fill("#t_app", r.data.appName); fill("#t_p", r.data.principal); fill("#t_r", r.data.repayment); fill("#t_f", r.data.fees); fill("#t_d", r.data.tenorDays);
  } catch (e) { out.innerHTML = `<div class="card warn">couldn't read it on this device (${esc((e as Error).message)}). type the terms below, or tick the cloud box and try again.</div>`; }
};
$("#typedGo").onclick = () => {
  const n = (id: string) => { const v = parseFloat($<HTMLInputElement>(id).value.replace(/[₦,\s]/g, "")); return isNaN(v) ? undefined : v; };
  const o: Offer = { appName: $<HTMLInputElement>("#t_app").value.trim(), principal: n("#t_p"), repayment: n("#t_r"), fees: n("#t_f"), tenorDays: n("#t_d") };
  evidence.offer = o; if (o.appName) evidence.lender = o.appName;
  $("#offerOut").innerHTML = offerHtml(o);
};

// ---------- message ----------
let msgFile: File | null = null;
$<HTMLInputElement>("#msgImg").onchange = e => { msgFile = (e.target as HTMLInputElement).files?.[0] || null; (e.target as HTMLElement).nextElementSibling!.textContent = msgFile?.name || "tap to pick a screenshot"; };
function flagsHtml(flags: Flag[]) {
  if (!flags.length) return `<div class="card good">nothing illegal-looking found. a plain payment reminder is allowed.</div>`;
  return flags.map(f => `<div class="card bad"><b>${esc(FLAG_LABEL[f.kind])}</b><q>${esc(f.quote)}</q>${f.source === "rule" ? `<div class="small">found by our word check</div>` : ""}</div>`).join("")
    + `<div class="card">fccpc's digital lending rules ban contacting your family or contacts, shaming, and threats. keep this as evidence. <button class="link" id="toFight">turn it into a complaint →</button></div>`;
}
$("#msgGo").onclick = async () => {
  const text = $<HTMLTextAreaElement>("#msgText").value.trim(), out = $("#msgOut");
  if (!text && !msgFile) return;
  out.innerHTML = `<div class="spin">checking on your phone…</div>`;
  let flags = text ? ruleFlags(text) : [], src: Source | null = null, read = text, sender = "";
  try {
    const r = await readMessage(msgFile, text);
    src = r.source; read = r.data.text || text; sender = r.data.sender || "";
    const model = (r.data.flags || []).filter(f => f.kind in FLAG_LABEL).map(f => ({ kind: f.kind as FlagKind, quote: f.quote, source: "model" as const }));
    flags = merge(model, ruleFlags(read));
  } catch (e) {
    if (!text) { out.innerHTML = `<div class="card warn">on-device ai isn't ready here, so we can't read screenshots yet. paste the message text instead.</div>`; return; }
  }
  if (read) evidence.messages.push(read);
  if (sender && !evidence.lender) evidence.lender = sender;
  evidence.flags = merge(evidence.flags, flags);
  out.innerHTML = (src ? badge(src) : `<span class="badge dev">checked on your phone by our word check</span>`) + (sender ? registerHtml(sender) : "") + flagsHtml(flags);
  $("#toFight")?.addEventListener("click", () => (document.querySelector('[data-tab="fight"]') as HTMLButtonElement).click());
};

// ---------- fight back ----------
function facts(): { text: string; count: number } {
  const o = evidence.offer, lines: string[] = [];
  lines.push(`lender: ${evidence.lender || "[lender name]"}`);
  const reg = evidence.lender ? lookup(evidence.lender)[0] : undefined;
  lines.push(reg ? `fccpc register (${SCRAPED}): on the ${LIST_LABEL[reg.list]} list` : `fccpc register (${SCRAPED}): not found on the list`);
  if (o) { const c = cost(o); if (c) lines.push(`loan: received ${naira(c.disbursed)}, asked to repay ${naira(c.repay)} in ${c.tenorDays} days (${pct(c.apr)} a year)`); }
  for (const f of evidence.flags) lines.push(`${FLAG_LABEL[f.kind]}: "${f.quote}"`);
  const extra = $<HTMLTextAreaElement>("#extra").value.trim(); if (extra) lines.push(`borrower adds: ${extra}`);
  const names = $<HTMLInputElement>("#myName").value.split(/\s+/).filter(w => w.length > 1);
  return redact(lines.join("\n"), names);
}
$("#preview").onclick = () => {
  const f = facts(); const pre = $("#redacted");
  pre.hidden = false; pre.textContent = f.text + `\n\n(${f.count} personal detail${f.count === 1 ? "" : "s"} removed)`;
  const d = $("#draftGo"); d.hidden = false;
  if (!cloudReady()) { d.setAttribute("disabled", ""); d.textContent = "drafting needs the cloud build"; }
};
$("#draftGo").onclick = async () => {
  const out = $("#draftOut"); out.innerHTML = `<div class="spin">drafting…</div>`;
  try {
    const r = await draftComplaint(facts().text);
    out.innerHTML = badge(r.source) + `<textarea id="letter" rows="14">${esc(r.data)}</textarea>
      <div class="acts"><button id="copy" class="go ghost">copy</button><a class="go ghost" href="mailto:contact@fccpc.gov.ng?subject=${encodeURIComponent("complaint: digital lender conduct")}">open email to fccpc</a></div>
      <p class="small">add your name and contact details yourself before you send. check the address on fccpc.gov.ng.</p>`;
    $("#copy").onclick = () => navigator.clipboard.writeText($<HTMLTextAreaElement>("#letter").value);
  } catch (e) { out.innerHTML = `<div class="card warn">${esc((e as Error).message)}</div>`; }
};
