import { db } from "@/lib/db";
import { businesses, settings, agentLogs } from "@/lib/db/schema";
import { eq, sql, asc, count } from "drizzle-orm";
import { processNextStep } from "@/lib/agents/orchestrator";

export const maxDuration = 60;

/**
 * POST /api/pipeline/process-next
 * Picks the next processable business and runs one agent step.
 * No auth required but checks if engine is active.
 */
export async function POST() {
  try {
    // 1. Check if engine is active
    const [config] = await db.select().from(settings).where(eq(settings.id, 1));
    if (!config || !config.active) {
      return Response.json({
        data: { status: "inactive", reason: "Outreach engine is niet actief" },
      });
    }

    // 2. Check daily limit
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const [{ todayCount }] = await db
      .select({ todayCount: count() })
      .from(agentLogs)
      .where(sql`${agentLogs.createdAt} >= ${todayStart}`);

    const dailyLimit = config.dailyLimit ?? 20;
    if (todayCount >= dailyLimit) {
      return Response.json({
        data: { status: "limit", reason: `Daglimiet bereikt (${todayCount}/${dailyLimit})` },
      });
    }

    // 3. Find next business
    const processableStatuses = ["discovered", "researching", "designing", "copywriting", "reviewing"];
    const [nextBusiness] = await db
      .select()
      .from(businesses)
      .where(
        sql`${businesses.status} IN (${sql.join(
          processableStatuses.map((s) => sql`${s}`),
          sql`, `
        )})`
      )
      .orderBy(asc(businesses.updatedAt))
      .limit(1);

    if (!nextBusiness) {
      return Response.json({
        data: { status: "idle", reason: "Geen bedrijven om te verwerken" },
      });
    }

    // 4. Process one step
    const result = await processNextStep(nextBusiness.id);

    return Response.json({
      data: {
        status: "completed",
        businessId: nextBusiness.id,
        businessName: nextBusiness.name,
        previousStatus: nextBusiness.status,
        result,
        todayProcessed: todayCount + 1,
        dailyLimit,
        processedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("Process-next failed:", error);
    return Response.json(
      { error: "Verwerking mislukt: " + (error instanceof Error ? error.message : String(error)) },
      { status: 500 }
    );
  }
}
