import { type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { businesses, settings, agentLogs } from "@/lib/db/schema";
import { eq, sql, asc, count } from "drizzle-orm";
import { isWithinWorkHours } from "@/lib/scheduling/scheduler";
import { processNextStep } from "@/lib/agents/orchestrator";

export async function GET(request: NextRequest) {
  try {
    // 1. Verify CRON_SECRET auth
    const authHeader = request.headers.get("authorization");

    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return Response.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // 2. Check if within work hours
    if (!isWithinWorkHours()) {
      return Response.json({
        data: {
          status: "skipped",
          reason: "Outside work hours (9:00-17:00 CET, Mon-Fri)",
          processedAt: new Date().toISOString(),
        },
      });
    }

    // 3. Load settings and check if active
    const [config] = await db
      .select()
      .from(settings)
      .where(eq(settings.id, 1));

    if (!config || !config.active) {
      return Response.json({
        data: {
          status: "skipped",
          reason: "Processing is not active",
          processedAt: new Date().toISOString(),
        },
      });
    }

    // 4. Count today's processed businesses
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [{ todayCount }] = await db
      .select({ todayCount: count() })
      .from(agentLogs)
      .where(sql`${agentLogs.createdAt} >= ${todayStart}`);

    const dailyLimit = config.dailyLimit ?? 20;

    if (todayCount >= dailyLimit) {
      return Response.json({
        data: {
          status: "skipped",
          reason: `Daily limit reached (${todayCount}/${dailyLimit})`,
          processedAt: new Date().toISOString(),
        },
      });
    }

    // 5. Find next business that needs processing
    const processableStatuses = [
      "discovered",
      "researching",
      "designing",
      "copywriting",
      "reviewing",
    ];

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
        data: {
          status: "idle",
          reason: "No businesses need processing",
          todayProcessed: todayCount,
          dailyLimit,
          processedAt: new Date().toISOString(),
        },
      });
    }

    // 6. Run the orchestrator
    const result = await processNextStep(nextBusiness.id);

    // 7. Return summary
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
    console.error("Cron processing failed:", error);
    return Response.json(
      { error: "Cron processing failed" },
      { status: 500 }
    );
  }
}
