import { getAnthropicClient, MODELS, type ModelKey } from "./client";

export interface RunAgentParams {
  agentName: string;
  businessId: number;
  systemPrompt: string;
  userMessage: string;
  model: ModelKey;
  maxTokens: number;
}

export interface AgentResult {
  content: string;
  tokensIn: number;
  tokensOut: number;
  costCents: number;
  durationMs: number;
  error?: string;
}

// Cost per million tokens in dollars: [input, output]
const COST_PER_MILLION: Record<ModelKey, [number, number]> = {
  haiku: [1, 5],
  sonnet: [3, 15],
  opus: [5, 25],
};

function calculateCostCents(
  model: ModelKey,
  tokensIn: number,
  tokensOut: number
): number {
  const [inputCost, outputCost] = COST_PER_MILLION[model];
  const inputDollars = (tokensIn / 1_000_000) * inputCost;
  const outputDollars = (tokensOut / 1_000_000) * outputCost;
  return (inputDollars + outputDollars) * 100;
}

export async function runAgent(params: RunAgentParams): Promise<AgentResult> {
  const {
    agentName,
    businessId,
    systemPrompt,
    userMessage,
    model,
    maxTokens,
  } = params;

  const startTime = Date.now();

  try {
    const client = getAnthropicClient();
    const response = await client.messages.create({
      model: MODELS[model],
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage }],
    });

    const durationMs = Date.now() - startTime;
    const tokensIn = response.usage.input_tokens;
    const tokensOut = response.usage.output_tokens;
    const costCents = calculateCostCents(model, tokensIn, tokensOut);

    const content =
      response.content
        .filter((block) => block.type === "text")
        .map((block) => block.text)
        .join("\n") || "";

    return {
      content,
      tokensIn,
      tokensOut,
      costCents,
      durationMs,
    };
  } catch (error) {
    const durationMs = Date.now() - startTime;
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";

    console.error(
      `[${agentName}] Error processing business ${businessId}:`,
      errorMessage
    );

    return {
      content: "",
      tokensIn: 0,
      tokensOut: 0,
      costCents: 0,
      durationMs,
      error: errorMessage,
    };
  }
}
