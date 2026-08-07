import { isIP } from "node:net";
import { lookup } from "node:dns/promises";

const BLOCKED_HOSTS = new Set([
  "localhost",
  "localhost.localdomain",
  "metadata.google.internal",
  "169.254.169.254",
]);

function isPrivateIpv4(address: string): boolean {
  const octets = address.split(".").map(Number);
  if (octets.length !== 4 || octets.some(Number.isNaN)) return true;
  const [a, b] = octets;
  return (
    a === 10 ||
    a === 127 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    a === 0 ||
    a >= 224
  );
}

function isPrivateIpv6(address: string): boolean {
  const normalized = address.toLowerCase();
  return (
    normalized === "::1" ||
    normalized === "::" ||
    normalized.startsWith("fc") ||
    normalized.startsWith("fd") ||
    normalized.startsWith("fe8") ||
    normalized.startsWith("fe9") ||
    normalized.startsWith("fea") ||
    normalized.startsWith("feb")
  );
}

export function normalizeUrl(rawUrl: string): string {
  const parsed = new URL(rawUrl);
  parsed.hash = "";
  for (const key of [...parsed.searchParams.keys()]) {
    if (/^(utm_|ref$|source$|campaign$|fbclid$|gclid$|mc_cid$|mc_eid$)/i.test(key)) {
      parsed.searchParams.delete(key);
    }
  }
  parsed.hostname = parsed.hostname.toLowerCase();
  if ((parsed.protocol === "https:" && parsed.port === "443") || (parsed.protocol === "http:" && parsed.port === "80")) {
    parsed.port = "";
  }
  return parsed.toString();
}

export async function assertSafePublicUrl(rawUrl: string): Promise<URL> {
  const parsed = new URL(rawUrl);
  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error(`Unsupported URL protocol: ${parsed.protocol}`);
  }
  if (parsed.username || parsed.password) throw new Error("Credential-bearing URLs are not allowed");
  const hostname = parsed.hostname.toLowerCase();
  if (BLOCKED_HOSTS.has(hostname) || hostname.endsWith(".local")) {
    throw new Error("Private or local hosts are not allowed");
  }

  if (isIP(hostname)) {
    const privateAddress = hostname.includes(":") ? isPrivateIpv6(hostname) : isPrivateIpv4(hostname);
    if (privateAddress) throw new Error("Private network addresses are not allowed");
    return parsed;
  }

  const addresses = await lookup(hostname, { all: true, verbatim: true });
  if (addresses.length === 0) throw new Error("Host did not resolve");
  for (const address of addresses) {
    const privateAddress = address.family === 6 ? isPrivateIpv6(address.address) : isPrivateIpv4(address.address);
    if (privateAddress) throw new Error("Host resolves to a private network address");
  }
  return parsed;
}

export async function safeFetch(
  rawUrl: string,
  init: RequestInit = {},
  timeoutMs = 12_000,
  maxRedirects = 3,
): Promise<Response> {
  let current = normalizeUrl(rawUrl);
  for (let redirectCount = 0; redirectCount <= maxRedirects; redirectCount += 1) {
    const parsed = await assertSafePublicUrl(current);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(parsed, {
        ...init,
        redirect: "manual",
        signal: controller.signal,
        headers: {
          "User-Agent": "SignalFoundryAutonomousCreator/2.0 (research bot; contact configured by deployer)",
          Accept: "application/json, application/atom+xml, application/rss+xml, application/xml, text/xml, text/html;q=0.8, text/plain;q=0.7",
          ...init.headers,
        },
      });
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const location = response.headers.get("location");
        if (!location) throw new Error("Redirect response did not include a location");
        current = normalizeUrl(new URL(location, parsed).toString());
        continue;
      }
      if (!response.ok) throw new Error(`Fetch failed with ${response.status} for ${parsed.hostname}`);
      return response;
    } finally {
      clearTimeout(timeout);
    }
  }
  throw new Error(`Too many redirects while fetching ${new URL(rawUrl).hostname}`);
}

export async function readBoundedText(response: Response, maxBytes: number): Promise<string> {
  const declaredLength = Number(response.headers.get("content-length") ?? 0);
  if (declaredLength > maxBytes) throw new Error(`Response exceeds ${maxBytes} bytes`);
  if (!response.body) {
    const value = await response.text();
    if (new TextEncoder().encode(value).byteLength > maxBytes) throw new Error(`Response exceeds ${maxBytes} bytes`);
    return value;
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const chunks: string[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel("response size limit exceeded");
        throw new Error(`Response exceeds ${maxBytes} bytes`);
      }
      chunks.push(decoder.decode(value, { stream: true }));
    }
    chunks.push(decoder.decode());
    return chunks.join("");
  } finally {
    reader.releaseLock();
  }
}
