import { EventEmitter } from "node:events";
import { describe, expect, it, vi } from "vitest";

const { httpsRequestMock } = vi.hoisted(() => ({ httpsRequestMock: vi.fn() }));
vi.mock("node:https", () => ({ request: httpsRequestMock }));
import {
  retrievePublicUrl,
  type PublicUrlRetrievalConfig,
  type PublicUrlTransport,
} from "../src/application/public-url-retrieval.js";
import { createSecurePublicUrlRetriever, fetchPublicUrl, sha256Hasher } from "../src/infrastructure/secure-public-url-retriever.js";

const config: PublicUrlRetrievalConfig = {
  allowedHosts: ["example.com"],
  maxRedirects: 2,
  maxBytes: 32,
  timeoutMs: 1000,
  contentTypes: ["text/html", "text/plain"],
};
const deps = {
  resolve: async (host: string) => host === "example.com" ? ["93.184.216.34"] : ["93.184.216.34"],
  clock: () => new Date("2026-01-01T00:00:00.000Z"),
  hash: async (bytes: Uint8Array) => Array.from(bytes).map((value) => value.toString(16).padStart(2, "0")).join(""),
};
const response = (body: string, overrides: Partial<Awaited<ReturnType<PublicUrlTransport>>> = {}) => ({
  status: 200, headers: { "content-type": "text/html" }, body: (async function* () { yield new TextEncoder().encode(body); })(), ...overrides,
});
const retrieve = (transport: PublicUrlTransport, overrides: Partial<PublicUrlRetrievalConfig> = {}) =>
  retrievePublicUrl({ sourceId: "source-1", workspaceId: "workspace-1", projectId: "project-1", actorId: "actor-1", url: "https://example.com/page" },
    createSecurePublicUrlRetriever({ config: { ...config, ...overrides }, ...deps, transport }));

const successfulTransport: PublicUrlTransport = async () => response("hello");

describe("secure public URL retrieval", () => {
  it("provides a production SHA-256 hasher", async () => {
    await expect(sha256Hasher(new TextEncoder().encode("hello"))).resolves.toBe("2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824");
  });
  it("passes the validated DNS addresses to the transport", async () => {
    const addresses: readonly string[] = [];
    const transport: PublicUrlTransport = async (_url, options) => {
      (addresses as string[]).push(...options.addresses);
      return response("hello");
    };
    await expect(retrieve(transport)).resolves.toMatchObject({ ok: true });
    expect(addresses).toEqual(["93.184.216.34"]);
  });

  it("retrieves an allowed public URL and records hash and provenance", async () => {
    const result = await retrieve(successfulTransport);
    expect(result).toEqual({ ok: true, value: {
      sourceId: "source-1", workspaceId: "workspace-1", projectId: "project-1", actorId: "actor-1",
      content: new TextEncoder().encode("hello"), byteSize: 5, sha256: "68656c6c6f",
      requestedUrl: "https://example.com/page", finalUrl: "https://example.com/page",
      redirectChain: ["https://example.com/page"], limitations: [], fetchedAt: "2026-01-01T00:00:00.000Z",
      status: 200, contentType: "text/html",
    }});
  });

  it.each([
    ["host", "https://evil.example.net/page", "host_not_allowed"],
    ["credentials", "https://user:password@example.com/page", "credentials_not_allowed"],
    ["scheme", "http://example.com/page", "https_required"],
  ])("rejects %s", async (_name, url, error) => {
    const checked = await retrievePublicUrl({ sourceId: "s", workspaceId: "w", projectId: "p", actorId: "a", url }, createSecurePublicUrlRetriever({ config, ...deps, transport: successfulTransport }));
    expect(checked).toEqual({ ok: false, status: "needs_review", reason: error });
  });

  it("rejects private DNS targets", async () => {
    const checked = await retrievePublicUrl({ sourceId: "s", workspaceId: "w", projectId: "p", actorId: "a", url: "https://internal.example" }, createSecurePublicUrlRetriever({ config: { ...config, allowedHosts: ["internal.example"] }, ...deps, resolve: async () => ["127.0.0.1"], transport: successfulTransport }));
    expect(checked).toEqual({ ok: false, status: "needs_review", reason: "unsafe_address" });
  });

  it.each(["192.0.2.1", "198.51.100.1", "203.0.113.1"])("rejects documented IPv4 DNS target %s", async (address) => {
    const result = await retrievePublicUrl({ sourceId: "s", workspaceId: "w", projectId: "p", actorId: "a", url: "https://internal.example" }, createSecurePublicUrlRetriever({ config: { ...config, allowedHosts: ["internal.example"] }, ...deps, resolve: async () => [address], transport: successfulTransport }));
    expect(result).toEqual({ ok: false, status: "needs_review", reason: "unsafe_address" });
  });

  it.each([
    "::1", "fc00::1", "fd12:3456::1", "fe80::1", "ff02::1",
    "2001:db8::1", "2001:0::1", "::ffff:127.0.0.1", "::ffff:192.168.1.1",
  ])("rejects unsafe IPv6 DNS target %s", async (address) => {
    const result = await retrievePublicUrl({ sourceId: "s", workspaceId: "w", projectId: "p", actorId: "a", url: "https://internal.example" }, createSecurePublicUrlRetriever({ config: { ...config, allowedHosts: ["internal.example"] }, ...deps, resolve: async () => [address], transport: successfulTransport }));
    expect(result).toEqual({ ok: false, status: "needs_review", reason: "unsafe_address" });
  });

  it("treats a missing response body as unreadable", async () => {
    const result = await retrieve(async () => ({ status: 200, headers: { "content-type": "text/html" } }));
    expect(result).toEqual({ ok: false, status: "needs_review", reason: "unreadable" });
  });

  it("records every validated URL in the redirect-chain provenance", async () => {
    const transport: PublicUrlTransport = async (url) => url.includes("/page")
      ? response("", { status: 302, headers: { location: "https://example.com/redirected" } })
      : response("ok");
    const result = await retrieve(transport);
    expect(result).toMatchObject({ ok: true, value: {
      requestedUrl: "https://example.com/page",
      finalUrl: "https://example.com/redirected",
      redirectChain: ["https://example.com/page", "https://example.com/redirected"],
      limitations: [],
    }});
  });

  it("revalidates redirects", async () => {
    const transport: PublicUrlTransport = async (url) => url.includes("/page") ? response("", { status: 302, headers: { location: "https://evil.example.net" } }) : response("ok");
    const result = await retrieve(transport);
    expect(result).toEqual({ ok: false, status: "needs_review", reason: "host_not_allowed" });
  });

  it("returns needs_review for a malformed redirect location", async () => {
    const result = await retrieve(async () => response("", { status: 302, headers: { location: "https://[invalid" } }));
    expect(result).toEqual({ ok: false, status: "needs_review", reason: "invalid_url" });
  });

  it("closes a redirect response body before returning bad_status when Location is absent", async () => {
    let closed = false;
    const redirectBody: AsyncIterable<Uint8Array> = {
      [Symbol.asyncIterator]: () => ({
        async next() { return { done: false, value: new Uint8Array() }; },
        async return() { closed = true; return { done: true, value: undefined }; },
      }),
    };
    const result = await retrieve(async () => response("", { status: 302, headers: {}, body: redirectBody }));
    expect(result).toEqual({ ok: false, status: "needs_review", reason: "bad_status" });
    expect(closed).toBe(true);
  });

  it("closes a redirect response body before following the redirect", async () => {
    let closed = false;
    const redirectBody: AsyncIterable<Uint8Array> = {
      [Symbol.asyncIterator]: () => ({
        async next() { return { done: false, value: new Uint8Array() }; },
        async return() { closed = true; return { done: true, value: undefined }; },
      }),
    };
    let requests = 0;
    const transport: PublicUrlTransport = async (url) => {
      requests += 1;
      return url.includes("/page")
        ? response("", { status: 302, headers: { location: "https://example.com/final" }, body: redirectBody })
        : response("ok");
    };
    const result = await retrieve(transport);
    expect(result).toMatchObject({ ok: true, value: { finalUrl: "https://example.com/final" } });
    expect(requests).toBe(2);
    expect(closed).toBe(true);
  });

  it.each([
    ["timeout", Object.assign(new Error("timeout"), { code: "timeout" }), "timeout"],
    ["oversize", undefined, "max_bytes_exceeded"],
  ])("returns needs_review for %s", async (_name, error, reason) => {
    const transport: PublicUrlTransport = error ? async () => { throw error; } : async () => response("123456789", {});
    const result = await retrieve(transport, error ? {} : { maxBytes: 4 });
    expect(result).toEqual({ ok: false, status: "needs_review", reason });
  });

  it.each([
    [{ status: 404, headers: { "content-type": "text/html" } }, "bad_status"],
    [{ status: 200, headers: { "content-type": "application/pdf" } }, "content_type_not_allowed"],
  ])("rejects invalid response metadata", async (metadata, reason) => {
    const result = await retrieve(async () => response("body", metadata));
    expect(result).toEqual({ ok: false, status: "needs_review", reason });
  });

  it("destroys an unconsumed production HTTPS body during reader cleanup", async () => {
    const request = new EventEmitter() as EventEmitter & { end: () => void; destroy: (error?: Error) => void };
    const responseStream = new EventEmitter() as EventEmitter & {
      statusCode: number;
      headers: Record<string, string>;
      destroy: () => void;
      [Symbol.asyncIterator]: () => AsyncIterator<Uint8Array>;
    };
    let destroyed = false;
    responseStream.statusCode = 200;
    responseStream.headers = { "content-type": "text/html" };
    responseStream.destroy = () => { destroyed = true; };
    responseStream[Symbol.asyncIterator] = () => ({
      next: async () => ({ done: false, value: new TextEncoder().encode("body") }),
      return: async () => ({ done: true, value: undefined }),
    });
    request.end = () => undefined;
    request.destroy = () => undefined;
    httpsRequestMock.mockImplementationOnce((_options, callback) => {
      queueMicrotask(() => callback(responseStream));
      return request;
    });
    const result = await fetchPublicUrl("https://example.com/page", { timeoutMs: 1000, addresses: ["93.184.216.34"] });
    const iterator = result.body![Symbol.asyncIterator]();
    await iterator.next();
    await iterator.return?.();
    expect(destroyed).toBe(true);
    expect(httpsRequestMock).toHaveBeenCalledWith(expect.objectContaining({
      hostname: "93.184.216.34", servername: "example.com",
      lookup: expect.any(Function),
    }), expect.any(Function));
  });

  it("returns needs_review without content when DNS or transport cannot verify the source", async () => {
    const result = await retrieve(async () => { throw new Error("unreadable"); });
    expect(result).toEqual({ ok: false, status: "needs_review", reason: "unreadable" });
    expect(result).not.toHaveProperty("content");
  });
});
