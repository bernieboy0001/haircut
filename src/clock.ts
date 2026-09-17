import type { Session } from "./types.js";

// America/New_York session clock. All modes in ET.

function etNow(): Date {
  return new Date(
    new Date().toLocaleString("en-US", { timeZone: "America/New_York" })
  );
}

function parseET(hm: string): number {
  const [h, m] = hm.split(":").map(Number);
  return h * 60 + m;
}

export function isWeekend(dt: Date): boolean {
  const dow = dt.getDay(); // 0 Sun, 6 Sat
  return dow === 0 || dow === 6;
}

export function isFridayAfterClose(dt: Date, cashCloseEt: string): boolean {
  if (dt.getDay() !== 5) return false;
  const mins = dt.getHours() * 60 + dt.getMinutes();
  return mins >= parseET(cashCloseEt);
}

export function isBeforeMondayOpen(dt: Date, openEt: string): boolean {
  if (dt.getDay() !== 1) return false;
  const mins = dt.getHours() * 60 + dt.getMinutes();
  return mins < parseET(openEt);
}

export function currentSession(
  openWindowEt: string[],
  cashCloseEt: string,
  at?: Date
): Session {
  const dt = at ?? etNow();
  const mins = dt.getHours() * 60 + dt.getMinutes();
  const [openStart, openEnd] = openWindowEt.map(parseET);

  if (isWeekend(dt) || isFridayAfterClose(dt, cashCloseEt) || isBeforeMondayOpen(dt, openWindowEt[0])) {
    return "WEEKEND";
  }
  if (mins >= openStart && mins < openEnd) return "OPEN_WINDOW";
  if (mins >= openEnd && mins < parseET(cashCloseEt)) return "RTH";
  return "OVERNIGHT";
}

export interface SessionInfo {
  session: Session;
  at: Date;
  et: string;
}

export function sessionInfo(
  openWindowEt: string[],
  cashCloseEt: string,
  at?: Date
): SessionInfo {
  const dt = at ?? etNow();
  const session = currentSession(openWindowEt, cashCloseEt, dt);
  const et = dt.toLocaleString("en-US", {
    timeZone: "America/New_York",
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  return { session, at: new Date(dt.toISOString()), et };
}

export function isOvernightOrWeekend(session: Session): boolean {
  return session === "OVERNIGHT" || session === "WEEKEND";
}

// Calendar date (YYYY-MM-DD) in America/New_York.
export function etDate(at?: Date): string {
  const dt = at ?? new Date();
  const local = new Date(dt.toLocaleString("en-US", { timeZone: "America/New_York" }));
  const y = local.getFullYear();
  const m = String(local.getMonth() + 1).padStart(2, "0");
  const d = String(local.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// The next trading (weekday) date strictly after `fromEtDate`. Pure calendar
// arithmetic on the ET date string, so it is timezone-independent. This is the
// single source of truth for the date an overnight ticket is armed for.
export function nextSessionDate(fromEtDate: string): string {
  const [y, m, d] = fromEtDate.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  do {
    dt.setUTCDate(dt.getUTCDate() + 1);
  } while (dt.getUTCDay() === 0 || dt.getUTCDay() === 6);
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(dt.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

export function etTimestamp(at?: Date): string {
  const dt = at ?? new Date();
  const local = new Date(dt.toLocaleString("en-US", { timeZone: "America/New_York" }));
  const y = local.getFullYear();
  const m = String(local.getMonth() + 1).padStart(2, "0");
  const d = String(local.getDate()).padStart(2, "0");
  const hh = String(local.getHours()).padStart(2, "0");
  const mm = String(local.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${d}T${hh}:${mm}`;
}