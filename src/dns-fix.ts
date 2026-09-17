import dns from "node:dns";

// DNS fallback for SDK connectivity.
//
// Some ISPs/proxies fail to resolve `api.bitget.com` even though the host is
// reachable (the CNAME chain is blocked). We are NOT hand-rolling a Bitget
// client here — we only pin the hostname to Bitget's published Cloudflare IPs
// when the system resolver genuinely cannot answer. Normal resolution is
// attempted first and is always preferred; the pinned IPs are only used as a
// last resort and the TLS handshake still presents the real api.bitget.com SNI,
// so the official SDK stays the only thing talking to Bitget.

const PINNED_API_BITGET = {
  host: "api.bitget.com",
  ips: ["104.18.14.166", "104.18.15.166"],
};

const originalLookup = dns.lookup.bind(dns);

function resolveWithFallback(
  hostname: string,
  opts: { all?: boolean; family?: number } = {}
): Promise<dns.LookupAddress[] | string> {
  return new Promise((resolve, reject) => {
    originalLookup(hostname, opts, (err, address, family) => {
      const blocked =
        err &&
        (err.code === "ENOTFOUND" ||
          err.code === "EAI_AGAIN" ||
          err.code === "ESERVFAIL" ||
          err.code === "ETIMEOUT");
      if (blocked && hostname === PINNED_API_BITGET.host) {
        if (opts.all) {
          resolve(
            PINNED_API_BITGET.ips.map((address) => ({ address, family: 4 }))
          );
        } else {
          resolve(PINNED_API_BITGET.ips[0]);
        }
        return;
      }
      if (err) {
        reject(err);
        return;
      }
      if (opts.all) {
        resolve(address as dns.LookupAddress[]);
      } else {
        resolve(address as string);
      }
    });
  });
}

export function installDnsFallback(): void {
  (dns.lookup as unknown as { patch: unknown }).patch; // no-op: keep type refs honest
  (dns as unknown as { lookup: (...a: any[]) => unknown }).lookup = (
    hostname: string,
    optionsOrCb: unknown,
    maybeCb?: unknown
  ) => {
    const type = typeof optionsOrCb;
    if (type === "function") {
      const cb = optionsOrCb as (
        err: NodeJS.ErrnoException | null,
        address?: string | dns.LookupAddress[],
        family?: number
      ) => void;
      resolveWithFallback(hostname)
        .then((address) =>
          cb(null, address as string, typeof address === "string" ? 4 : 4)
        )
        .catch((err) => cb(err as NodeJS.ErrnoException));
      return {} as unknown;
    }

    const opts = (optionsOrCb ?? {}) as { all?: boolean; family?: number };
    const cb = maybeCb as (
      err: NodeJS.ErrnoException | null,
      address?: string | dns.LookupAddress[],
      family?: number
    ) => void;
    resolveWithFallback(hostname, opts)
      .then((address) => {
        if (opts.all) {
          cb(null, address as dns.LookupAddress[], 4);
        } else {
          cb(null, address as string, 4);
        }
      })
      .catch((err) => cb(err as NodeJS.ErrnoException));
    return {} as unknown;
  };

  (dns as unknown as { promises: { lookup: Function } }).promises.lookup =
    (hostname: string, options?: unknown) =>
      resolveWithFallback(hostname, (options ?? {}) as { all?: boolean });
}

export function dnsFallbackDescription(): string {
  return `dns-fix: api.bitget.com pinned to Cloudflare ${PINNED_API_BITGET.ips.join(", ")} when system DNS fails`;
}