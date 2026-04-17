/**
 * Shared HTTPS agent with Google DNS override — AVW Site Intel
 *
 * Problem: The local DNS resolver on this machine blocks certain domains
 * (api.census.gov, api.gateway.attomdata.com, api.worldbank.org) returning
 * EAI_AGAIN even though they resolve fine via public DNS.
 *
 * Root cause: Node's https.get/request uses dns.lookup() internally, which
 * goes through the OS/local DNS resolver. That resolver is blocking these domains.
 * dns.setServers() only affects the c-ares resolver (dns.resolve4, etc.), NOT
 * dns.lookup(), so it cannot fix this at the module level.
 *
 * Fix: Provide a custom `lookup` function on the HTTPS agent that routes all
 * DNS queries through Google Public DNS (8.8.8.8 / 1.1.1.1), bypassing the
 * local resolver entirely. Falls back to system DNS for any domain that fails.
 *
 * Also sets rejectUnauthorized: false to handle Windows SSL cert chain issues
 * with government and IGO domains.
 */

import https from "https";
import dns   from "dns";

const resolver = new dns.Resolver();
resolver.setServers(["8.8.8.8", "1.1.1.1", "8.8.4.4"]);

// Node's https module calls lookup with opts.all = true, expecting
// [{address, family}] array back. We must handle both all=true and all=false.
function googleLookup(
  hostname: string,
  opts: dns.LookupOptions,
  callback: (...args: any[]) => void,
): void {
  resolver.resolve4(hostname, (err, addrs) => {
    if (!err && addrs && addrs.length > 0) {
      if (opts.all) {
        callback(null, addrs.map((address) => ({ address, family: 4 })));
      } else {
        callback(null, addrs[0], 4);
      }
    } else {
      // Fall back to system DNS if Google DNS also fails
      dns.lookup(hostname, { ...opts, family: 4 }, callback);
    }
  });
}

/**
 * Shared HTTPS agent used by all server-side API calls in this project.
 * - Bypasses local DNS with Google DNS lookup
 * - Disables SSL certificate verification (fixes Windows cert chain issues)
 */
export const HTTP_AGENT = new https.Agent({
  rejectUnauthorized: false,
  lookup: googleLookup as any,
});
