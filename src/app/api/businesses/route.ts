import { type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { businesses, niches } from "@/lib/db/schema";
import { eq, like, sql, count } from "drizzle-orm";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const nicheId = searchParams.get("nicheId");
    const city = searchParams.get("city");
    const status = searchParams.get("status");
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "20", 10);
    const offset = (page - 1) * limit;

    // Build where conditions
    const conditions = [];
    if (nicheId) conditions.push(eq(businesses.nicheId, parseInt(nicheId, 10)));
    if (city) conditions.push(like(businesses.city, `%${city}%`));
    if (status) conditions.push(eq(businesses.status, status));

    const where = conditions.length > 0
      ? sql`${sql.join(conditions, sql` AND `)}`
      : undefined;

    // Query businesses with niche name
    const data = await db
      .select({
        id: businesses.id,
        nicheId: businesses.nicheId,
        nicheName: niches.name,
        googlePlaceId: businesses.googlePlaceId,
        name: businesses.name,
        contactPerson: businesses.contactPerson,
        phone: businesses.phone,
        email: businesses.email,
        websiteUrl: businesses.websiteUrl,
        websiteQuality: businesses.websiteQuality,
        address: businesses.address,
        locationLat: businesses.locationLat,
        locationLng: businesses.locationLng,
        city: businesses.city,
        status: businesses.status,
        responseStatus: businesses.responseStatus,
        createdAt: businesses.createdAt,
        updatedAt: businesses.updatedAt,
      })
      .from(businesses)
      .leftJoin(niches, eq(businesses.nicheId, niches.id))
      .where(where)
      .limit(limit)
      .offset(offset);

    // Get total count with same filters
    const [{ total }] = await db
      .select({ total: count() })
      .from(businesses)
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
    console.error("Failed to fetch businesses:", error);
    return Response.json(
      { error: "Failed to fetch businesses" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body.name) {
      return Response.json(
        { error: "Business name is required" },
        { status: 400 }
      );
    }

    const [newBusiness] = await db
      .insert(businesses)
      .values({
        nicheId: body.nicheId || null,
        googlePlaceId: body.googlePlaceId || null,
        name: body.name,
        contactPerson: body.contactPerson || null,
        phone: body.phone || null,
        email: body.email || null,
        websiteUrl: body.websiteUrl || null,
        websiteQuality: body.websiteQuality || "none",
        address: body.address || null,
        locationLat: body.locationLat || null,
        locationLng: body.locationLng || null,
        city: body.city || null,
      })
      .returning();

    return Response.json({ data: newBusiness }, { status: 201 });
  } catch (error) {
    console.error("Failed to create business:", error);
    return Response.json(
      { error: "Failed to create business" },
      { status: 500 }
    );
  }
}
