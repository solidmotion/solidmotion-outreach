import { type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { businesses } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { processNextStep } from "@/lib/agents/orchestrator";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body.businessId) {
      return Response.json(
        { error: "businessId is required" },
        { status: 400 }
      );
    }

    const businessId = parseInt(body.businessId, 10);

    if (isNaN(businessId)) {
      return Response.json(
        { error: "Invalid businessId" },
        { status: 400 }
      );
    }

    // Verify the business exists
    const [business] = await db
      .select()
      .from(businesses)
      .where(eq(businesses.id, businessId));

    if (!business) {
      return Response.json(
        { error: "Business not found" },
        { status: 404 }
      );
    }

    // Run the orchestrator
    const result = await processNextStep(businessId);

    return Response.json({
      data: {
        businessId,
        previousStatus: business.status,
        ...result,
        processedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("Failed to process pipeline step:", error);
    return Response.json(
      { error: "Failed to trigger pipeline processing" },
      { status: 500 }
    );
  }
}
