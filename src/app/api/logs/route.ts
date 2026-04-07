import { type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { agentLogs, businesses } from "@/lib/db/schema";
import { eq, desc, sql, count } from "drizzle-orm";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const agentName = searchParams.get("agentName");
    const status = searchParams.get("status");
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "20", 10);
    const offset = (page - 1) * limit;

    // Build where conditions
    const conditions = [];
    if (agentName) conditions.push(eq(agentLogs.agentName, agentName));
    if (status) conditions.push(eq(agentLogs.status, status));

    const where = conditions.length > 0
      ? sql`${sql.join(conditions, sql` AND `)}`
      : undefined;

    // Query logs with business name
    const data = await db
      .select({
        id: agentLogs.id,
        businessId: agentLogs.businessId,
        businessName: businesses.name,
        agentName: agentLogs.agentName,
        modelUsed: agentLogs.modelUsed,
        inputSummary: agentLogs.inputSummary,
        outputSummary: agentLogs.outputSummary,
        tokensIn: agentLogs.tokensIn,
        tokensOut: agentLogs.tokensOut,
        costCents: agentLogs.costCents,
        durationMs: agentLogs.durationMs,
        status: agentLogs.status,
        errorMessage: agentLogs.errorMessage,
        createdAt: agentLogs.createdAt,
      })
      .from(agentLogs)
      .leftJoin(businesses, eq(agentLogs.businessId, businesses.id))
      .where(where)
      .orderBy(desc(agentLogs.createdAt))
      .limit(limit)
      .offset(offset);

    // Get total count with same filters
    const [{ total }] = await db
      .select({ total: count() })
      .from(agentLogs)
      .where(where);

    return Response.json({
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Failed to fetch logs:", error);
    return Response.json(
      { error: "Failed to fetch logs" },
      { status: 500 }
    );
  }
}
