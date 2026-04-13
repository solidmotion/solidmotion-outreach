import { type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { businesses } from "@/lib/db/schema";
import { sql, asc } from "drizzle-orm";
import { processNextStep } from "@/lib/agents/orchestrator";

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));

    let businessId = body.businessId ? parseInt(body.businessId, 10) : null;

    if (!businessId) {
      // Find the next business that needs processing
      const processableStatuses = [
        "discovered",
        "researching",
        "designing",
        "copywriting",
        "reviewing",
        "ready",
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
          },
        });
      }

      businessId = nextBusiness.id;
    }

    // Run ONE agent step
    const result = await processNextStep(businessId);

    // Check if business reached a terminal status
    const terminal = ["sent", "replied", "converted", "rejected"].includes(
      result.newStatus
    );

    return Response.json({
      data: {
        businessId,
        ...result,
        terminal,
        processedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("Failed to process pipeline step:", error);
    return Response.json(
      { error: "Failed to process pipeline step" },
      { status: 500 }
    );
  }
}
