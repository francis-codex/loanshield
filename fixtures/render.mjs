import { chromium } from "/Users/franciscodex/x-mcp/node_modules/playwright-core/index.mjs";
const b = await chromium.launch({ channel: "chrome" });
const p = await b.newPage({ viewport: { width: 390, height: 780 }, deviceScaleFactor: 2 });
for (const id of ["offer", "sms"]) { await p.goto(`file://${process.cwd()}/screens.html?${id}`); await p.screenshot({ path: `${id === "offer" ? "offer-quidrush" : "message-kobolift"}.png` }); }
await b.close();
