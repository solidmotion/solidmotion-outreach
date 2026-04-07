import { type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { settings } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function GET() {
  try {
    let [row] = await db
      .select()
      .from(settings)
      .where(eq(settings.id, 1));

    // If no settings row exists, insert defaults and return
    if (!row) {
      [row] = await db
        .insert(settings)
        .values({ id: 1 })
        .returning();
    }

    return Response.json({ data: row });
  } catch (error) {
    console.error("Failed to fetch settings:", error);
    return Response.json(
      { error: "Failed to fetch settings" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();

    // Remove id from body to prevent overwriting the singleton constraint
    const { id, ...updateData } = body;

    const [updatedSettings] = await db
      .update(settings)
      .set({ ...updateData, updatedAt: new Date() })
      .where(eq(settings.id, 1))
      .returning();

    if (!updatedSettings) {
      return Response.json(
        { error: "Settings not found" },
        { status: 404 }
      );
    }

    return Response.json({ data: updatedSettings });
  } catch (error) {
    console.error("Failed to update settings:", error);
    return Response.json(
      { error: "Failed to update settings" },
      { status: 500 }
    );
  }
}
