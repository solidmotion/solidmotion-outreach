import { type NextRequest } from "next/server";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { settings } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getTokensFromCode } from "@/lib/google/gmail";

export async function GET(request: NextRequest) {
  try {
    const code = request.nextUrl.searchParams.get("code");
    const error = request.nextUrl.searchParams.get("error");

    if (error) {
      redirect("/settings?auth=error&message=" + encodeURIComponent(error));
    }

    if (!code) {
      return Response.json(
        { error: "Authorization code is required" },
        { status: 400 }
      );
    }

    // Exchange code for tokens
    const { refreshToken } = await getTokensFromCode(code);

    // Get the user's email from the token info (optional — store refresh token)
    // Store refresh token in settings
    await db
      .update(settings)
      .set({
        gmailRefreshToken: refreshToken,
        updatedAt: new Date(),
      })
      .where(eq(settings.id, 1));

    redirect("/settings?auth=success");
  } catch (error) {
    // redirect() throws a special error in Next.js, re-throw it
    throw error;
  }
}
