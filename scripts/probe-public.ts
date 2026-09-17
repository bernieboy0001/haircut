import { lookup } from "node:dns";
import { BitgetRestClient, loadConfig } from "@bitget-ai/bitget-agent-sdk";
import { installDnsFallback } from "../src/dns-fix.js";

installDnsFallback();

const config = loadConfig({
  modules: "market,cryptoloans,account",
  paperTrading: true,
  surface: "intent",
});
const client = new BitgetRestClient(config);

const CAT_SPOT = "SPOT";
const CAT_FUT = "USDT-FUTURES";

function row0(r: { data?: unknown }): unknown {
  return Array.isArray(r.data) ? r.data[0] : r.data;
}

async function safe<T>(label: string, fn: () => Promise<T>): Promise<void> {
  try {
    console.log(`${label}:`, JSON.stringify(await fn(), null, 0).slice(0, 400));
  } catch (e) {
    console.log(`${label}: ERROR ${e instanceof Error ? e.message : String(e)}`);
  }
}

async function ticker(category: string, symbol: string): Promise<string> {
  try {
    const r = await client.callOperation<Record<string, unknown> | Array<Record<string, unknown>>>(
      "getTickers",
      { category, symbol }
    );
    const rows = Array.isArray(r.data) ? r.data : [r.data];
    const t = rows[0];
    if (!t) return `${category} ${symbol}: NOT_LISTED`;
    return `${category} ${symbol}: ${JSON.stringify(t)}`;
  } catch (e) {
    return `${category} ${symbol}: ERROR ${e instanceof Error ? e.message : String(e)}`;
  }
}

async function probed(): Promise<void> {
  console.log("=== market probe (public, no keys) ===");
  for (const [cat, sym] of [
    [CAT_SPOT, "rNVDAUSDT"], // mandatory rToken sleeve — confirm listing
    [CAT_FUT, "BTCUSDT"],    // mandatory perp sleeve — confirm listing
  ] as const) {
    console.log(await ticker(cat, sym));
  }

  console.log("\n=== loan module probe (getLoanCoins) ===");
  for (const coin of ["BTC", "USDT"]) {
    await safe(`${coin} getLoanCoins`, async () => {
      const r = await client.callOperation("getLoanCoins", { coin });
      const data = Array.isArray(r.data) ? r.data : [r.data];
      return (data as Array<Record<string, unknown>>)
        .filter((d) => d && String(d.coin ?? "") === coin)
        .map((d) => ({ coin: d.coin, borrowable: d.borrowable, pledgeable: d.pledgeable }));
    });
  }

  console.log("\n=== loan module probe (getBorrowOngoing) ===");
  await safe("getBorrowOngoing", async () => {
    const r = await client.callOperation("getBorrowOngoing", {});
    return r.data;
  });

  console.log("\n=== account probe (getAccountAssets) ===");
  await safe("getAccountAssets", async () => {
    const r = await client.callOperation<Array<Record<string, unknown>>>("getAccountAssets", {});
    const rows = Array.isArray(r.data) ? r.data : [r.data];
    return (rows as Array<Record<string, unknown>>)
      .filter((d) => d && String(d.coin ?? "") === "USDT")
      .map((d) => ({ coin: d.coin, spot: d.spot, equity: d.equity, available: d.available, mode: d.mode }));
  });

  console.log("\n=== DNS check ===");
  try {
    const ip = await new Promise<string>((resolve, reject) => {
      lookup("api.bitget.com", (err: Error | null, address: string) =>
        err ? reject(err) : resolve(address)
      );
    });
    console.log(`api.bitget.com -> ${ip}`);
  } catch (e) {
    console.log(`DNS ERROR ${e instanceof Error ? e.message : String(e)}`);
  }
}

probed().then(
  () => process.exit(0),
  (e) => {
    console.error(e);
    process.exit(1);
  }
);