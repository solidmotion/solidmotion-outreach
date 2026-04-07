import { db } from "@/lib/db";
import { businesses, agentLogs } from "@/lib/db/schema";
import { count, desc, sql } from "drizzle-orm";

export async function GET() {
  try {
    // Count businesses grouped by status
    const statusCounts = await db
      .select({
        status: businesses.status,
        count: sql<number>`cast(count(*) as int)`,
      })
      .from(businesses)
      .groupBy(businesses.status);

    // Build byStatus map and calculate total
    const byStatus: Record<string, number> = {};
    let total = 0;
    for (const row of statusCounts) {
      byStatus[row.status] = row.count;
      total += row.count;
    }

    // Recent activity from agent_logs (last 10 entries)
    const recentActivity = await db
      .select({
        id: agentLogs.id,
        businessId: agentLogs.businessId,
        agentName: agentLogs.agentName,
        status: agentLogs.status,
        inputSummary: agentLogs.inputSummary,
        outputSummary: agentLogs.outputSummary,
        createdAt: agentLogs.createdAt,
      })
      .from(agentLogs)
      .orderBy(desc(agentLogs.createdAt))
      .limit(10);

    return Response.json({
      data: {
        overview: {
          total,
          byStatus,
        },
        recentActivity,
      },
    });
  } catch (error) {
    console.error("Failed to fetch pipeline overview:", error);
    return Response.json(
      { error: "Failed to fetch pipeline overview" },
      { status: 500 }
    );
  }
}
