# loanshield

know what a loan really costs, and fight back when a loan app harasses you. private by default.

built for the firebase hybrid ai hackathon (nov 2026). in nigeria, digital lenders hide the real cost of short loans behind "service fees", then recover debt by messaging the borrower's contacts, calling them thieves and threatening arrest. the fccpc's digital lending rules ban this, but borrowers rarely have the evidence in order or know where to send it. the messages they need to report are exactly the ones they don't want uploaded anywhere.

## what it does

- **check offer.** pick a screenshot of a loan offer. gemini nano reads the numbers on the phone; deterministic code works out the real yearly cost, flags hidden charges and risky permissions (contacts, sms, gallery), and checks the lender against a bundled copy of the fccpc register.
- **check message.** pick or paste a recovery message. it is read **only on the device** and checked for contacting your people, shaming, threats, fake legal threats, abuse and hidden charges. a rule-based check runs alongside the model so nothing obvious is missed.
- **fight back.** turns what you checked into a complaint to the fccpc. names, phone numbers, bvn/nin, account and card numbers are stripped **on the device** first, you see exactly what will be sent, and only then is the cloud model asked to draft the letter.

## why hybrid

| task | where | why |
| --- | --- | --- |
| read recovery messages | on-device only (`ONLY_ON_DEVICE`) | the most private thing on the phone. never uploaded, no fallback. |
| read offer screenshots | on-device, cloud only if the user opts in (`PREFER_ON_DEVICE`) | private by default, still works on phones without nano. |
| draft the complaint | cloud (`ONLY_IN_CLOUD`) | needs a stronger writer; receives redacted text only. |
| cost maths, register lookup, redaction, rule flags | plain code on the device | numbers and legal status should never come from a model's guess. |

every result shows a badge: "read on your phone" or "checked in the cloud", taken from firebase ai logic's `inferenceSource`.

## stack

vite + typescript, firebase ai logic (`firebase/ai`, hybrid inference with gemini nano in chrome), firebase app check (recaptcha enterprise), firebase hosting. no backend of our own.

## run it

```
npm install
cp .env.example .env.local   # fill in your firebase web config
npm run dev
```

on-device inference needs chrome with the built-in prompt api (gemini nano). without a firebase config the app talks to chrome's prompt api directly, and complaint drafting is disabled.

```
npx vitest run   # cost, register, redaction and rule-flag tests
```

## data

`src/data/register.json` is a copy of the fccpc's public digital lenders register (approved, conditional, watchlist, delisted and cbn-licensed waiver lists), taken 16 nov 2026 from fccpc.gov.ng. results say "not on the fccpc list as of [date]", never "illegal". always check the live list.

the lenders and people in `fixtures/` are made up. names were checked against the register so none match a real lender.

## built during the hackathon

everything in this repo was written during the submission period, starting 16 nov 2026.

## not legal advice

loanshield gives information. the cost yardstick (over 50% a year = high, over 100% = severe) is ours, not a legal limit.

## license

apache-2.0
