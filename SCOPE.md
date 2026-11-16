# loanshield: scope (BuildHybridAI 2026) — written 16 Nov 2026

working name, rename any time. deadline 30 Nov 2026 23:00 WAT. judging 10 Dec.

## one line
a borrower's shield against predatory nigerian loan apps: private stuff is read on the phone, the cloud only ever sees redacted facts.

## judging (4 criteria, equal weight, 1-5 each) -> how we score
1. tech implementation (how well it uses firebase ai logic hybrid) -> the on-device/cloud split IS the privacy model, not decoration.
2. design (complete product, not a poc) -> 3 polished flows, mobile-first web, real empty/error/fallback states.
3. potential impact (real problem, real audience, shown in demo) -> nigerian loan-app abuse, FCCPC register + regs, demo on realistic cases.
4. quality of idea (non-obvious use of ai logic) -> "raw never leaves the device" routing per data sensitivity.
stage one is pass/fail on requirements: miss one and nothing else matters (checklist below).

## the three flows
1. check an offer: screenshot of a loan offer -> nano extracts terms (json) -> code computes true apr + total cost -> register lookup -> verdict card. missing terms (fee, tenor) = we ask, never guess.
2. check a message: screenshot/paste of a recovery sms/whatsapp -> nano flags: threats, debt-shaming, contacting family/contacts, fake police/legal threats, abusive language -> evidence card with the exact lines. ON-DEVICE ONLY; if nano is unavailable, the user labels it by hand. never uploaded.
3. fight back (cloud, opt-in): on-device redaction strips names/numbers -> cloud gemini drafts an FCCPC complaint from the redacted facts + evidence card. user copies or emails it themselves.
stretch (only if 1-3 are done by 25 Nov): opt-in public "what lenders really charge" page from anonymised apr data (firestore).

## hybrid routing (the core story)
- offer extraction: prefer on-device; cloud fallback only after explicit consent ("this screenshot will be sent to google to read it").
- message analysis: on-device only.
- complaint drafting + plain-language explanation: cloud, redacted input only.
- apr math + register lookup: plain code, no ai.

## risks -> closed how
- judges lack nano -> hybrid fallback works anywhere; video films the on-device path in francis's chrome (proven 13.8s, correct json).
- screenshots omit terms -> "missing" prompts; apr computed only from confirmed numbers.
- defamation of lenders -> wording "not on the FCCPC approved list as of <date>", never "illegal"; register stamped with scrape date.
- regulation claims -> quote FCCPC rules only after reading the official text; link the source in-app.
- no test data / PII rule -> we build our own fake loan-app screens + fake messages; zero real people in repo, video or demo.
- debt privacy (francis) -> his own loans never appear anywhere.
- api keys in repo (banned) -> app check + firebase config only, no secrets committed.
- register changes / site down -> bundled json snapshot, refreshed by script.

## stage-one checklist (all required)
- [ ] firebase ai logic, hybrid inference (chrome built-in ai / nano) used for real
- [ ] firebase app check on
- [ ] public repo, apache-2.0 license, no secrets/pii
- [ ] hosted demo url (firebase hosting), free, no login (or test creds in instructions)
- [ ] youtube video <= 3 min
- [ ] text description: value + how firebase ai logic hybrid is used
- [ ] summary of what was built in the period (new project, so all of it)
- [ ] english
- [ ] francis joins the hackathon on devpost (his click)

## stack
vite + typescript web app, firebase js sdk (ai logic hybrid mode, app check, hosting, firestore only if stretch). no backend of our own.

## timeline
- 17 nov: repo + firebase project, hybrid hello-world in chrome, register scraped to json, fake test screens built
- 18-19: flow 1 end to end
- 20-21: flow 2 + redaction
- 22: flow 3
- 23: DEMO VIDEO v1 cut (50% rule), design pass
- 24-26: polish, fallbacks, app check, deploy, quota sprint 3 request by 25 nov 10am PT if needed
- 27-28: final video, description, submit by 28 nov (2 days buffer)

## francis's actions only
join on devpost · firebase/google sign-in + project create approval · youtube upload · final submit click.
