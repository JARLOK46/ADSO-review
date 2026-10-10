import { describe, expect, it } from "vitest";
import {
  type AgentRequest,
  type AgentResult,
  type AiGateway,
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

  it("preserves limitations and open questions in a result", () => {
    const result = deterministicAgentResult({
      ...request,
      evidence: [],
      task: "Review unavailable evidence.",
    });

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
