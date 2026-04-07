import { db } from "@/lib/db";
import { businesses, agentLogs, campaigns, settings } from "@/lib/db/schema";
import { eq, asc } from "drizzle-orm";
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
        maxTokens: 4096,
      },
      {
        agentName: "design-1",
        systemPrompt: DESIGN_1_SYSTEM_PROMPT,
        model: "sonnet",
        maxTokens: 16384,
      },
      {
        agentName: "copywrite-1",
        systemPrompt: COPYWRITE_1_SYSTEM_PROMPT,
        model: "sonnet",
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
        model: "sonnet",
        maxTokens: 8192,
      },
      {
        agentName: "copywrite-2",
        systemPrompt: COPYWRITE_2_SYSTEM_PROMPT,
        model: "sonnet",
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
        model: "opus",
        maxTokens: 4096,
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
        maxTokens: 16384,
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
        `\n\nThe demo website URL will be determined after GitHub Pages deployment. Use a placeholder like {{DEMO_URL}} if needed — it will be replaced before sending.`,
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
  let lastAgentName = steps[0].agentName;
  let lastResult: AgentResult | null = null;

  // 2. Run each step sequentially
  for (const step of steps) {
    lastAgentName = step.agentName;

    // Reload logs each iteration so sequential steps see previous outputs
    const logs = await getPreviousLogs(businessId);
    const userMessage = buildUserMessage(step.agentName, business, logs);

    // Insert log with "running" status
    const logId = await insertLog(
      businessId,
      step.agentName,
      step.model,
      userMessage.slice(0, 500)
    );

    console.log(
      `[orchestrator] Running agent "${step.agentName}" for business ${businessId} (status: ${currentStatus})`
    );

    // Run the agent
    const result = await runAgent({
      agentName: step.agentName,
      businessId,
      systemPrompt: step.systemPrompt,
      userMessage,
      model: step.model,
      maxTokens: step.maxTokens,
    });

    // Update log with result
    await updateLog(logId, result);
    lastResult = result;

    // If an error occurred, stop the pipeline for this business
    if (result.error) {
      return {
        success: false,
        newStatus: currentStatus,
        agentName: step.agentName,
        error: result.error,
      };
    }

    // --- Special handling per agent ---

    // After scrape: update business fields from parsed output
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

        // If the scrape agent says this is not a candidate, mark as rejected
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
      } catch {
        // If JSON parsing fails, continue anyway
        console.warn("[orchestrator] Could not parse scrape output as JSON");
      }
    }

    // After design-1: store website HTML in campaigns table
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

    // After design-2: store email HTML in campaigns table
    if (step.agentName === "design-2") {
      await db
        .update(campaigns)
        .set({ emailHtml: result.content })
        .where(eq(campaigns.businessId, businessId));
    }

    // After copywrite-2: store email copy in campaigns table
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
  }

  // 3. Determine the final next status
  let finalNextStatus: BusinessStatus = nextStatus;

  // Special case: manager can reject, sending business back to designing
  if (currentStatus === "reviewing" && lastResult) {
    try {
      const parsed = JSON.parse(lastResult.content);
      if (parsed.decision === "reject") {
        finalNextStatus = "designing";
      }
    } catch {
      console.warn("[orchestrator] Could not parse manager output as JSON");
    }
  }

  // Special case: secretary handles deployment
  if (currentStatus === "ready" && lastResult && !lastResult.error) {
    try {
      const parsed = JSON.parse(lastResult.content);

      // Deploy website to GitHub Pages
      const slug = parsed.deploymentSlug ?? `biz-${businessId}`;
      const websiteHtml = parsed.websiteHtml ?? "";

      let demoUrl = "";
      try {
        demoUrl = await deployToGitHubPages(slug, websiteHtml);
        console.log(`[orchestrator] Deployed to GitHub Pages: ${demoUrl}`);
      } catch (err) {
        console.error("[orchestrator] GitHub Pages deployment failed:", err);
      }

      // Replace demo URL placeholder in email HTML
      const emailHtml = (parsed.emailHtml ?? "").replace(
        /\{\{DEMO_URL\}\}/g,
        demoUrl
      );

      // Update campaign with final data
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

      // Create Gmail draft if we have the necessary credentials
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

            console.log(
              `[orchestrator] Gmail draft created: ${draftId}`
            );
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

  // 4. Update business status
  await db
    .update(businesses)
    .set({ status: finalNextStatus, updatedAt: new Date() })
    .where(eq(businesses.id, businessId));

  return {
    success: true,
    newStatus: finalNextStatus,
    agentName: lastAgentName,
  };
}
