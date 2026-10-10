import { describe, expect, it } from "vitest";
import {
  type AgentRequest,
  type AgentResult,
  type AiGateway,
  validateAgentRequest,
} from "../src/application/ai-gateway.js";
import {
  createFakeAiGateway,
  deterministicAgentResult,
} from "../src/infrastructure/fake-ai-gateway.js";

const request: AgentRequest = {
  schemaVersion: "1.0",
  runId: "run-1",
  agent: "document-reviewer",
  task: "Extract requirements from the source.",
  evidence: [
    {
      sourceId: "source-1",
      locator: "page 1, section 2",
      excerpt: "The project has three user roles.",
    },
  ],
};

describe("provider-neutral AI gateway contract", () => {
  it("represents versioned agent requests and structured results", () => {
    const result: AgentResult = deterministicAgentResult(request);

    expect(result).toEqual({
      schemaVersion: "1.0",
      runId: "run-1",
      agent: "document-reviewer",
      status: "completed",
      observations: [
        {
          id: "observation-1",
          kind: "fact",
          claim: "The project has three user roles.",
          confidence: "high",
          citations: [
            { sourceId: "source-1", locator: "page 1, section 2" },
          ],
          limitations: [],
        },
      ],
      limitations: [],
      openQuestions: [],
      usage: {
        model: "fake-deterministic-v1",
        inputTokens: 0,
        outputTokens: 0,
      },
    });
  });

  it("returns the same fixture without external calls", async () => {
    const gateway: AiGateway = createFakeAiGateway();

    const first = await gateway.run(request);
    const second = await gateway.run(request);

    expect(first).toEqual(second);
    expect(first.runId).toBe(request.runId);
    expect(first.agent).toBe(request.agent);
  });

  it("validates a well-formed request without normalizing it", () => {
    expect(validateAgentRequest(request)).toEqual({ ok: true, value: request });
  });

  it.each([
    ["schemaVersion", { schemaVersion: "2.0" }],
    ["runId", { runId: "   " }],
    ["task", { task: "" }],
    ["agent", { agent: "unknown-agent" }],
    ["evidence", { evidence: [null] }],
    ["citation locator", {
      evidence: [{ sourceId: "source-1", locator: " ", excerpt: "text" }],
    }],
    ["citation sourceId", {
      evidence: [{ sourceId: "\t", locator: "page 1", excerpt: "text" }],
    }],
    ["evidence excerpt", {
      evidence: [{ sourceId: "source-1", locator: "page 1", excerpt: "" }],
    }],
  ])("rejects malformed %s with an explicit validation error", (field, override) => {
    const result = validateAgentRequest({ ...request, ...override });

    expect(result).toEqual({
      ok: false,
      error: {
        code: "invalid_agent_request",
        path: field === "citation locator" || field === "citation sourceId"
          ? `evidence[0].${field === "citation locator" ? "locator" : "sourceId"}`
          : field === "evidence" ? "evidence[0]"
          : field === "evidence excerpt" ? "evidence[0].excerpt"
          : field,
        message: expect.any(String),
      },
    });
  });

  it("rejects malformed requests before deterministic processing", () => {
    expect(() => deterministicAgentResult({
      ...request,
      agent: "not-an-agent",
    } as unknown as AgentRequest)).toThrowError(/invalid_agent_request/);
  });

  it("preserves limitations and open questions in a result", () => {
    const result = deterministicAgentResult({
      ...request,
      evidence: [],
      task: "Review unavailable evidence.",
    });

    expect(result.status).toBe("needs_review");
    expect(result.observations).toEqual([]);
    expect(result.limitations).toEqual([
      "No authorized evidence was available for this request.",
    ]);
    expect(result.openQuestions).toEqual([
      "No authorized evidence was available for this request.",
    ]);
    expect(result.usage).toEqual({
      model: "fake-deterministic-v1",
      inputTokens: 0,
      outputTokens: 0,
    });
  });
});
