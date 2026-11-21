import http from "node:http";
import https from "node:https";
import tls from "node:tls";
import selfsigned from "selfsigned";
import { headersFor, render, TRACKER_HOSTS, VARIANTS } from "./variants.mjs";

export { TRACKER_HOSTS, VARIANTS };
export const FIXTURE_DOMAIN = "fixtures.test";

const TRACKER_JS = {
  "/en_US/fbevents.js": "window.fbq = function () {};",
  "/gtag/js": "document.cookie = '_ga=GA1.1.987.654; path=/; max-age=63072000'; new Image().src = 'https://www.google-analytics.com/g/collect?v=2&tid=G-FIXTURE&en=page_view';",
  "/c/hotjar-1234.js": "window.hj = function () {}; new Image().src = 'https://static.hotjar.com/api/v2/client/sites/1234/visit-data';",
};
const GIF = Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", "base64");

/**
 * Serve every variant over HTTPS (SNI picks an expired certificate for
 * c19-fail) and plain HTTP (redirects to HTTPS). Hosts: <variant>.fixtures.test
 * plus the tracker hostnames. Returns the CA certificate so tests can trust it.
 */
export async function startFixtures({ host = "127.0.0.1" } = {}) {
  const ca = await selfsigned.generate([{ name: "commonName", value: "NDPA Lens Fixtures CA" }], {
    keySize: 2048,
    algorithm: "sha256",
    notAfterDate: new Date(Date.now() + 365 * 864e5),
    extensions: [{ name: "basicConstraints", cA: true }, { name: "keyUsage", keyCertSign: true, digitalSignature: true, cRLSign: true }],
  });
  const altNames = [`*.${FIXTURE_DOMAIN}`, ...TRACKER_HOSTS].map((value) => ({ type: 2, value }));
  const leaf = (notAfter, notBefore) =>
    selfsigned.generate([{ name: "commonName", value: `baseline.${FIXTURE_DOMAIN}` }], {
      keySize: 2048,
      algorithm: "sha256",
      notBeforeDate: notBefore,
      notAfterDate: notAfter,
      ca: { key: ca.private, cert: ca.cert },
      extensions: [
        { name: "basicConstraints", cA: false },
        { name: "keyUsage", digitalSignature: true, keyEncipherment: true },
        { name: "extKeyUsage", serverAuth: true },
        { name: "subjectAltName", altNames },
      ],
    });
  const valid = await leaf(new Date(Date.now() + 90 * 864e5), new Date(Date.now() - 864e5));
  const expired = await leaf(new Date(Date.now() - 2 * 864e5), new Date(Date.now() - 100 * 864e5));
  const ctx = (c) => tls.createSecureContext({ key: c.private, cert: `${c.cert}\n${ca.cert}`, minVersion: "TLSv1.2" });
  const [validCtx, expiredCtx] = [ctx(valid), ctx(expired)];

  const handler = (req, res) => {
    const hostname = (req.headers.host ?? "").split(":")[0].toLowerCase();
    const path = new URL(req.url, "https://x").pathname;
    if (TRACKER_HOSTS.includes(hostname)) {
      if (TRACKER_JS[path]) return res.writeHead(200, { "content-type": "text/javascript", "access-control-allow-origin": "*" }).end(TRACKER_JS[path]);
      return res.writeHead(200, { "content-type": "image/gif" }).end(GIF);
    }
    const variant = hostname.endsWith(`.${FIXTURE_DOMAIN}`) ? hostname.slice(0, -FIXTURE_DOMAIN.length - 1) : null;
    if (variant && path === "/robots.txt") return res.writeHead(200, { "content-type": "text/plain" }).end("User-agent: *\nAllow: /\n");
    if (variant && req.method === "POST") return res.writeHead(405).end("Fixture forms are never submitted.");
    const html = variant ? render(variant, path, req.headers.host) : null;
    if (!html) return res.writeHead(404, { "content-type": "text/plain" }).end("Not found");
    res.writeHead(200, headersFor(variant)).end(html);
  };

  const httpsServer = https.createServer(
    { SNICallback: (servername, cb) => cb(null, servername.startsWith("c19-fail.") ? expiredCtx : validCtx), ...{ key: valid.private, cert: valid.cert } },
    handler,
  );
  await new Promise((r) => httpsServer.listen(0, host, r));
  const httpsPort = httpsServer.address().port;
  const httpServer = http.createServer((req, res) => {
    const hostname = (req.headers.host ?? "").split(":")[0];
    res.writeHead(301, { location: `https://${hostname}:${httpsPort}${req.url}` }).end();
  });
  await new Promise((r) => httpServer.listen(0, host, r));

  return {
    httpsPort,
    httpPort: httpServer.address().port,
    caCert: ca.cert,
    url: (variant, path = "/") => `https://${variant}.${FIXTURE_DOMAIN}:${httpsPort}${path}`,
    /** Chromium flag mapping every fixture and tracker host to this server. */
    hostResolverRules: `MAP *.${FIXTURE_DOMAIN} ${host}, ${TRACKER_HOSTS.map((h) => `MAP ${h} ${host}`).join(", ")}`,
    close: async () => {
      await Promise.all([new Promise((r) => httpsServer.close(r)), new Promise((r) => httpServer.close(r))]);
    },
  };
}
