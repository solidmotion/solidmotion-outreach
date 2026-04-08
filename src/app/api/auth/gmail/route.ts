import { getAuthUrl } from "@/lib/google/gmail";

export async function GET() {
    try {
          const url = getAuthUrl();

      return Response.json({
              url,
              data: {
                        url,
                        message: "Redirect user to this URL to authorize Gmail access",
              },
      });
    } catch (error) {
          console.error("Failed to generate OAuth URL:", error);
          return Response.json(
            { error: "Failed to generate OAuth URL" },
            { status: 500 }
                );
    }
}

