import { type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { niches, businesses } from "@/lib/db/schema";
import { eq, sql, count } from "drizzle-orm";

export async function GET() {
  try {
    const result = await db
      .select({
        id: niches.id,
        name: niches.name,
        icon: niches.icon,
        active: niches.active,
        createdAt: niches.createdAt,
        businessCount: sql<number>`cast(count(${businesses.id}) as int)`,
      })
      .from(niches)
      .leftJoin(businesses, eq(businesses.nicheId, niches.id))
      .groupBy(niches.id);

    return Response.json({ data: result });
  } catch (error) {
    console.error("Failed to fetch niches:", error);
    return Response.json(
      { error: "Failed to fetch niches" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body.name) {
      return Response.json(
        { error: "Niche name is required" },
        { status: 400 }
      );
    }

    const [newNiche] = await db
      .insert(niches)
      .values({
        name: body.name,
        icon: body.icon || undefined,
      })
      .returning();

    return Response.json({ data: { ...newNiche, businessCount: 0 } }, { status: 201 });
  } catch (error) {
    console.error("Failed to create niche:", error);
    return Response.json(
      { error: "Failed to create niche" },
      { status: 500 }
    );
  }
}
