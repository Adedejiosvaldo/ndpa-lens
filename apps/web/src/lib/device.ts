/** "Chrome on Windows" from a user-agent string: people recognise devices, not UA strings. */
export function describeDevice(ua: string | null): string {
  if (!ua) return "Unknown device";
  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /OPR\//.test(ua)
      ? "Opera"
      : /Firefox\//.test(ua)
        ? "Firefox"
        : /Chrome\//.test(ua)
          ? "Chrome"
          : /Safari\//.test(ua)
            ? "Safari"
            : "Browser";
  const os = /Windows/.test(ua)
    ? "Windows"
    : /iPhone|iPad/.test(ua)
      ? "iOS"
      : /Android/.test(ua)
        ? "Android"
        : /Mac OS X/.test(ua)
          ? "macOS"
          : /Linux/.test(ua)
            ? "Linux"
            : "an unknown system";
  return `${browser} on ${os}`;
}

/** Shorten IPv6 (`0000:…:0001` → `::1`) and unwrap IPv4-mapped addresses. */
export function compactIp(ip: string | null): string {
  if (!ip) return "Unknown";
  const mapped = ip.match(/^(?:0{0,4}:){0,5}(?:0{0,4}:)?ffff:(\d+\.\d+\.\d+\.\d+)$/i);
  if (mapped) return mapped[1]!;
  if (!ip.includes(":")) return ip;
  const groups = ip.split(":").map((g) => g.replace(/^0+(?=.)/, "").toLowerCase());
  let best = { start: -1, len: 0 };
  for (let i = 0; i < groups.length; ) {
    if (groups[i] !== "0") {
      i++;
      continue;
    }
    let j = i;
    while (j < groups.length && groups[j] === "0") j++;
    if (j - i > best.len) best = { start: i, len: j - i };
    i = j;
  }
  if (best.len < 2) return groups.join(":");
  const head = groups.slice(0, best.start).join(":");
  const tail = groups.slice(best.start + best.len).join(":");
  return `${head}::${tail}`;
}
