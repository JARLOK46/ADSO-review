import {
  assertValidAgentRequest,
  type AgentResult,
  type AiGateway,
} from "../application/ai-gateway.js";

const NO_EVIDENCE = "No authorized evidence was available for this request.";

export function deterministicAgentResult(input: unknown): AgentResult {
  const request = assertValidAgentRequest(input);
  const hasEvidence = request.evidence.length > 0;

  return {
    schemaVersion: request.schemaVersion,
    runId: request.runId,
    agent: request.agent,
    status: hasEvidence ? "completed" : "needs_review",
    observations: request.evidence.map((evidence, index) => ({
      id: `observation-${index + 1}`,
      kind: "fact" as const,
      claim: evidence.excerpt,
      confidence: "high" as const,
      citations: [
        { sourceId: evidence.sourceId, locator: evidence.locator },
      ],
      limitations: [],
    })),
    limitations: hasEvidence ? [] : [NO_EVIDENCE],
    openQuestions: hasEvidence ? [] : [NO_EVIDENCE],
    usage: {
      model: "fake-deterministic-v1",
      inputTokens: 0,
      outputTokens: 0,
    },
  };
}

export function createFakeAiGateway(): AiGateway {
  return {
    async run(request) {
      return deterministicAgentResult(request);
    },
  };
}
