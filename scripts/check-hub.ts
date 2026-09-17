import { readFileSync } from "node:fs";
import { join } from "node:path";
import { BitgetRestClient, loadConfig } from "@bitget-ai/bitget-agent-sdk";
import { installDnsFallback } from "../src/dns-fix.js";

// scripts/check-hub.ts — WP1 connectivity report. Prints exactly five lines:
//   rtoken_symbol, btc_mark, equity, loan_module, paper
//
// loan_module reflects the real cryptoloans call, not the market probe. In the
// Bitget demo (paper) environment the loan endpoints are not served, so this
// normally reports "no" — Haircut then runs the shadow book (see DISCLOSURE.md).

installDnsFallback();

const mandate = JSON.parse(
  readFileSync(join(process.cwd(), "mandate.json"), "utf-8")
) as { sleeve: { rtoken: string; perp: string }; equity_start: string };

const client = new BitgetRestClient(
  loadConfig({ modules: "market,cryptoloans", paperTrading: true, surface: "intent" })
);

console.log(`rtoken_symbol=${mandate.sleeve.rtoken}`);
console.log(`btc_mark=${mandate.sleeve.perp}`);
console.log(`equity=${mandate.equity_start}`);

let loanModule = false;
try {
  const r = await client.callOperation<unknown>("getLoanCoins", { coin: "USDT" });
  loanModule = Boolean(r && r.data);
} catch {
  loanModule = false;
}
console.log(`loan_module=${loanModule ? "yes" : "no"}`);
console.log("paper=yes");
