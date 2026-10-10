export type AgentName =
  | "document-reviewer"
  | "code-reviewer"
  | "media-reviewer"
  | "rubric-judge"
  | "feedback-writer";

export type AgentRequestEvidence = {
  sourceId: string;
  locator: string;
  excerpt: string;
};

export type AgentRequest = {
  schemaVersion: "1.0";
  runId: string;
  agent: AgentName;
  task: string;
  evidence: AgentRequestEvidence[];
};

export type AgentRequestValidationError = {
  code: "invalid_agent_request";
  path: string;
  message: string;
};

export type AgentRequestValidationResult =
  | { ok: true; value: AgentRequest }
  | { ok: false; error: AgentRequestValidationError };

const AGENT_NAMES: readonly AgentName[] = [
  "document-reviewer",
  "code-reviewer",
  "media-reviewer",
  "rubric-judge",
  "feedback-writer",
];

function invalid(path: string, message: string): AgentRequestValidationResult {
  return {
    ok: false,
    error: { code: "invalid_agent_request", path, message },
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export function validateAgentRequest(input: unknown): AgentRequestValidationResult {
  if (!isRecord(input)) {
    return invalid("request", "Request must be an object.");
  }
  if (input.schemaVersion !== "1.0") {
    return invalid("schemaVersion", "schemaVersion must be \"1.0\".");
  }
  if (!isNonEmptyString(input.runId)) {
    return invalid("runId", "runId must be a non-empty string.");
  }
  if (!AGENT_NAMES.includes(input.agent as AgentName)) {
    return invalid("agent", "agent is not a supported agent name.");
  }
  if (!isNonEmptyString(input.task)) {
    return invalid("task", "task must be a non-empty string.");
  }
  if (!Array.isArray(input.evidence)) {
    return invalid("evidence", "evidence must be an array.");
  }

  for (const [index, evidence] of input.evidence.entries()) {
    const path = `evidence[${index}]`;
    if (!isRecord(evidence)) {
      return invalid(path, "Evidence must be an object.");
    }
    if (!isNonEmptyString(evidence.sourceId)) {
      return invalid(`${path}.sourceId`, "sourceId must be a non-empty string.");
    }
    if (!isNonEmptyString(evidence.locator)) {
      return invalid(`${path}.locator`, "locator must be a non-empty string.");
    }
    if (!isNonEmptyString(evidence.excerpt)) {
      return invalid(`${path}.excerpt`, "excerpt must be a non-empty string.");
    }
  }

  return { ok: true, value: input as AgentRequest };
}

export class InvalidAgentRequestError extends Error {
  readonly code = "invalid_agent_request" as const;
  readonly path: string;

  constructor(error: AgentRequestValidationError) {
    super(`${error.code} at ${error.path}: ${error.message}`);
    this.name = "InvalidAgentRequestError";
    this.path = error.path;
  }
}

export function assertValidAgentRequest(input: unknown): AgentRequest {
  const result = validateAgentRequest(input);
  if (!result.ok) {
    throw new InvalidAgentRequestError(result.error);
  }
  return result.value;
}

export type ObservationKind = "fact" | "inference" | "open_question";
export type ObservationConfidence = "low" | "medium" | "high";

export type Citation = {
  sourceId: string;
  locator: string;
};

export type AgentObservation = {
  id: string;
  kind: ObservationKind;
  claim: string;
  confidence: ObservationConfidence;
  citations: Citation[];
  limitations: string[];
};

export type AgentUsage = {
  model: string;
  inputTokens: number;
  outputTokens: number;
};

export type AgentProvenance = {
  provider: string;
  model: string;
};

export type AgentResult = {
  schemaVersion: "1.0";
  runId: string;
  agent: AgentName;
  status: "completed" | "needs_review" | "failed";
  observations: AgentObservation[];
  limitations: string[];
  openQuestions: string[];
  usage: AgentUsage;
  provenance?: AgentProvenance;
};

export interface AiGateway {
  run(request: unknown): Promise<AgentResult>;
}
