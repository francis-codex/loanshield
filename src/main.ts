import "./style.css";
import { cost, level, missing, naira, pct, type Terms } from "./cost";
import { lookup, LIST_LABEL, SCRAPED, SOURCE, type Hit } from "./register";
import { redact } from "./redact";
import { ruleFlags, merge, FLAG_LABEL, type Flag, type FlagKind } from "./flags";
import { readOffer, readMessage, draftComplaint, deviceStatus, prepareDevice, cloudReady, type Source, type Offer } from "./ai";
import { plainText, lenderLine } from "./text";

const $ = <T extends HTMLElement = HTMLElement>(s: string) => document.querySelector(s) as T;
const esc = (s: unknown) => String(s ?? "").replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`);

// inline icons (stroke = currentColor), so the tab bar and badges follow the theme
const ic = (d: string) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const I = {
  shield: `<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M16 2 4 7v8c0 7.5 5.1 13.4 12 15 6.9-1.6 12-7.5 12-15V7z" fill="var(--acc)"/><path d="m10 16 4 4 8-8" stroke="var(--acc-ink)" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  offer: ic(`<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18M7 15h4"/>`),
  msg: ic(`<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/><path d="M12 8v4M12 15.5v.01"/>`),
  fight: ic(`<path d="M4 4h16v12H5.2L4 17.2z"/><path d="m8 9 3 3 5-5"/>`),
  lock: ic(`<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>`),
  phone: ic(`<rect x="7" y="2" width="10" height="20" rx="2"/><path d="M11 18h2"/>`),
  cloud: ic(`<path d="M7 18a5 5 0 1 1 .9-9.9A6 6 0 0 1 19 10a4 4 0 0 1-1 8z"/>`),
  image: ic(`<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-5-5L5 21"/>`),
  list: ic(`<path d="M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01"/>`),
};
const badge = (s: Source) => s === "on_device"
  ? `<span class="badge dev">${I.phone}read on your phone, nothing uploaded</span>`
  : `<span class="badge cloud">${I.cloud}checked in the cloud</span>`;
const card = (tone: string, head: string, body = "") => `<div class="card ${tone}"><div class="h"><span class="dot"></span>${head}</div>${body ? `<div class="b">${body}</div>` : ""}</div>`;
const spin = (t: string) => `<div class="spin" role="status">${esc(t)}</div>`;
const drop = (id: string) => `<label class="drop">${I.image}<input type="file" accept="image/*" id="${id}"><span class="t">tap to pick a screenshot</span><span class="s">png or jpg from your gallery</span></label>`;

// evidence collected across tabs, feeds the complaint
const evidence: { lender?: string; offer?: Offer; flags: Flag[]; messages: string[] } = { flags: [], messages: [] };

$("#app").innerHTML = `
<header class="top">${I.shield}<div><div class="name">loanshield</div><div class="sub">know the real cost. fight back.</div></div></header>
<div id="device" class="note" hidden></div>

<section id="offer" class="tab on">
  <h1>what will this loan really cost?</h1>
  <p class="lead">add a screenshot of the loan offer. we read the numbers and show the true yearly cost.</p>
  ${drop("offerImg")}
  <label class="check"><input type="checkbox" id="allowCloud"><span>if my phone can't read it, use the cloud. the screenshot leaves your phone.</span></label>
  <button id="offerGo" class="go" disabled>check this offer</button>
  <details class="more"><summary>no screenshot? type the terms</summary>
    <div class="grid">
      <label class="wide">lender or app<input id="t_app" autocomplete="off" placeholder="e.g. quickcash ng"></label>
      <label>loan amount (₦)<input id="t_p" inputmode="decimal" placeholder="20,000"></label>
      <label>you repay (₦)<input id="t_r" inputmode="decimal" placeholder="26,000"></label>
      <label>upfront fee (₦)<input id="t_f" inputmode="decimal" placeholder="0"></label>
      <label>days<input id="t_d" inputmode="numeric" placeholder="14"></label>
    </div>
    <button id="typedGo" class="go ghost">work it out</button>
  </details>
  <div id="offerOut"></div>
</section>

<section id="msg" class="tab">
  <h1>is this message legal?</h1>
  <p class="lead">got a threat from a loan app or debt collector? check it here. it is read on your phone and never uploaded.</p>
  ${drop("msgImg")}
  <div class="or">or</div>
  <textarea id="msgText" rows="5" placeholder="paste the message here"></textarea>
  <button id="msgGo" class="go">check this message</button>
  <div id="msgOut"></div>
</section>

<section id="fight" class="tab">
  <h1>report them to fccpc</h1>
  <p class="lead">we turn what you checked into a complaint. your name, phone, bvn and account numbers are removed on your phone first.</p>
  <ol class="steps"><li class="on" data-s="1">your details</li><li data-s="2">check what's sent</li><li data-s="3">your complaint</li></ol>
  <label>your name<small>we strip it out before anything is sent</small><input id="myName" autocomplete="off"></label>
  <label>anything else to add<textarea id="extra" rows="3" placeholder="e.g. they called my sister on 3 nov"></textarea></label>
  <button id="preview" class="go ghost">show what will be sent</button>
  <pre id="redacted" hidden></pre>
  <button id="draftGo" class="go" hidden>draft my complaint</button>
  <div id="draftOut"></div>
</section>

<section id="privacy" class="tab">
  <h1>where your data goes</h1>
  <p class="lead">private by default. here is exactly what stays on your phone and what doesn't.</p>
  <div class="card"><ul class="rows">
    <li>${I.msg}<div><b>recovery messages</b><span>read by gemini nano on your phone. never uploaded, not even as a fallback.</span></div></li>
    <li>${I.offer}<div><b>offer screenshots</b><span>read on your phone. the cloud is used only if you tick the box.</span></div></li>
    <li>${I.fight}<div><b>complaints</b><span>drafted in the cloud from text already stripped of names, phone numbers, bvn/nin, account and card numbers. you see exactly what is sent first.</span></div></li>
    <li>${I.list}<div><b>lender register</b><span>a copy of the fccpc public register ships inside the app. lookups never leave your phone.</span></div></li>
  </ul></div>
  <p class="small">register copied ${esc(SCRAPED)} from <a href="${esc(SOURCE)}" target="_blank" rel="noopener">fccpc.gov.ng</a>. always check the live list before acting.</p>
  <p class="small">loanshield gives information, not legal advice. the cost yardstick (over 50% a year = high, over 100% = severe) is ours, not a legal limit.</p>
  <footer>open source · apache-2.0</footer>
</section>

<nav role="tablist" aria-label="sections"><div class="in">
  <button data-tab="offer" class="on" role="tab">${I.offer}offer</button>
  <button data-tab="msg" role="tab">${I.msg}message</button>
  <button data-tab="fight" role="tab">${I.fight}fight back</button>
  <button data-tab="privacy" role="tab">${I.lock}privacy</button>
</div></nav>`;

document.querySelectorAll<HTMLButtonElement>("nav button").forEach(b => b.onclick = () => {
  document.querySelectorAll("nav button, .tab").forEach(e => e.classList.remove("on"));
  b.classList.add("on"); $("#" + b.dataset.tab).classList.add("on");
  window.scrollTo({ top: 0 });
});

// ---------- device readiness ----------
async function checkDevice() {
  const s = await deviceStatus(true), box = $("#device");
  if (s === "available") { box.hidden = true; return; }
  box.hidden = false;
  if (s === "unavailable") box.innerHTML = `<span>on-device ai isn't in this browser. use chrome on a supported android phone or desktop. you can still type offer terms and paste messages; our word checks still run on your phone.</span>`;
  else { box.innerHTML = `<span>the on-device model needs a one-time download. <span id="dlp"></span></span><button id="dl" class="link">download</button>`;
    $("#dl").onclick = async () => { $("#dlp").textContent = "starting…"; try { await prepareDevice(f => $("#dlp").textContent = Math.round(f * 100) + "%"); box.hidden = true; } catch (e) { $("#dlp").textContent = String(e); } }; }
}
checkDevice();

// ---------- register ----------
function registerHtml(name: string): string {
  if (!name) return "";
  const hits = lookup(name);
  const when = `<div class="small">fccpc register, copied ${esc(SCRAPED)}</div>`;
  if (!hits.length) return card("warn", `${esc(name)} is not on the fccpc list`, `lenders must be approved by fccpc to lend through an app. check the live list before you borrow.${when}`);
  const h: Hit = hits[0];
  const tone = h.list === "approved" || h.list === "waiver_cbn_licensed" ? "good" : h.list === "conditional" ? "mid" : "bad";
  const more = hits.length > 1 ? `<div class="small">close matches: ${hits.slice(1).map(x => esc(x.apps || x.company)).join(", ")}</div>` : "";
  return card(tone, `${esc(h.apps || h.company)}: ${esc(LIST_LABEL[h.list])}`,
    `${h.company ? esc(h.company) + " is" : "it is"} on the fccpc ${esc(LIST_LABEL[h.list])} list${h.score < 1 ? " (closest match, check the name)" : ""}.${h.remark ? `<div class="small">remark: ${esc(h.remark)}</div>` : ""}${more}${when}`);
}

// ---------- offer ----------
function offerHtml(o: Offer, src?: Source) {
  const t: Terms = { principal: o.principal, repayment: o.repayment, fees: o.fees, interestRate: o.interestRate, tenorDays: o.tenorDays };
  const c = cost(t), miss = missing(t);
  let h = src ? badge(src) : "";
  if (c) {
    const lv = level(c), pos = Math.min(c.apr / 2, 1) * 100; // meter runs 0 to 200% a year
    h += `<div class="card cost ${lv}">
      <div class="label">true cost per year</div>
      <div class="big">${pct(c.apr)}<span>apr</span></div>
      <div class="meter" role="img" aria-label="${lv}"><i style="left:${pos.toFixed(1)}%"></i></div>
      <div class="meter-k"><span>0%</span><span>50%</span><span>100%</span><span>200%+</span></div>
      <div class="stats">
        <div><b>${naira(c.disbursed)}</b><span>you get</span></div>
        <div><b>${naira(c.repay)}</b><span>you repay</span></div>
        <div><b>${naira(c.costOfCredit)}</b><span>cost, ${c.tenorDays} days</span></div>
      </div>
      <div class="verdict">${lv === "severe" ? "very expensive: more than double a year" : lv === "high" ? "expensive: look for a cheaper option" : "within our yardstick"}</div>
      <div class="small">${pct(c.periodRate)} for ${c.tenorDays} days.</div></div>`;
  } else h += card("", "a few numbers are missing", `we need ${miss.map(m => ({ principal: "the loan amount", repayment: "the amount you repay", tenorDays: "the number of days" }[m])).join(", ")} to work out the real cost. <button class="link" id="openTyped">type them in →</button>`);
  h += registerHtml(o.appName);
  if (o.otherCharges?.length) h += card("warn", "other charges", `<ul>${o.otherCharges.map(x => `<li>${esc(x)}</li>`).join("")}</ul>`);
  const risky = (o.permissions || []).filter(p => /contact|sms|gallery|photo|call log/i.test(p));
  if (risky.length) h += card("bad", `asks for ${risky.map(esc).join(", ")}`, "fccpc rules ban lenders from using your contacts or photos to recover debt.");
  return h;
}
function showOffer(html: string) {
  const out = $("#offerOut"); out.innerHTML = html;
  $("#openTyped")?.addEventListener("click", () => { const d = document.querySelector<HTMLDetailsElement>("details.more")!; d.open = true; d.scrollIntoView({ behavior: "smooth" }); });
  out.scrollIntoView({ behavior: "smooth", block: "start" });
}
function picked(e: Event) {
  const inp = e.target as HTMLInputElement, f = inp.files?.[0] || null;
  inp.nextElementSibling!.textContent = f?.name || "tap to pick a screenshot";
  inp.parentElement!.classList.toggle("has", !!f);
  return f;
}
let offerFile: File | null = null;
$<HTMLInputElement>("#offerImg").onchange = e => { offerFile = picked(e); $<HTMLButtonElement>("#offerGo").disabled = !offerFile; };
$("#offerGo").onclick = async () => {
  if (!offerFile) return; const btn = $<HTMLButtonElement>("#offerGo"), out = $("#offerOut");
  btn.disabled = true; out.innerHTML = spin("reading the screenshot…");
  try {
    const r = await readOffer(offerFile, $<HTMLInputElement>("#allowCloud").checked);
    evidence.offer = r.data; evidence.lender = r.data.appName;
    showOffer(offerHtml(r.data, r.source));
    const fill = (id: string, v?: number | string) => { if (v != null) $<HTMLInputElement>(id).value = String(v); };
    fill("#t_app", r.data.appName); fill("#t_p", r.data.principal); fill("#t_r", r.data.repayment); fill("#t_f", r.data.fees); fill("#t_d", r.data.tenorDays);
  } catch (e) { out.innerHTML = card("warn", "couldn't read it on this device", `${esc((e as Error).message)}. type the terms instead, or tick the cloud box and try again.`); }
  finally { btn.disabled = false; }
};
$("#typedGo").onclick = () => {
  const n = (id: string) => { const v = parseFloat($<HTMLInputElement>(id).value.replace(/[₦,\s]/g, "")); return isNaN(v) ? undefined : v; };
  const o: Offer = { appName: $<HTMLInputElement>("#t_app").value.trim(), principal: n("#t_p"), repayment: n("#t_r"), fees: n("#t_f"), tenorDays: n("#t_d") };
  evidence.offer = o; if (o.appName) evidence.lender = o.appName;
  showOffer(offerHtml(o));
};

// ---------- message ----------
let msgFile: File | null = null;
$<HTMLInputElement>("#msgImg").onchange = e => { msgFile = picked(e); };
function flagsHtml(flags: Flag[]) {
  if (!flags.length) return card("good", "nothing illegal-looking found", "a plain payment reminder is allowed.");
  return `<h3>${flags.length} problem${flags.length === 1 ? "" : "s"} found</h3>`
    + flags.map(f => `<div class="card bad"><div class="h"><span class="dot"></span>${esc(FLAG_LABEL[f.kind])}</div><q>${esc(f.quote)}</q>${f.source === "rule" ? `<div class="small">found by our word check</div>` : ""}</div>`).join("")
    + `<div class="card"><div class="b">fccpc's digital lending rules ban contacting your family or contacts, shaming and threats. keep this as evidence.</div><button class="go" id="toFight">turn it into a complaint</button></div>`;
}
$("#msgGo").onclick = async () => {
  const text = $<HTMLTextAreaElement>("#msgText").value.trim(), out = $("#msgOut"), btn = $<HTMLButtonElement>("#msgGo");
  if (!text && !msgFile) { out.innerHTML = `<div class="empty">pick a screenshot or paste the message first.</div>`; return; }
  btn.disabled = true; out.innerHTML = spin("checking on your phone…");
  let flags = text ? ruleFlags(text) : [], src: Source | null = null, read = text, sender = "";
  try {
    const r = await readMessage(msgFile, text);
    src = r.source; sender = r.data.sender || "";
    const model = (r.data.flags || []).filter(f => f.kind in FLAG_LABEL).map(f => ({ kind: f.kind as FlagKind, quote: f.quote, source: "model" as const }));
    read = r.data.text || text || model.map(f => `"${f.quote}"`).join("\n");
    flags = merge(model, ruleFlags(read));
  } catch (e) {
    const slow = /too long/.test(String((e as Error)?.message));
    if (!text) { btn.disabled = false; out.innerHTML = card("warn", slow ? "that took too long" : "can't read screenshots here yet", slow ? esc((e as Error).message) : "on-device ai isn't ready in this browser. paste the message text instead."); return; }
  }
  btn.disabled = false;
  if (read) evidence.messages.push(read);
  if (sender && !evidence.lender) evidence.lender = sender;
  evidence.flags = merge(evidence.flags, flags);
  out.innerHTML = (src ? badge(src) : `<span class="badge dev">${I.phone}checked on your phone by our word check</span>`) + (sender ? registerHtml(sender) : "") + flagsHtml(flags);
  $("#toFight")?.addEventListener("click", () => (document.querySelector('[data-tab="fight"]') as HTMLButtonElement).click());
  out.scrollIntoView({ behavior: "smooth", block: "start" });
};

// ---------- fight back ----------
const step = (n: number) => document.querySelectorAll<HTMLElement>(".steps li").forEach(li => li.classList.toggle("on", Number(li.dataset.s) <= n));
function facts(): { text: string; count: number } {
  const o = evidence.offer, lines: string[] = [];
  const who = lenderLine(evidence.lender);
  if (who) {
    lines.push(who);
    const reg = lookup(evidence.lender!)[0];
    lines.push(reg ? `fccpc register (${SCRAPED}): on the ${LIST_LABEL[reg.list]} list` : `fccpc register (${SCRAPED}): not found on the list`);
  }
  if (o) { const c = cost(o); if (c) lines.push(`loan: received ${naira(c.disbursed)}, asked to repay ${naira(c.repay)} in ${c.tenorDays} days (${pct(c.apr)} a year)`); }
  for (const f of evidence.flags) lines.push(`${FLAG_LABEL[f.kind]}: "${f.quote}"`);
  const extra = $<HTMLTextAreaElement>("#extra").value.trim(); if (extra) lines.push(`borrower adds: ${extra}`);
  const names = $<HTMLInputElement>("#myName").value.split(/\s+/).filter(w => w.length > 1);
  return redact(lines.join("\n"), names);
}
$("#preview").onclick = () => {
  const f = facts(), pre = $("#redacted");
  pre.hidden = false;
  pre.textContent = (f.text || "nothing yet. check an offer or a message first, or add details above.") + `\n\n(${f.count} personal detail${f.count === 1 ? "" : "s"} removed)`;
  const d = $("#draftGo"); d.hidden = false; step(2);
  if (!cloudReady()) { d.setAttribute("disabled", ""); d.textContent = "drafting needs the cloud build"; }
};
const mailto = (body: string) => `mailto:contact@fccpc.gov.ng?subject=${encodeURIComponent("complaint: digital lender conduct")}&body=${encodeURIComponent(body.slice(0, 1800))}`;
$("#draftGo").onclick = async () => {
  const out = $("#draftOut"), btn = $<HTMLButtonElement>("#draftGo");
  btn.disabled = true; out.innerHTML = spin("drafting your complaint…");
  try {
    const r = await draftComplaint(facts().text), letter = plainText(r.data);
    out.innerHTML = badge(r.source) + `<textarea id="letter" rows="14" aria-label="your complaint">${esc(letter)}</textarea>
      <div class="acts"><button id="copy" class="go ghost">copy</button><a id="mail" class="go" href="${mailto(letter)}">email fccpc</a></div>
      <p class="small">add your name and contact details yourself before you send. check the address on fccpc.gov.ng.</p>`;
    step(3);
    const ta = $<HTMLTextAreaElement>("#letter");
    ta.oninput = () => $<HTMLAnchorElement>("#mail").href = mailto(ta.value);
    $("#copy").onclick = async () => { await navigator.clipboard.writeText(ta.value); $("#copy").textContent = "copied"; setTimeout(() => $("#copy").textContent = "copy", 1500); };
  } catch (e) { out.innerHTML = card("warn", "couldn't draft it", esc((e as Error).message)); }
  finally { btn.disabled = false; }
};
