// the routing layer. the privacy model lives here:
//   offer screenshots  -> on-device; cloud only if the user switched it on (hybrid prefer_on_device)
//   recovery messages  -> on-device only, never uploaded
//   complaint drafting -> cloud, and only ever given text that redact() already cleaned on the phone
import { initializeApp, type FirebaseApp } from "firebase/app";
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from "firebase/app-check";
import { getAI, getGenerativeModel, GoogleAIBackend, InferenceMode, Schema, type AI, type Part } from "firebase/ai";

export type Source = "on_device" | "in_cloud";
export interface Result<T> { data: T; source: Source }

const config = import.meta.env.VITE_FIREBASE_API_KEY ? {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY, authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN, projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID, storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET, messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
} : null;
const CLOUD_MODEL = import.meta.env.VITE_CLOUD_MODEL || "gemini-3.5-flash";

let app: FirebaseApp | null = null, ai: AI | null = null;
if (config) {
  app = initializeApp(config);
  if (import.meta.env.VITE_RECAPTCHA_ENTERPRISE_KEY) {
    if (import.meta.env.DEV && import.meta.env.VITE_APPCHECK_DEBUG) (self as any).FIREBASE_APPCHECK_DEBUG_TOKEN = import.meta.env.VITE_APPCHECK_DEBUG;
    initializeAppCheck(app, { provider: new ReCaptchaEnterpriseProvider(import.meta.env.VITE_RECAPTCHA_ENTERPRISE_KEY), isTokenAutoRefreshEnabled: true });
  }
  ai = getAI(app, { backend: new GoogleAIBackend() });
}
export const cloudReady = () => !!ai;

// ---------- on-device availability (chrome built-in ai / gemini nano) ----------
declare const LanguageModel: any;
const IMG_IN = { expectedInputs: [{ type: "text", languages: ["en"] }, { type: "image" }], expectedOutputs: [{ type: "text", languages: ["en"] }] };
const TXT_IN = { expectedInputs: [{ type: "text", languages: ["en"] }], expectedOutputs: [{ type: "text", languages: ["en"] }] };
export type Avail = "available" | "downloadable" | "downloading" | "unavailable";
export async function deviceStatus(image = true): Promise<Avail> {
  try { return typeof LanguageModel === "undefined" ? "unavailable" : await LanguageModel.availability(image ? IMG_IN : TXT_IN); }
  catch { return "unavailable"; }
}
/** needs a user gesture in chrome: starts the one-time nano download. */
export async function prepareDevice(onProgress?: (f: number) => void) {
  const s = await LanguageModel.create({ ...IMG_IN, monitor(m: any) { m.addEventListener("downloadprogress", (e: any) => onProgress?.(e.loaded)); } });
  s.destroy?.();
}

// ---------- schemas (cloud uses Schema, device uses plain json schema) ----------
const offerJson = {
  type: "object",
  properties: {
    appName: { type: "string" }, principal: { type: "number" }, repayment: { type: "number" }, fees: { type: "number" },
    interestRate: { type: "number" }, tenorDays: { type: "number" }, dueDate: { type: "string" },
    otherCharges: { type: "array", items: { type: "string" } }, permissions: { type: "array", items: { type: "string" } },
  },
  required: ["appName"],
};
const offerSchema = Schema.object({
  properties: {
    appName: Schema.string(), principal: Schema.number(), repayment: Schema.number(), fees: Schema.number(),
    interestRate: Schema.number(), tenorDays: Schema.number(), dueDate: Schema.string(),
    otherCharges: Schema.array({ items: Schema.string() }), permissions: Schema.array({ items: Schema.string() }),
  },
  optionalProperties: ["principal", "repayment", "fees", "interestRate", "tenorDays", "dueDate", "otherCharges", "permissions"],
});
const FLAG_KINDS = ["contacts", "shaming", "threat", "fake_legal", "abuse", "hidden_charges"];
const msgJson = {
  type: "object",
  properties: {
    sender: { type: "string" }, amountDemanded: { type: "number" },
    flags: { type: "array", maxItems: 8, items: { type: "object", properties: { kind: { type: "string", enum: FLAG_KINDS }, quote: { type: "string", maxLength: 200 } }, required: ["kind", "quote"] } },
  },
  required: ["flags"],
};

const OFFER_PROMPT = `you read a screenshot of a nigerian loan app offer. extract only numbers that are printed on the screen.
- appName: the lender or app name as shown.
- principal: loan amount in naira. repayment: total amount to repay in naira. fees: any upfront/processing/service fee in naira.
- interestRate: the stated interest percent for the loan period, if shown. tenorDays: loan length in days (convert weeks/months: 1 week = 7, 1 month = 30). dueDate as printed.
- otherCharges: any penalties, late fees or rollover charges, quoted. permissions: any phone permissions requested (contacts, sms, gallery, location).
if a value is not visible, leave it out. never guess or calculate. return json only.`;
const MSG_PROMPT = `you read a message a borrower received from a nigerian loan app or debt collector (screenshot or pasted text).
1. sender: the app or company name if stated. amountDemanded: naira amount demanded, if stated.
2. flags: for each problem, at most once per kind, give kind and the exact quote from the message:
- contacts: threatens to contact, or has contacted, the borrower's family, friends, employer or phone contacts
- shaming: calls the borrower a thief, fraudster or criminal, or threatens to publish their photo or name
- threat: intimidation or threats of harm
- fake_legal: uses police, efcc, arrest, court or jail to scare
- abuse: insults
- hidden_charges: penalties or charges
a polite payment reminder has no flags. return json only.`;

function parse<T>(raw: string): T {
  const s = raw.trim().replace(/^```(?:json)?\s*|\s*```$/g, "");
  return JSON.parse(s.slice(s.indexOf("{"), s.lastIndexOf("}") + 1));
}
async function toPart(file: Blob): Promise<Part> {
  const b64 = await new Promise<string>((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(",")[1]); r.onerror = rej; r.readAsDataURL(file); });
  return { type: "inlineData", inlineData: { mimeType: file.type || "image/png", data: b64 } };
}

/** straight chrome prompt api, used when no firebase project is configured (local dev) */
const TIMEOUT_MS = 90_000;
const tooSlow = () => new Error("this took too long on your phone. try again, or paste the text instead.");
/** never leave the user on a spinner: give up after TIMEOUT_MS. */
function withTimeout<T>(p: Promise<T>, onTimeout?: () => void): Promise<T> {
  let t: ReturnType<typeof setTimeout>;
  return Promise.race([p, new Promise<T>((_, rej) => { t = setTimeout(() => { rej(tooSlow()); onTimeout?.(); }, TIMEOUT_MS); })]).finally(() => clearTimeout(t));
}

async function chromePrompt(prompt: string, image: Blob | null, schema: object): Promise<string> {
  const ac = new AbortController();
  const s: any = await withTimeout<any>(LanguageModel.create({ ...(image ? IMG_IN : TXT_IN), signal: ac.signal }), () => ac.abort());
  try {
    const content: any[] = [{ type: "text", value: prompt }];
    if (image) content.push({ type: "image", value: image });
    return await withTimeout(s.prompt([{ role: "user", content }], { ...(schema ? { responseConstraint: schema } : {}), signal: ac.signal }), () => ac.abort());
  } finally { s.destroy?.(); }
}

async function hybrid<T>(prompt: string, image: Blob | null, json: object, cloudSchema: any, mode: "device_only" | "prefer_device" | "cloud_only"): Promise<Result<T>> {
  if (!ai) {
    if (mode === "cloud_only") throw new Error("cloud is not set up in this build");
    const raw = await chromePrompt(prompt, image, json);
    return { data: json ? parse<T>(raw) : (raw as T), source: "on_device" };
  }
  const model = getGenerativeModel(ai, {
    mode: mode === "device_only" ? InferenceMode.ONLY_ON_DEVICE : mode === "cloud_only" ? InferenceMode.ONLY_IN_CLOUD : InferenceMode.PREFER_ON_DEVICE,
    onDeviceParams: { createOptions: (image ? IMG_IN : TXT_IN) as any, promptOptions: json ? { responseConstraint: json } : {} },
    inCloudParams: { model: CLOUD_MODEL, generationConfig: cloudSchema ? { responseMimeType: "application/json", responseSchema: cloudSchema } : undefined },
  });
  const parts: (string | Part)[] = [prompt];
  if (image) parts.push(await toPart(image));
  // the cloud model sometimes answers 500/503 under load: one short retry before giving up.
  const r = await withTimeout(model.generateContent(parts)).catch(async (e) => {
    if (mode === "device_only" || !/\[(500|503)/.test(String(e?.message))) throw e;
    await new Promise((res) => setTimeout(res, 3000));
    return withTimeout(model.generateContent(parts));
  });
  const text = r.response.text();
  return { data: cloudSchema || json ? parse<T>(text) : (text as T), source: (r.response.inferenceSource as Source) || (mode === "cloud_only" ? "in_cloud" : "on_device") };
}

export interface Offer { appName: string; principal?: number; repayment?: number; fees?: number; interestRate?: number; tenorDays?: number; dueDate?: string; otherCharges?: string[]; permissions?: string[] }
export interface MsgRead { text?: string; sender?: string; amountDemanded?: number; flags: { kind: string; quote: string }[] }

export const readOffer = (img: Blob, allowCloud: boolean) => hybrid<Offer>(OFFER_PROMPT, img, offerJson, offerSchema, allowCloud ? "prefer_device" : "device_only");
// screenshots go in two steps: a plain transcription, then text -> json. json-constrained decoding
// straight over an image runs past a minute on nano; each step alone takes a few seconds.
const TRANSCRIBE = "transcribe every message in this screenshot exactly as written, with sender names and times. text only, no commentary.";
export async function readMessage(img: Blob | null, text: string): Promise<Result<MsgRead>> {
  if (img && !text) text = String((await hybrid<string>(TRANSCRIBE, img, null as any, null, "device_only")).data).trim();
  const r = await hybrid<MsgRead>(MSG_PROMPT + `\n\nmessage:\n${text}`, null, msgJson, null, "device_only");
  return { ...r, data: { ...r.data, text } };
}

/** cloud only, redacted text only. the caller must pass redact() output. */
export async function draftComplaint(redactedFacts: string): Promise<Result<string>> {
  const prompt = `write a short, firm complaint to the federal competition and consumer protection commission (fccpc), nigeria, from a borrower about a digital lender's conduct.
use only the facts below. do not invent names, dates, amounts or laws. keep placeholders like [name] exactly as written.
structure: subject line; who the lender is; what happened (dated list if dates exist); the quoted evidence; what the borrower asks fccpc to do (investigate, stop the harassment, review the lender's approval). plain english, under 350 words.
plain text only: no markdown, no asterisks, no # headings, no bold. if the facts name no lender, call it "the lender" and never write a placeholder like [lender name].

facts:
${redactedFacts}`;
  return hybrid<string>(prompt, null, null as any, null, "cloud_only");
}
