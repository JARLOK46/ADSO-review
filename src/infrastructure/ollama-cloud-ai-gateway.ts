import {
  assertValidAgentRequest,
  type AgentName,
  type AgentResult,
  type AiGateway,
} from "../application/ai-gateway.js";

export type OllamaHttpTransport = (
  url: string,
  init?: RequestInit,
) => Promise<Response>;

export type OllamaCloudAiGatewayConfig = {
  apiKey: string;
  baseUrl?: string;
  model: string;
  timeoutMs?: number;
  transport?: OllamaHttpTransport;
};

class OllamaGatewayError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = new.target.name;
    this.code = code;
  }
}

export class MissingOllamaApiKeyError extends OllamaGatewayError {
  constructor() {
    super("missing_ollama_api_key", "Ollama Cloud API key is required.");
  }
}

export class MissingOllamaModelError extends OllamaGatewayError {
  constructor() {
    super("missing_ollama_model", "Ollama Cloud model is required.");
  }
}

export class OllamaTimeoutError extends OllamaGatewayError {
  constructor() {
    super("ollama_timeout", "Ollama Cloud request timed out.");
  }
}

export class OllamaNetworkError extends OllamaGatewayError {
  constructor() {
    super("ollama_network_error", "Ollama Cloud request failed at the network layer.");
  }
}

export class OllamaHttpError extends OllamaGatewayError {
  readonly status: number;

  constructor(status: number) {
    super("ollama_http_error", `Ollama Cloud returned HTTP status ${status}.`);
    this.status = status;
  }
}

export class MalformedOllamaResponseError extends OllamaGatewayError {
  constructor() {
    super("malformed_ollama_response", "Ollama Cloud returned malformed JSON.");
  }
}

export class InvalidOllamaStructuredContentError extends OllamaGatewayError {
  constructor() {
    super("invalid_ollama_structured_content", "Ollama Cloud returned an invalid structured result.");
  }
}

const DEFAULT_BASE_URL = "https://ollama.com/api";
const DEFAULT_TIMEOUT_MS = 30_000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isAgentName(value: unknown): value is AgentName {
  return ["document-reviewer", "code-reviewer", "media-reviewer", "rubric-judge", "feedback-writer"].includes(value as AgentName);
}

function isStructuredResult(value: unknown): value is AgentResult {
  if (!isRecord(value) || value.schemaVersion !== "1.0" || !isNonEmptyString(value.runId) || !isAgentName(value.agent) ||
      !["completed", "needs_review", "failed"].includes(value.status as string) || !Array.isArray(value.observations) ||
      !Array.isArray(value.limitations) || !value.limitations.every(isNonEmptyString) ||
      !Array.isArray(value.openQuestions) || !value.openQuestions.every(isNonEmptyString) || !isRecord(value.usage)) {
    return false;
  }
  const usage = value.usage;
  if (!isNonEmptyString(usage.model) || typeof usage.inputTokens !== "number" || !Number.isFinite(usage.inputTokens) ||
      typeof usage.outputTokens !== "number" || !Number.isFinite(usage.outputTokens)) return false;
  if (value.provenance !== undefined && (!isRecord(value.provenance) || !isNonEmptyString(value.provenance.provider) || !isNonEmptyString(value.provenance.model))) return false;
  return value.observations.every((observation) => {
    if (!isRecord(observation) || !isNonEmptyString(observation.id) ||
        !["fact", "inference", "open_question"].includes(observation.kind as string) ||
        !isNonEmptyString(observation.claim) || !["low", "medium", "high"].includes(observation.confidence as string) ||
        !Array.isArray(observation.citations) || !Array.isArray(observation.limitations) ||
        !observation.limitations.every(isNonEmptyString)) return false;
    return observation.citations.every((citation) => isRecord(citation) && isNonEmptyString(citation.sourceId) && isNonEmptyString(citation.locator));
  });
}

export function createOllamaCloudAiGateway(config: OllamaCloudAiGatewayConfig): AiGateway {
  const baseUrl = (config.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, "");
  const model = config.model;
  const timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const transport = config.transport ?? ((url, init) => globalThis.fetch(url, init));

  return {
    async run(input) {
      const request = assertValidAgentRequest(input);
      if (!isNonEmptyString(config.apiKey)) throw new MissingOllamaApiKeyError();
      if (!isNonEmptyString(model)) throw new MissingOllamaModelError();

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      let result: Response;
      try {
        result = await transport(`${baseUrl}/chat`, {
          method: "POST",
          headers: { Authorization: `Bearer ${config.apiKey}`, "content-type": "application/json" },
          body: JSON.stringify({
            model,
            messages: [{
              role: "user",
              content: JSON.stringify({ task: request.task, evidence: request.evidence }),
            }],
            stream: false,
          }),
          signal: controller.signal,
        });
      } catch (error) {
        if (controller.signal.aborted || (error instanceof DOMException && error.name === "AbortError")) throw new OllamaTimeoutError();
        throw new OllamaNetworkError();
      } finally {
        clearTimeout(timer);
      }

      if (!result.ok) throw new OllamaHttpError(result.status);
      let payload: unknown;
      try {
        payload = JSON.parse(await result.text());
      } catch {
        throw new MalformedOllamaResponseError();
      }
      if (!isRecord(payload) || !isRecord(payload.message) || typeof payload.message.content !== "string") throw new InvalidOllamaStructuredContentError();
      let content: unknown;
      try {
        content = JSON.parse(payload.message.content);
      } catch {
        throw new InvalidOllamaStructuredContentError();
      }
      if (!isStructuredResult(content) || content.runId !== request.runId || content.agent !== request.agent) throw new InvalidOllamaStructuredContentError();
      return content;
    },
  };
}
