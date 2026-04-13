import { db } from "@/lib/db";
import { businesses, settings, agentLogs } from "@/lib/db/schema";
import { eq, sql, asc, count } from "drizzle-orm";
import { processNextStep } from "@/lib/agents/orchestrator";

export const maxDuration = 300;

/**
 * POST /api/pipeline/process-next
 * 
 * Picks the next processable business and runs it through ALL pipeline stages
 * until it reaches "sent" status (or gets rejected/errors out).
 * This means one call = one fully completed business with a Gmail draft.
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

    // 2. Check daily limit (counts fully completed businesses today)
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const completedToday = await db
      .select({ id: businesses.id })
      .from(businesses)
      .where(sql`${businesses.status} = 'sent' AND ${businesses.updatedAt} >= ${todayStart}`);

    const dailyLimit = config.dailyLimit ?? 20;
    if (completedToday.length >= dailyLimit) {
      return Response.json({
        data: { status: "limit", reason: `Daglimiet bereikt (${completedToday.length}/${dailyLimit})` },
      });
    }

    // 3. Find next business to process
    const processableStatuses = ["discovered", "researching", "designing", "copywriting", "reviewing", "ready"];
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

    // 4. Process this business through ALL remaining pipeline stages
    const stepsCompleted: string[] = [];
    let currentBusiness = nextBusiness;
    const terminalStatuses = ["sent", "rejected", "replied", "converted"];
    const maxSteps = 10; // safety limit
    let step = 0;

    while (!terminalStatuses.includes(currentBusiness.status) && step < maxSteps) {
      step++;
      const previousStatus = currentBusiness.status;

      try {
        const result = await processNextStep(currentBusiness.id);
        stepsCompleted.push(`${result.agentName}: ${previousStatus} → ${result.newStatus}`);

        if (!result.success) {
          return Response.json({
            data: {
              status: "error",
              businessId: currentBusiness.id,
              businessName: currentBusiness.name,
              stepsCompleted,
              error: result.error,
            },
          });
        }

        // Reload business to get updated status
        const [updated] = await db
          .select()
          .from(businesses)
          .where(eq(businesses.id, currentBusiness.id));
        
        if (!updated) break;
        currentBusiness = updated;
      } catch (err) {
        return Response.json({
          data: {
            status: "error",
            businessId: currentBusiness.id,
            businessName: currentBusiness.name,
            stepsCompleted,
            error: err instanceof Error ? err.message : String(err),
          },
        });
      }
    }

    return Response.json({
      data: {
        status: currentBusiness.status === "sent" ? "completed" : "partial",
        businessId: currentBusiness.id,
        businessName: currentBusiness.name,
        finalStatus: currentBusiness.status,
        stepsCompleted,
        completedToday: completedToday.length + (currentBusiness.status === "sent" ? 1 : 0),
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
