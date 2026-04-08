import { type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { niches, businesses } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const nicheId = parseInt(id, 10);

    if (isNaN(nicheId)) {
      return Response.json({ error: "Invalid niche ID" }, { status: 400 });
    }

    const body = await request.json();

    const updateData: Record<string, unknown> = {};
    if (typeof body.active === "boolean") updateData.active = body.active;
    if (typeof body.name === "string") updateData.name = body.name;
    if (typeof body.icon === "string") updateData.icon = body.icon;

    if (Object.keys(updateData).length === 0) {
      return Response.json(
        { error: "No valid fields to update" },
        { status: 400 }
      );
    }

    const [updated] = await db
      .update(niches)
      .set(updateData)
      .where(eq(niches.id, nicheId))
      .returning();

    if (!updated) {
      return Response.json({ error: "Niche not found" }, { status: 404 });
    }

    return Response.json({ data: updated });
  } catch (error) {
    console.error("Failed to update niche:", error);
    return Response.json(
      { error: "Failed to update niche" },
      { status: 500 }
    );
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const nicheId = parseInt(id, 10);

    if (isNaN(nicheId)) {
      return Response.json({ error: "Invalid niche ID" }, { status: 400 });
    }

    // Remove niche reference from businesses first
    await db
      .update(businesses)
      .set({ nicheId: null })
      .where(eq(businesses.nicheId, nicheId));

    const [deleted] = await db
      .delete(niches)
      .where(eq(niches.id, nicheId))
      .returning();

    if (!deleted) {
      return Response.json({ error: "Niche not found" }, { status: 404 });
    }

    return Response.json({ data: { success: true, id: nicheId } });
  } catch (error) {
    console.error("Failed to delete niche:", error);
    return Response.json(
      { error: "Failed to delete niche" },
      { status: 500 }
    );
  }
}
