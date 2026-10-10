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

export type AgentResult = {
  schemaVersion: "1.0";
  runId: string;
  agent: AgentName;
  status: "completed" | "needs_review" | "failed";
  observations: AgentObservation[];
  limitations: string[];
  openQuestions: string[];
  usage: AgentUsage;
};

export interface AiGateway {
  run(request: AgentRequest): Promise<AgentResult>;
}
