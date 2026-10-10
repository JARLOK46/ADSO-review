import { createHash } from "node:crypto";
import { request as httpsRequest } from "node:https";
import { isIP } from "node:net";
import {
  type PublicUrlDnsResolver,
  type PublicUrlHasher,
  type PublicUrlRetrievalConfig,
  type PublicUrlRetrievalResult,
  type PublicUrlRetriever,
  type PublicUrlTransport,
} from "../application/public-url-retrieval.js";

export type SecurePublicUrlRetrieverDependencies = {
  config: PublicUrlRetrievalConfig;
  transport: PublicUrlTransport;
  resolve: PublicUrlDnsResolver;
  clock: () => Date;
  hash: PublicUrlHasher;
};

const ipv4ToNumber = (address: string): number | undefined => {
  const parts = address.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return undefined;
  return (((parts[0] ?? 0) * 256 + (parts[1] ?? 0)) * 256 + (parts[2] ?? 0)) * 256 + (parts[3] ?? 0);
};

const isUnsafeIpv4 = (address: string): boolean => {
  const value = ipv4ToNumber(address);
  if (value === undefined) return true;
  const first = value >>> 24;
  const second = (value >>> 16) & 255;
  const third = (value >>> 8) & 255;
  return first === 0 || first === 10 || first === 127 || first >= 224 ||
    (first === 100 && second >= 64 && second <= 127) ||
    (first === 169 && second === 254) || (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168) || (first === 192 && second === 0 && (third === 0 || third === 2)) ||
    (first === 198 && (second === 18 || second === 19)) ||
    (first === 198 && second === 51 && third === 100) ||
    (first === 203 && second === 0 && third === 113);
};

const parseIpv6 = (address: string): bigint | undefined => {
  const withoutZone = address.split("%")[0];
  if (!withoutZone) return undefined;
  const halves = withoutZone.split("::");
  if (halves.length > 2) return undefined;
  const parsePart = (part: string): number[] | undefined => {
    if (!part) return [];
    const pieces = part.split(":");
    const result: number[] = [];
    for (const piece of pieces) {
      if (piece.includes(".")) {
        const value = ipv4ToNumber(piece);
        if (value === undefined) return undefined;
        result.push(value >>> 16, value & 0xffff);
      } else if (/^[0-9a-f]{1,4}$/i.test(piece)) result.push(Number.parseInt(piece, 16));
      else return undefined;
    }
    return result;
  };
  const left = parsePart(halves[0] ?? "");
  const right = parsePart(halves[1] ?? "");
  if (!left || !right || (halves.length === 1 && left.length !== 8) || (halves.length === 2 && left.length + right.length >= 8)) return undefined;
  const groups = halves.length === 2 ? [...left, ...Array(8 - left.length - right.length).fill(0), ...right] : left;
  return groups.reduce((result, group) => (result << 16n) | BigInt(group), 0n);
};

const inIpv6Range = (value: bigint, prefix: bigint, bits: number): boolean => {
  const mask = ((1n << BigInt(bits)) - 1n) << BigInt(128 - bits);
  return (value & mask) === prefix;
};

export const isUnsafeAddress = (address: string): boolean => {
  const normalized = address.toLowerCase().replace(/^\[|\]$/g, "");
  if (isIP(normalized) === 4) return isUnsafeIpv4(normalized);
  if (isIP(normalized.split("%")[0] ?? "") !== 6) return true;
  const value = parseIpv6(normalized);
  if (value === undefined) return true;
  const mapped = value >> 32n;
  if (mapped === 0xffffn) return isUnsafeIpv4(`${Number((value >> 24n) & 255n)}.${Number((value >> 16n) & 255n)}.${Number((value >> 8n) & 255n)}.${Number(value & 255n)}`);
  return value === 0n || value === 1n ||
    inIpv6Range(value, 0xfc000000000000000000000000000000n, 7) ||
    inIpv6Range(value, 0xfe800000000000000000000000000000n, 10) ||
    inIpv6Range(value, 0xff000000000000000000000000000000n, 8) ||
    inIpv6Range(value, 0x20010db8n << 96n, 32) ||
    inIpv6Range(value, 0x20010000n << 96n, 32) ||
    inIpv6Range(value, 0x20010010n << 96n, 28);
};

export const sha256Hasher: PublicUrlHasher = async (body) => createHash("sha256").update(body).digest("hex");

const nodeHeadersToRecord = (headers: import("node:http").IncomingHttpHeaders): Record<string, string | undefined> => {
  const result: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(headers)) {
    result[key.toLowerCase()] = Array.isArray(value) ? value.join(", ") : value;
  }
  return result;
};

const timeoutError = () => Object.assign(new Error("request timed out"), { code: "timeout" });

/**
 * Make an HTTPS request to an already-approved address. `lookup` is supplied
 * deliberately so Node cannot resolve the original hostname a second time;
 * `servername` keeps certificate validation and SNI bound to the URL host.
 */
export const fetchPublicUrl: PublicUrlTransport = async (url, { timeoutMs, addresses }) => {
  const parsed = new URL(url);
  const address = addresses[0];
  if (!address) throw new Error("no validated address");
  const family = isIP(address);
  if (family === 0) throw new Error("invalid validated address");
  let timedOut = false;
  let request: ReturnType<typeof httpsRequest> | undefined;
  let response: import("node:http").IncomingMessage;
  const timeout = setTimeout(() => {
    timedOut = true;
    request?.destroy(timeoutError());
  }, timeoutMs);
  try {
    response = await new Promise<import("node:http").IncomingMessage>((resolve, reject) => {
      request = httpsRequest({
        protocol: "https:",
        hostname: address,
        port: parsed.port || 443,
        path: `${parsed.pathname}${parsed.search}`,
        method: "GET",
        servername: parsed.hostname,
        headers: { host: parsed.hostname },
        lookup: (_hostname, _options, callback) => callback(null, address, family),
      }, resolve);
      request.once("error", reject);
      request.end();
    });
    const body = (async function* (): AsyncIterable<Uint8Array> {
      let completed = false;
      try {
        for await (const chunk of response) yield new Uint8Array(chunk as Uint8Array);
        completed = true;
      } catch (error) {
        if (timedOut) throw timeoutError();
        throw error;
      } finally {
        if (!completed) response.destroy();
        clearTimeout(timeout);
      }
    })();
    return { status: response.statusCode ?? 0, headers: nodeHeadersToRecord(response.headers), body };
  } catch (error) {
    clearTimeout(timeout);
    if (timedOut) throw timeoutError();
    throw error;
  }
};

const closeResponseBody = async (body: AsyncIterable<Uint8Array> | undefined): Promise<void> => {
  if (!body) return;
  try {
    const iterator = body[Symbol.asyncIterator]();
    await iterator.return?.();
  } catch {
    // Redirect cleanup must not obscure the retrieval decision.
  }
};

const hostAllowed = (hostname: string, allowedHosts: readonly string[]) => allowedHosts.some((allowed) => {
  const candidate = allowed.toLowerCase().replace(/\.$/, "");
  return hostname === candidate || hostname.endsWith(`.${candidate}`);
});

function validateUrl(raw: string, config: PublicUrlRetrievalConfig): URL | PublicUrlRetrievalResult {
  let parsed: URL;
  try { parsed = new URL(raw); } catch { return { ok: false, status: "needs_review", reason: "invalid_url" }; }
  if (parsed.protocol !== "https:") return { ok: false, status: "needs_review", reason: "https_required" };
  if (parsed.username || parsed.password) return { ok: false, status: "needs_review", reason: "credentials_not_allowed" };
  if (parsed.port && parsed.port !== "443") return { ok: false, status: "needs_review", reason: "invalid_url" };
  if (!hostAllowed(parsed.hostname.toLowerCase(), config.allowedHosts)) return { ok: false, status: "needs_review", reason: "host_not_allowed" };
  return parsed;
}

export function createSecurePublicUrlRetriever(dependencies: SecurePublicUrlRetrieverDependencies): PublicUrlRetriever {
  const { config, transport, resolve, clock, hash } = dependencies;
  return async (request): Promise<PublicUrlRetrievalResult> => {
    const initial = validateUrl(request.url, config);
    if (!(initial instanceof URL)) return initial;
    let current = initial;
    const redirectChain = [initial.toString()];
    let response;
    for (let redirects = 0; ; redirects += 1) {
      const addresses = await resolve(current.hostname).catch(() => [] as readonly string[]);
      if (addresses.length === 0 || addresses.some(isUnsafeAddress)) return { ok: false, status: "needs_review", reason: "unsafe_address" };
      try { response = await transport(current.toString(), { timeoutMs: config.timeoutMs, addresses }); }
      catch (error) { return { ok: false, status: "needs_review", reason: (error as { code?: string }).code === "timeout" ? "timeout" : "unreadable" }; }
      const location = response.headers.location;
      if (response.status >= 300 && response.status < 400) {
        await closeResponseBody(response.body);
        if (location) {
          if (redirects >= config.maxRedirects) return { ok: false, status: "needs_review", reason: "redirect_limit" };
          let redirected: string;
          try { redirected = new URL(location, current).toString(); }
          catch { return { ok: false, status: "needs_review", reason: "invalid_url" }; }
          const next = validateUrl(redirected, config);
          if (!(next instanceof URL)) return next;
          current = next;
          redirectChain.push(current.toString());
          continue;
        }
      }
      break;
    }
    if (response.status < 200 || response.status >= 300) return { ok: false, status: "needs_review", reason: "bad_status" };
    const contentType = response.headers["content-type"]?.split(";", 1)[0]?.trim().toLowerCase();
    if (!contentType || !config.contentTypes.map((type) => type.toLowerCase()).includes(contentType)) return { ok: false, status: "needs_review", reason: "content_type_not_allowed" };
    if (!response.body) return { ok: false, status: "needs_review", reason: "unreadable" };
    const chunks: Uint8Array[] = [];
    let size = 0;
    try { for await (const chunk of response.body) { size += chunk.byteLength; if (size > config.maxBytes) return { ok: false, status: "needs_review", reason: "max_bytes_exceeded" }; chunks.push(chunk); } }
    catch (error) { return { ok: false, status: "needs_review", reason: (error as { code?: string }).code === "timeout" ? "timeout" : "unreadable" }; }
    const content = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { content.set(chunk, offset); offset += chunk.byteLength; }
    let sha256: string;
    try { sha256 = await hash(content); } catch { return { ok: false, status: "needs_review", reason: "unreadable" }; }
    return { ok: true, value: { sourceId: request.sourceId, workspaceId: request.workspaceId, projectId: request.projectId, actorId: request.actorId, content, byteSize: size, sha256, requestedUrl: request.url, finalUrl: current.toString(), redirectChain, limitations: [], fetchedAt: clock().toISOString(), status: response.status, contentType } };
  };
}
