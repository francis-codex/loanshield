// fixture lender names must not match any real lender on the fccpc register
import { lookup } from "../src/register.ts";
for (const n of process.argv.slice(2)) console.log(n, "->", JSON.stringify(lookup(n).map(h => [h.apps || h.company, h.score])));
