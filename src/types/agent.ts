export interface AgentLog {
  id: number;
  businessId: number | null;
  agentName: string;
  modelUsed: string | null;
  inputSummary: string | null;
  outputSummary: string | null;
  tokensIn: number | null;
  tokensOut: number | null;
  costCents: string | null;
  durationMs: number | null;
  status: string;
  errorMessage: string | null;
  createdAt: Date;
  businessName?: string;
}

export const AGENT_NAMES = [
  "scrape",
  "research-1",
  "research-2",
  "design-1",
  "copywrite-1",
  "design-2",
  "copywrite-2",
  "manager",
  "secretary",
] as const;

export type AgentName = (typeof AGENT_NAMES)[number];
