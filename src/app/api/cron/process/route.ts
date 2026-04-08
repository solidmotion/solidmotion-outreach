import { type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { businesses, settings, agentLogs } from "@/lib/db/schema";
import { eq, sql, asc, count } from "drizzle-orm";
import { isWithinWorkHours } from "@/lib/scheduling/scheduler";
import { processNextStep } from "@/lib/agents/orchestrator";

export const maxDuration = 60;

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!isWithinWorkHours()) {
      return Response.json({
        data: { status: "skipped", reason: "Outside work hours (9:00-17:00 CET, Mon-Fri)" },
      });
    }

    const [config] = await db.select().from(settings).where(eq(settings.id, 1));
    if (!config || !config.active) {
      return Response.json({
        data: { status: "skipped", reason: "Processing is not active" },
      });
    }

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const [{ todayCount }] = await db
      .select({ todayCount: count() })
      .from(agentLogs)
      .where(sql`${agentLogs.createdAt} >= ${todayStart}`);

    const dailyLimit = config.dailyLimit ?? 20;
    if (todayCount >= dailyLimit) {
      return Response.json({
        data: { status: "skipped", reason: `Daily limit reached (${todayCount}/${dailyLimit})` },
      });
    }

    // Process multiple businesses in a loop (up to 50 seconds)
    const startTime = Date.now();
    const maxRunMs = 50000; // 50 seconds max to stay within 60s limit
    const results: Array<{ businessId: number; name: string; previousStatus: string; result: unknown }> = [];
    let processed = 0;

    const processableStatuses = ["discovered", "researching", "designing", "copywriting", "reviewing"];

    while (Date.now() - startTime < maxRunMs && (todayCount + processed) < dailyLimit) {
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

      if (!nextBusiness) break;

      try {
        const result = await processNextStep(nextBusiness.id);
        results.push({
          businessId: nextBusiness.id,
          name: nextBusiness.name,
          previousStatus: nextBusiness.status,
          result,
        });
        processed++;
      } catch (err) {
        console.error(`Failed to process business ${nextBusiness.id}:`, err);
        break; // Stop on error to avoid cascading failures
      }
    }

    return Response.json({
      data: {
        status: processed > 0 ? "completed" : "idle",
        processed,
        results,
        todayProcessed: todayCount + processed,
        dailyLimit,
        elapsedMs: Date.now() - startTime,
        processedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("Cron processing failed:", error);
    return Response.json({ error: "Cron processing failed" }, { status: 500 });
  }
}
