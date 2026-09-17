import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Autopsy } from "./types.js";

// Canonical hash of an autopsy record. Night-one (no previous hash) is
// allowed; every subsequent overnight Haircut write must reference the chain.
// Hash is stored as plain text in state/last_hash.txt.

const LAST_HASH_FILE = join(process.cwd(), "state", "last_hash.txt");

export function canonicalAutopsyJson(autopsy: Omit<Autopsy, "hash">): string {
  const canonical: Record<string, unknown> = {};
  for (const k of Object.keys(autopsy).sort()) {
    if (k === "hash") continue; // hash is never part of the signed payload
    const v = (autopsy as Record<string, unknown>)[k];
    if (v === undefined) continue;
    canonical[k] =
      v && typeof v === "object" && !Array.isArray(v)
        ? sortObject(v as Record<string, unknown>)
        : v;
  }
  return JSON.stringify(canonical, null, 0);
}

function sortObject(o: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(o).sort()) out[k] = o[k];
  return out;
}

export function hashAutopsy(autopsy: Omit<Autopsy, "hash">): string {
  return createHash("sha256").update(canonicalAutopsyJson(autopsy)).digest("hex");
}

export function saveLastHash(hash: string): void {
  mkdirSync(join(process.cwd(), "state"), { recursive: true });
  writeFileSync(LAST_HASH_FILE, hash);
}

export function loadLastHash(): string | null {
  try {
    return readFileSync(LAST_HASH_FILE, "utf-8").trim();
  } catch {
    return null;
  }
}

// Date-aware overnight lock. "Night one" — the first close, before any autopsy
// exists — is exempt. After that, overnight new risk (ARM) and every FIRE must
// reference an autopsy hash that is at least as new as the most recent close.
// Inputs are plain values so the rule is unit-testable without touching disk.
export interface OvernightLockInputs {
  lastHash: string | null;
  closeCount: number;
  lastCloseDate: string | null;
  autopsyDates: string[];
  newestAutopsyHash: string | null;
}

export function evaluateOvernightLock(
  i: OvernightLockInputs
): { ok: boolean; reason: string } {
  if (i.closeCount === 0) return { ok: true, reason: "first night: no prior close" };
  const newest =
    i.autopsyDates.length > 0 ? [...i.autopsyDates].sort().at(-1)! : null;
  if (newest === null) {
    if (i.closeCount <= 1) {
      return { ok: true, reason: "first night: no prior autopsy required" };
    }
    return { ok: false, reason: "missing_autopsy_hash: no autopsy for a prior close" };
  }
  if (!i.lastHash) return { ok: false, reason: "missing_autopsy_hash: hash file absent" };
  if (i.lastCloseDate && i.lastCloseDate > newest) {
    return {
      ok: false,
      reason: `missing_autopsy_hash: no autopsy since close ${i.lastCloseDate}`,
    };
  }
  if (i.newestAutopsyHash !== i.lastHash) {
    return { ok: false, reason: "missing_autopsy_hash: chain hash mismatch" };
  }
  return { ok: true, reason: `chain locked to ${i.lastHash.slice(0, 12)}` };
}
