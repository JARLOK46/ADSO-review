import { describe, expect, it } from "vitest";
import { type AgentRequest } from "../application/ai-gateway.js";
import {
  createOllamaCloudAiGateway,
  InvalidOllamaStructuredContentError,
  MalformedOllamaResponseError,
  MissingOllamaApiKeyError,
  MissingOllamaModelError,
  OllamaHttpError,
  OllamaNetworkError,
  OllamaTimeoutError,
} from "./ollama-cloud-ai-gateway.js";

const request: AgentRequest = {
  schemaVersion: "1.0",
  runId: "run-cloud-1",
  agent: "document-reviewer",
  task: "Review the authorized source.",
  evidence: [{ sourceId: "source-1", locator: "page 1", excerpt: "A fact." }],
};

const structuredResult = {
  schemaVersion: "1.0",
  runId: request.runId,
  agent: request.agent,
  status: "completed",
  observations: [],
  limitations: [],
  openQuestions: [],
  provenance: { provider: "ollama-cloud", model: "configured-model" },
  usage: { model: "configured-model", inputTokens: 12, outputTokens: 7 },
};

function response(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function transportReturning(result: Response | Error) {
  return async (_url: string, _init?: RequestInit): Promise<Response> => {
    if (result instanceof Error) throw result;
    return result;
  };
}

describe("Ollama Cloud AI gateway contract", () => {
  it("sends bearer auth to the configurable chat endpoint with the documented body", async () => {
    let seenUrl = "";
    let seenInit: RequestInit | undefined;
    const gateway = createOllamaCloudAiGateway({
      apiKey: "test-secret",
      baseUrl: "https://ollama.example.test/api/",
      model: "configured-model",
      transport: async (url, init) => {
        seenUrl = url;
        seenInit = init;
        return response({ message: { content: JSON.stringify(structuredResult) } });
      },
    });

    await gateway.run(request);

    expect(seenUrl).toBe("https://ollama.example.test/api/chat");
    expect(seenInit?.headers).toEqual({
      Authorization: "Bearer test-secret",
      "content-type": "application/json",
    });
    expect(JSON.parse(String(seenInit?.body))).toEqual({
      model: "configured-model",
      messages: [{
        role: "user",
        content: JSON.stringify({ task: request.task, evidence: request.evidence }),
      }],
      stream: false,
    });
  });

  it("maps and preserves the validated structured result and usage", async () => {
    const gateway = createOllamaCloudAiGateway({
      apiKey: "test-secret",
      model: "configured-model",
      transport: transportReturning(response({
        message: { content: JSON.stringify(structuredResult) },
      })),
    });

    await expect(gateway.run(request)).resolves.toEqual(structuredResult);
  });

  it("rejects invalid application requests before making an HTTP call", async () => {
    let calls = 0;
    const gateway = createOllamaCloudAiGateway({
      apiKey: "test-secret",
      model: "configured-model",
      transport: async () => {
        calls += 1;
        return response({});
      },
    });

    await expect(gateway.run({ ...request, agent: "unknown" })).rejects.toMatchObject({
      code: "invalid_agent_request",
    });
    expect(calls).toBe(0);
  });

  it("reports a missing API key without exposing credentials", async () => {
    const gateway = createOllamaCloudAiGateway({ apiKey: "", model: "configured-model" });
    await expect(gateway.run(request)).rejects.toBeInstanceOf(MissingOllamaApiKeyError);
  });

  it("reports an empty model instead of selecting a provider default", async () => {
    const gateway = createOllamaCloudAiGateway({ apiKey: "test-secret", model: "" });
    await expect(gateway.run(request)).rejects.toBeInstanceOf(MissingOllamaModelError);
  });

  it.each([
    ["timeout", new DOMException("timed out", "AbortError"), OllamaTimeoutError],
    ["network", new Error("socket failed"), OllamaNetworkError],
  ] as const)("translates %s failures", async (_name, failure, errorType) => {
    const gateway = createOllamaCloudAiGateway({
      apiKey: "test-secret",
      model: "configured-model",
      transport: transportReturning(failure),
    });
    await expect(gateway.run(request)).rejects.toBeInstanceOf(errorType);
  });

  it("translates non-2xx responses and does not include the API key", async () => {
    const secret = "super-secret-key";
    const gateway = createOllamaCloudAiGateway({
      apiKey: secret,
      model: "configured-model",
      transport: transportReturning(response({ error: "unauthorized" }, 401)),
    });
    const error = await gateway.run(request).catch((value: unknown) => value);
    expect(error).toBeInstanceOf(OllamaHttpError);
    expect(String(error)).not.toContain(secret);
    expect((error as OllamaHttpError).status).toBe(401);
  });

  it("reports malformed provider JSON", async () => {
    const gateway = createOllamaCloudAiGateway({
      apiKey: "test-secret",
      model: "configured-model",
      transport: async () => new Response("not-json", { status: 200 }),
    });
    await expect(gateway.run(request)).rejects.toBeInstanceOf(MalformedOllamaResponseError);
  });

  it("reports invalid structured content", async () => {
    const gateway = createOllamaCloudAiGateway({
      apiKey: "test-secret",
      model: "configured-model",
      transport: transportReturning(response({ message: { content: "{bad" } })),
    });
    await expect(gateway.run(request)).rejects.toBeInstanceOf(InvalidOllamaStructuredContentError);
  });
});
