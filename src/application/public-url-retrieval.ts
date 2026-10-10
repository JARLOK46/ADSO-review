export type PublicUrlRetrievalRequest = {
  sourceId: string;
  workspaceId: string;
  projectId: string;
  actorId: string;
  url: string;
};

export type PublicUrlRetrievalConfig = {
  allowedHosts: readonly string[];
  maxRedirects: number;
  maxBytes: number;
  timeoutMs: number;
  contentTypes: readonly string[];
};

export type PublicUrlResponse = {
  status: number;
  headers: Record<string, string | undefined>;
  /** Missing bodies are treated as unreadable by the retrieval boundary. */
  body?: AsyncIterable<Uint8Array>;
};

export type PublicUrlTransport = (
  url: string,
  options: { timeoutMs: number; addresses: readonly string[] },
) => Promise<PublicUrlResponse>;
export type PublicUrlDnsResolver = (hostname: string) => Promise<readonly string[]>;
export type PublicUrlHasher = (body: Uint8Array) => Promise<string>;

export type PublicUrlRetriever = (request: PublicUrlRetrievalRequest) => Promise<PublicUrlRetrievalResult>;

export type PublicUrlRetrievalSuccess = {
  sourceId: string;
  workspaceId: string;
  projectId: string;
  actorId: string;
  content: Uint8Array;
  byteSize: number;
  sha256: string;
  requestedUrl: string;
  finalUrl: string;
  /** Canonical requested URL followed by each destination that passed validation. */
  redirectChain: readonly string[];
  /** Explicit limitations that affect interpretation of the retrieved source. */
  limitations: readonly string[];
  fetchedAt: string;
  status: number;
  contentType: string;
};

export type PublicUrlNeedsReviewReason =
  | "invalid_url" | "https_required" | "credentials_not_allowed" | "host_not_allowed"
  | "unsafe_address" | "redirect_limit" | "bad_status" | "content_type_not_allowed"
  | "max_bytes_exceeded" | "timeout" | "unreadable";

export type PublicUrlRetrievalResult =
  | { ok: true; value: PublicUrlRetrievalSuccess }
  | { ok: false; status: "needs_review"; reason: PublicUrlNeedsReviewReason };

export async function retrievePublicUrl(
  request: PublicUrlRetrievalRequest,
  retriever: PublicUrlRetriever,
): Promise<PublicUrlRetrievalResult> {
  return retriever(request);
}
