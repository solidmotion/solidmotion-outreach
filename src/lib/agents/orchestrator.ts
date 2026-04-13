import { db } from "@/lib/db";
import { businesses, agentLogs, campaigns, settings } from "@/lib/db/schema";
import { eq, asc, inArray } from "drizzle-orm";
import { runAgent } from "./runner";
import type { AgentResult } from "./runner";
import type { ModelKey } from "./client";
import type { BusinessStatus } from "@/lib/db/schema";

import { SCRAPE_SYSTEM_PROMPT } from "./prompts/scrape";
import { RESEARCH_1_SYSTEM_PROMPT } from "./prompts/research-1";
import { RESEARCH_2_SYSTEM_PROMPT } from "./prompts/research-2";
import { DESIGN_1_SYSTEM_PROMPT } from "./prompts/design-1";
import { COPYWRITE_1_SYSTEM_PROMPT } from "./prompts/copywrite-1";
import { DESIGN_2_SYSTEM_PROMPT } from "./prompts/design-2";
import { COPYWRITE_2_SYSTEM_PROMPT } from "./prompts/copywrite-2";
import { MANAGER_SYSTEM_PROMPT } from "./prompts/manager";
import { SECRETARY_SYSTEM_PROMPT } from "./prompts/secretary";

import { deployToGitHubPages } from "@/lib/github/pages";
import { createDraft } from "@/lib/google/gmail";

// ---------------------------------------------------------------------------
// Updated: 2026-04-13 — email rejection rule + fast models
// Types
// ---------------------------------------------------------------------------

interface AgentStep {
  agentName: string;
  systemPrompt: string;
  model: ModelKey;
  maxTokens: number;
}

export interface StepResult {
  success: boolean;
  newStatus: string;
  agentName: string;
  error?: string;
}

// ---------------------------------------------------------------------------
// Agent pipeline definition
// ---------------------------------------------------------------------------

/**
 * Each status maps to one or more agent steps that run sequentially,
 * followed by the next business status.
 */
const PIPELINE: Record<
  string,
  { steps: AgentStep[]; nextStatus: BusinessStatus } | null
> = {
  discovered: {
    steps: [
      {
        agentName: "scrape",
        systemPrompt: SCRAPE_SYSTEM_PROMPT,
        model: "haiku",
        maxTokens: 2048,
      },
    ],
    nextStatus: "researching",
  },
  researching: {
    steps: [
      {
        agentName: "research-1",
        systemPrompt: RESEARCH_1_SYSTEM_PROMPT,
        model: "sonnet",
        maxTokens: 4096,
      },
    ],
    nextStatus: "designing",
  },
  designing: {
    steps: [
      {
        agentName: "research-2",
        systemPrompt: RESEARCH_2_SYSTEM_PROMPT,
        model: "sonnet",
        maxTokens: 2048,
      },
      {
        agentName: "design-1",
        systemPrompt: DESIGN_1_SYSTEM_PROMPT,
        model: "haiku",
        maxTokens: 8192,
      },
      {
        agentName: "copywrite-1",
        systemPrompt: COPYWRITE_1_SYSTEM_PROMPT,
        model: "haiku",
        maxTokens: 4096,
      },
    ],
    nextStatus: "copywriting",
  },
  copywriting: {
    steps: [
      {
        agentName: "design-2",
        systemPrompt: DESIGN_2_SYSTEM_PROMPT,
        model: "haiku",
        maxTokens: 4096,
      },
      {
        agentName: "copywrite-2",
        systemPrompt: COPYWRITE_2_SYSTEM_PROMPT,
        model: "haiku",
        maxTokens: 4096,
      },
    ],
    nextStatus: "reviewing",
  },
  reviewing: {
    steps: [
      {
        agentName: "manager",
        systemPrompt: MANAGER_SYSTEM_PROMPT,
        model: "sonnet",
        maxTokens: 2048,
      },
    ],
    // nextStatus is dynamic: "ready" on approve, "designing" on reject
    nextStatus: "ready",
  },
  ready: {
    steps: [
      {
        agentName: "secretary",
        systemPrompt: SECRETARY_SYSTEM_PROMPT,
        model: "haiku",
        maxTokens: 8192,
      },
    ],
    nextStatus: "sent",
  },
  // Terminal statuses
  sent: null,
  replied: null,
  converted: null,
  rejected: null,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type BusinessRow = typeof businesses.$inferSelect;
type AgentLogRow = typeof agentLogs.$inferSelect;

/** Fetch all previous agent logs for a business, ordered chronologically. */
async function getPreviousLogs(businessId: number): Promise<AgentLogRow[]> {
  return db
    .select()
    .from(agentLogs)
    .where(eq(agentLogs.businessId, businessId))
    .orderBy(asc(agentLogs.createdAt));
}

/** Find the most recent successful output for a given agent name. */
function findLogOutput(logs: AgentLogRow[], agentName: string): string | null {
  for (let i = logs.length - 1; i >= 0; i--) {
    const log = logs[i];
    if (log.agentName === agentName && log.status === "success") {
      // fullOutput is stored as JSON; outputSummary is a text fallback
      if (log.fullOutput) {
        return typeof log.fullOutput === "string"
          ? log.fullOutput
          : JSON.stringify(log.fullOutput);
      }
      return log.outputSummary ?? null;
    }
  }
  return null;
}

/** Build a user message for a specific agent based on business data + history. */
function buildUserMessage(
  agentName: string,
  business: BusinessRow,
  logs: AgentLogRow[]
): string {
  const base = [
    `Business Name: ${business.name}`,
    `Address: ${business.address ?? "Unknown"}`,
    `City: ${business.city ?? "Unknown"}`,
    `Phone: ${business.phone ?? "Unknown"}`,
    `Email: ${business.email ?? "Unknown"}`,
    `Website: ${business.websiteUrl ?? "None"}`,
    `Website Quality: ${business.websiteQuality ?? "unknown"}`,
    `Google Place ID: ${business.googlePlaceId ?? "N/A"}`,
  ].join("\n");

  const placesData = business.placesDataCached
    ? `\n\n## Google Places Data\n${JSON.stringify(business.placesDataCached, null, 2)}`
    : "";

  switch (agentName) {
    case "scrape": {
      return `Analyze the following business:\n\n${base}${placesData}`;
    }

    case "research-1": {
      const scrapeOutput = findLogOutput(logs, "scrape");
      return [
        `Research the following business:\n\n${base}${placesData}`,
        scrapeOutput
          ? `\n\n## Scrape Agent Analysis\n${scrapeOutput}`
          : "",
      ].join("");
    }

    case "research-2": {
      const researchOutput = findLogOutput(logs, "research-1");
      return [
        `Create a design brief for the following business:\n\n${base}`,
        researchOutput
          ? `\n\n## Business Research Profile\n${researchOutput}`
          : "",
      ].join("");
    }

    case "design-1": {
      const researchOutput = findLogOutput(logs, "research-1");
      const designBrief = findLogOutput(logs, "research-2");
      const copyOutput = findLogOutput(logs, "copywrite-1");
      return [
        `Build a demo website for the following business:\n\n${base}`,
        designBrief
          ? `\n\n## Design Brief\n${designBrief}`
          : "",
        researchOutput
          ? `\n\n## Business Research\n${researchOutput}`
          : "",
        copyOutput
          ? `\n\n## Website Copy\n${copyOutput}`
          : "",
      ].join("");
    }

    case "copywrite-1": {
      const researchOutput = findLogOutput(logs, "research-1");
      const designBrief = findLogOutput(logs, "research-2");
      return [
        `Write website copy for the following business:\n\n${base}`,
        researchOutput
          ? `\n\n## Business Research\n${researchOutput}`
          : "",
        designBrief
          ? `\n\n## Design Brief\n${designBrief}`
          : "",
      ].join("");
    }

    case "design-2": {
      const designBrief = findLogOutput(logs, "research-2");
      const websiteHtml = findLogOutput(logs, "design-1");
      return [
        `Create an email HTML template for the following business:\n\n${base}`,
        designBrief
          ? `\n\n## Design Brief\n${designBrief}`
          : "",
        websiteHtml
          ? `\n\n## Demo Website HTML (for style reference)\n${websiteHtml.slice(0, 3000)}...`
          : "",
      ].join("");
    }

    case "copywrite-2": {
      const researchOutput = findLogOutput(logs, "research-1");
      const websiteHtml = findLogOutput(logs, "design-1");
      return [
        `Write an outreach email for the following business:\n\n${base}`,
        researchOutput
          ? `\n\n## Business Research\n${researchOutput}`
          : "",
        websiteHtml
          ? `\n\n## Demo Website (built for them)\nA demo website has been built and is ready to deploy.`
          : "",
      ].join("");
    }

    case "manager": {
      // Manager sees everything
      const allOutputs = logs
        .filter((l) => l.status === "success" && l.fullOutput)
        .map((l) => {
          const output =
            typeof l.fullOutput === "string"
              ? l.fullOutput
              : JSON.stringify(l.fullOutput);
          return `### ${l.agentName}\n${output}`;
        })
        .join("\n\n---\n\n");

      const websiteHtml = findLogOutput(logs, "design-1") ?? "";
      const emailHtml = findLogOutput(logs, "design-2") ?? "";
      const emailCopy = findLogOutput(logs, "copywrite-2") ?? "";

      return [
        `Review the complete outreach package for:\n\n${base}`,
        `\n\n## All Agent Outputs\n${allOutputs}`,
        `\n\n## Demo Website HTML\n${websiteHtml.slice(0, 5000)}`,
        `\n\n## Email Template HTML\n${emailHtml.slice(0, 3000)}`,
        `\n\n## Email Copy\n${emailCopy}`,
      ].join("");
    }

    case "secretary": {
      const websiteHtml = findLogOutput(logs, "design-1") ?? "";
      const emailHtml = findLogOutput(logs, "design-2") ?? "";
      const emailCopy = findLogOutput(logs, "copywrite-2") ?? "";
      const managerReview = findLogOutput(logs, "manager") ?? "";

      return [
        `Prepare the deployment package for:\n\n${base}`,
        `\n\n## Manager Approval\n${managerReview}`,
        `\n\n## Demo Website HTML\n${websiteHtml}`,
        `\n\n## Email Template HTML\n${emailHtml}`,
        `\n\n## Email Copy\n${emailCopy}`,
        `\n\nThe demo website URL will be determined after GitHub Pages deployment. Use a placeholder like {{DEMO_URL}} if needed ÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ it will be replaced before sending.`,
      ].join("");
    }

    default:
      return `Process the following business:\n\n${base}`;
  }
}

/** Insert a log entry and return its id. */
async function insertLog(
  businessId: number,
  agentName: string,
  model: string,
  inputSummary: string
): Promise<number> {
  const [row] = await db
    .insert(agentLogs)
    .values({
      businessId,
      agentName,
      modelUsed: model,
      inputSummary,
      status: "running",
    })
    .returning({ id: agentLogs.id });
  return row.id;
}

/** Update a log entry with the agent result. */
async function updateLog(
  logId: number,
  result: AgentResult
): Promise<void> {
  await db
    .update(agentLogs)
    .set({
      status: result.error ? "error" : "success",
      fullOutput: result.content,
      outputSummary: result.content.slice(0, 500),
      tokensIn: result.tokensIn,
      tokensOut: result.tokensOut,
      costCents: result.costCents.toFixed(4),
      durationMs: result.durationMs,
      errorMessage: result.error ?? null,
    })
    .where(eq(agentLogs.id, logId));
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

/**
 * Process exactly ONE agent step for a business.
 *
 * Instead of running all agents in a pipeline phase at once (which can exceed
 * Vercel function timeouts), this runs a single agent, then returns.
 * The caller (frontend) should loop until the business reaches a terminal status.
 *
 * It checks previous logs to skip agents that already succeeded, and only
 * advances the business status once ALL agents in the current phase are done.
 */
export async function processNextStep(
  businessId: number
): Promise<StepResult> {
  // 1. Load business from DB
  const [business] = await db
    .select()
    .from(businesses)
    .where(eq(businesses.id, businessId))
    .limit(1);

  if (!business) {
    return {
      success: false,
      newStatus: "unknown",
      agentName: "none",
      error: `Business ${businessId} not found`,
    };
  }

  const currentStatus = business.status;
  const pipelineEntry = PIPELINE[currentStatus];

  if (!pipelineEntry) {
    return {
      success: false,
      newStatus: currentStatus,
      agentName: "none",
      error: `No next step for status "${currentStatus}"`,
    };
  }

  const { steps, nextStatus } = pipelineEntry;

  // 2. Load previous logs
  const logs = await getPreviousLogs(businessId);

  // Clean up stuck "running" logs from previous function timeouts
  const runningLogIds = logs.filter(l => l.status === "running").map(l => l.id);
  if (runningLogIds.length > 0) {
    await db
      .update(agentLogs)
      .set({
        status: "error",
        errorMessage: "Function timeout (cleaned up)",
        durationMs: 0,
      })
      .where(inArray(agentLogs.id, runningLogIds));
  }

  // 3. Determine which agents in this phase already succeeded
  const successfulAgents = new Set(
    logs
      .filter((l) => l.status === "success")
      .map((l) => l.agentName)
  );

  // Skip agents that have failed too many times (3+ retries)
  const MAX_RETRIES = 3;
  const errorCounts: Record<string, number> = {};
  for (const log of logs) {
    if (log.status === "error" || log.status === "running") {
      errorCounts[log.agentName] = (errorCounts[log.agentName] || 0) + 1;
    }
  }

  const skippedAgents = new Set<string>();
  for (const step of steps) {
    if (!successfulAgents.has(step.agentName) && (errorCounts[step.agentName] || 0) >= MAX_RETRIES) {
      skippedAgents.add(step.agentName);
      console.warn(`[orchestrator] Skipping agent "${step.agentName}" for business ${businessId} after ${errorCounts[step.agentName]} failures`);
    }
  }

  const pendingSteps = steps.filter(
    (s) => !successfulAgents.has(s.agentName) && !skippedAgents.has(s.agentName)
  );

  // If all agents in this phase already ran, just advance status
  if (pendingSteps.length === 0) {
    const lastAgentName = steps[steps.length - 1].agentName;
    const lastOutput = findLogOutput(logs, lastAgentName);

    const finalStatus = await advanceBusinessStatus(
      business,
      businessId,
      currentStatus,
      nextStatus,
      lastOutput
    );

    return {
      success: true,
      newStatus: finalStatus,
      agentName: lastAgentName,
    };
  }

  // 4. Run ONLY the first pending step
  const step = pendingSteps[0];
  const userMessage = buildUserMessage(step.agentName, business, logs);

  const logId = await insertLog(
    businessId,
    step.agentName,
    step.model,
    userMessage.slice(0, 500)
  );

  console.log(
    `[orchestrator] Running agent "${step.agentName}" for business ${businessId} (status: ${currentStatus})`
  );

  const result = await runAgent({
    agentName: step.agentName,
    businessId,
    systemPrompt: step.systemPrompt,
    userMessage,
    model: step.model,
    maxTokens: step.maxTokens,
  });

  await updateLog(logId, result);

  if (result.error) {
    return {
      success: false,
      newStatus: currentStatus,
      agentName: step.agentName,
      error: result.error,
    };
  }

  // 5. Handle per-agent special logic
  if (step.agentName === "scrape") {
    try {
      const parsed = JSON.parse(result.content);
      await db
        .update(businesses)
        .set({
          contactPerson: parsed.contactPerson ?? business.contactPerson,
          phone: parsed.phone ?? business.phone,
          email: parsed.email ?? business.email,
          websiteUrl: parsed.websiteUrl ?? business.websiteUrl,
          websiteQuality: parsed.websiteQuality ?? business.websiteQuality,
          address: parsed.address ?? business.address,
          city: parsed.city ?? business.city,
          updatedAt: new Date(),
        })
        .where(eq(businesses.id, businessId));

      if (parsed.isCandidate === false) {
        await db
          .update(businesses)
          .set({ status: "rejected", updatedAt: new Date() })
          .where(eq(businesses.id, businessId));
        return {
          success: true,
          newStatus: "rejected",
          agentName: "scrape",
        };
      }

      // HARD RULE: No email = reject. Businesses MUST have an email to proceed.
      const finalEmail = parsed.email ?? business.email;
      if (!finalEmail) {
        console.warn(`[orchestrator] Rejecting business ${businessId} â no email address found`);
        await db
          .update(businesses)
          .set({ status: "rejected", updatedAt: new Date() })
          .where(eq(businesses.id, businessId));
        return {
          success: true,
          newStatus: "rejected",
          agentName: "scrape",
          error: "No email address found â business rejected",
        };
      }
    } catch {
      console.warn("[orchestrator] Could not parse scrape output as JSON");
    }
  }

  if (step.agentName === "design-1") {
    await db
      .insert(campaigns)
      .values({
        businessId,
        demoWebsiteHtml: result.content,
        status: "pending",
      })
      .onConflictDoUpdate({
        target: campaigns.businessId,
        set: { demoWebsiteHtml: result.content },
      });
  }

  if (step.agentName === "design-2") {
    await db
      .update(campaigns)
      .set({ emailHtml: result.content })
      .where(eq(campaigns.businessId, businessId));
  }

  if (step.agentName === "copywrite-2") {
    try {
      const parsed = JSON.parse(result.content);
      await db
        .update(campaigns)
        .set({
          emailSubject: parsed.subject,
          emailPlainText: parsed.plainText,
        })
        .where(eq(campaigns.businessId, businessId));
    } catch {
      console.warn("[orchestrator] Could not parse copywrite-2 output as JSON");
    }
  }

  // 6. If this was the last pending step, advance business status
  if (pendingSteps.length === 1) {
    const finalStatus = await advanceBusinessStatus(
      business,
      businessId,
      currentStatus,
      nextStatus,
      result.content
    );

    return {
      success: true,
      newStatus: finalStatus,
      agentName: step.agentName,
    };
  }

  // More steps remain in this phase ÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ stay at current status
  return {
    success: true,
    newStatus: currentStatus,
    agentName: step.agentName,
  };
}

// ---------------------------------------------------------------------------
// Status advancement helper
// ---------------------------------------------------------------------------

async function advanceBusinessStatus(
  business: BusinessRow,
  businessId: number,
  currentStatus: string,
  nextStatus: BusinessStatus,
  lastAgentOutput: string | null
): Promise<string> {
  let finalNextStatus: BusinessStatus = nextStatus;

  // Special case: manager can reject
  if (currentStatus === "reviewing" && lastAgentOutput) {
    try {
      const parsed = JSON.parse(lastAgentOutput);
      if (parsed.decision === "reject") {
        finalNextStatus = "designing";
      }
    } catch {
      console.warn("[orchestrator] Could not parse manager output as JSON");
    }
  }

  // Special case: secretary handles deployment + Gmail draft
  if (currentStatus === "ready" && lastAgentOutput) {
    try {
      const parsed = JSON.parse(lastAgentOutput);

      const slug = parsed.deploymentSlug ?? `biz-${businessId}`;
      const websiteHtml = parsed.websiteHtml ?? "";

      let demoUrl = "";
      try {
        demoUrl = await deployToGitHubPages(slug, websiteHtml);
        console.log(`[orchestrator] Deployed to GitHub Pages: ${demoUrl}`);
      } catch (err) {
        console.error("[orchestrator] GitHub Pages deployment failed:", err);
      }

      const emailHtml = (parsed.emailHtml ?? "").replace(
        /\{\{DEMO_URL\}\}/g,
        demoUrl
      );

      await db
        .update(campaigns)
        .set({
          demoWebsiteUrl: demoUrl,
          demoWebsiteHtml: websiteHtml,
          emailHtml,
          emailSubject: parsed.emailSubject,
          emailPlainText: parsed.emailPlainText?.replace(
            /\{\{DEMO_URL\}\}/g,
            demoUrl
          ),
          status: "pending",
        })
        .where(eq(campaigns.businessId, businessId));

      const recipientEmail = parsed.recipientEmail ?? business.email;
      if (recipientEmail) {
        try {
          const [settingsRow] = await db
            .select()
            .from(settings)
            .where(eq(settings.id, 1))
            .limit(1);

          if (settingsRow?.gmailRefreshToken) {
            const { draftId, messageId } = await createDraft(
              settingsRow.gmailRefreshToken,
              recipientEmail,
              parsed.emailSubject ?? "Uw nieuwe website",
              emailHtml
            );

            await db
              .update(campaigns)
              .set({
                gmailDraftId: draftId,
                gmailMessageId: messageId,
                status: "draft_created",
              })
              .where(eq(campaigns.businessId, businessId));

            console.log(`[orchestrator] Gmail draft created: ${draftId}`);
          } else {
            console.warn(
              "[orchestrator] No Gmail refresh token configured; skipping draft creation"
            );
          }
        } catch (err) {
          console.error("[orchestrator] Gmail draft creation failed:", err);
        }
      }
    } catch {
      console.warn("[orchestrator] Could not parse secretary output as JSON");
    }
  }

  await db
    .update(businesses)
    .set({ status: finalNextStatus, updatedAt: new Date() })
    .where(eq(businesses.id, businessId));

  return finalNextStatus;
}
