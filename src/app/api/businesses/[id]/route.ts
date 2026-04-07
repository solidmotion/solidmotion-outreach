import { type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { businesses, campaigns, niches } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const businessId = parseInt(id, 10);

    if (isNaN(businessId)) {
      return Response.json(
        { error: "Invalid business ID" },
        { status: 400 }
      );
    }

    const [business] = await db
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
        placesDataCached: businesses.placesDataCached,
        createdAt: businesses.createdAt,
        updatedAt: businesses.updatedAt,
      })
      .from(businesses)
      .leftJoin(niches, eq(businesses.nicheId, niches.id))
      .where(eq(businesses.id, businessId));

    if (!business) {
      return Response.json(
        { error: "Business not found" },
        { status: 404 }
      );
    }

    // Get campaign data for this business
    const [campaign] = await db
      .select()
      .from(campaigns)
      .where(eq(campaigns.businessId, businessId));

    return Response.json({
      data: { ...business, campaign: campaign || null },
    });
  } catch (error) {
    console.error("Failed to fetch business:", error);
    return Response.json(
      { error: "Failed to fetch business" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const businessId = parseInt(id, 10);

    if (isNaN(businessId)) {
      return Response.json(
        { error: "Invalid business ID" },
        { status: 400 }
      );
    }

    const body = await request.json();

    const [updatedBusiness] = await db
      .update(businesses)
      .set({ ...body, updatedAt: new Date() })
      .where(eq(businesses.id, businessId))
      .returning();

    if (!updatedBusiness) {
      return Response.json(
        { error: "Business not found" },
        { status: 404 }
      );
    }

    return Response.json({ data: updatedBusiness });
  } catch (error) {
    console.error("Failed to update business:", error);
    return Response.json(
      { error: "Failed to update business" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const businessId = parseInt(id, 10);

    if (isNaN(businessId)) {
      return Response.json(
        { error: "Invalid business ID" },
        { status: 400 }
      );
    }

    const [deleted] = await db
      .delete(businesses)
      .where(eq(businesses.id, businessId))
      .returning();

    if (!deleted) {
      return Response.json(
        { error: "Business not found" },
        { status: 404 }
      );
    }

    return Response.json({
      message: `Business ${businessId} deleted successfully`,
    });
  } catch (error) {
    console.error("Failed to delete business:", error);
    return Response.json(
      { error: "Failed to delete business" },
      { status: 500 }
    );
  }
}
