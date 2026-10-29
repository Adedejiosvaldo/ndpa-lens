/**
 * Checks what someone typed in the search bar before we start a scan, and
 * explains problems in plain words. Runs in the browser, so it has no network
 * access; the server still re-checks where the address really points.
 */

export type WebsiteCheck =
  | { ok: true; url: string }
  | { ok: false; message: string };

const MAX_LENGTH = 2048;

export function checkWebsiteInput(raw: string): WebsiteCheck {
  const value = raw.trim();

  if (!value) {
    return { ok: false, message: "Enter a website, like yourcompany.com." };
  }
  if (value.length > MAX_LENGTH) {
    return { ok: false, message: "That address is too long. Enter just the website." };
  }
  if (/\s/.test(value)) {
    return { ok: false, message: "Website addresses can't contain spaces." };
  }

  // "https//site.com" or "https:/site.com": a slip in the protocol part
  if (/^https?(\/\/|:\/(?!\/))/i.test(value)) {
    return {
      ok: false,
      message: "Check the start: it should be https:// (or leave it out).",
    };
  }

  const scheme = value.match(/^([a-z][a-z0-9+.-]*):/i)?.[1]?.toLowerCase();
  const hasSlashes = /^[a-z][a-z0-9+.-]*:\/\//i.test(value);

  if (scheme === "mailto" || (!hasSlashes && /^[^/]+@[^/]+\.[^/]+$/.test(value))) {
    return {
      ok: false,
      message: "That's an email address. Enter the website instead.",
    };
  }
  if (scheme && hasSlashes && scheme !== "http" && scheme !== "https") {
    // htp://, htps://, https// and similar slips
    if (/^h?t?t?p?s?$/.test(scheme) && scheme.length >= 3) {
      return {
        ok: false,
        message: "Check the start: it should be https:// (or leave it out).",
      };
    }
    return { ok: false, message: "Only websites (http or https) can be scanned." };
  }
  if (scheme && !hasSlashes && ["javascript", "data", "file", "ftp", "about", "blob"].includes(scheme)) {
    return { ok: false, message: "Only websites (http or https) can be scanned." };
  }

  const withProtocol = hasSlashes ? value : `https://${value}`;
  let url: URL;
  try {
    url = new URL(withProtocol);
  } catch {
    return { ok: false, message: "That doesn't look like a website. Try yourcompany.com." };
  }

  if (url.username || url.password) {
    return { ok: false, message: "Remove the username or password from the address." };
  }
  const host = url.hostname.replace(/\.$/, "").toLowerCase();
  if (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    /^\[.*\]$/.test(host) ||
    /^\d{1,3}(\.\d{1,3}){3}$/.test(host) ||
    /^0x[0-9a-f]+$/i.test(host) ||
    /^\d+$/.test(host)
  ) {
    return {
      ok: false,
      message: "Enter a public website, not an IP address or localhost.",
    };
  }

  if (url.port && url.port !== "80" && url.port !== "443") {
    return { ok: false, message: "Remove the port number (the :1234 part)." };
  }

  const labels = host.split(".");
  if (labels.length < 2) {
    return {
      ok: false,
      message: "Add an ending like .com or .ng.",
    };
  }
  const tld = labels[labels.length - 1];
  if (!/^([a-z]{2,63}|xn--[a-z0-9-]{1,59})$/.test(tld)) {
    return {
      ok: false,
      message: "That ending doesn't look right. Use one like .com, .ng or .org.",
    };
  }
  if (host.length > 253 || labels.some((l) => l.length > 63)) {
    return { ok: false, message: "That website name is too long." };
  }
  if (labels.some((l) => !l || !/^[a-z0-9-]+$/.test(l) || l.startsWith("-") || l.endsWith("-"))) {
    return { ok: false, message: "That name has characters websites can't use." };
  }

  url.hash = "";
  return { ok: true, url: url.toString() };
}
