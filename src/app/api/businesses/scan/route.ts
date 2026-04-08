import { type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { businesses, niches, settings } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { searchBusinesses } from "@/lib/google/places";

/**
 * POST /api/businesses/scan
 *
 * Scans Google Places for new businesses based on active niches and settings.
 * Accepts optional `radiusKm` in the body to override the default radius.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const overrideRadius = body.radiusKm ? Number(body.radiusKm) : null;

    // 1. Load settings for lat/lng/radius
    const [config] = await db
      .select()
      .from(settings)
      .where(eq(settings.id, 1));

    if (!config) {
      return Response.json(
        { error: "Settings not configured. Ga naar Instellingen." },
        { status: 400 }
      );
    }

    const lat = Number(config.defaultLat) || 52.3676;
    const lng = Number(config.defaultLng) || 4.9041;
    const radiusKm = overrideRadius ?? config.defaultRadiusKm ?? 50;

    // 2. Get active niches
    const activeNiches = await db
      .select()
      .from(niches)
      .where(eq(niches.active, true));

    if (activeNiches.length === 0) {
      return Response.json(
        { error: "Geen actieve niches gevonden. Activeer eerst een niche." },
        { status: 400 }
      );
    }

    // 3. Search for businesses per niche
    let totalFound = 0;
    let totalNew = 0;
    const errors: string[] = [];

    for (const niche of activeNiches) {
      try {
        const places = await searchBusinesses(niche.name, lat, lng, radiusKm);

        for (const place of places) {
          const addressParts = place.formattedAddress?.split(",") ?? [];
          const cityPart = addressParts.length >= 2
            ? addressParts[addressParts.length - 2]?.trim()?.replace(/\d{4}\s*[A-Z]{0,2}\s*/g, "").trim()
            : null;

          totalFound++;

          if (place.id) {
            const existing = await db
              .select({ id: businesses.id })
              .from(businesses)
              .where(eq(businesses.googlePlaceId, place.id))
              .limit(1);

            if (existing.length > 0) {
              continue;
            }
          }

          let websiteQuality = "none";
          if (place.websiteUri) {
            websiteQuality = "decent";
          }

          await db.insert(businesses).values({
            nicheId: niche.id,
            googlePlaceId: place.id || null,
            name: place.displayName?.text || "Onbekend bedrijf",
            phone: place.nationalPhoneNumber || place.internationalPhoneNumber || null,
            websiteUrl: place.websiteUri || null,
            websiteQuality,
            address: place.formattedAddress || null,
            locationLat: place.location?.latitude ? String(place.location.latitude) : null,
            locationLng: place.location?.longitude ? String(place.location.longitude) : null,
            city: cityPart || null,
            status: "discovered",
            placesDataCached: place as unknown as Record<string, unknown>,
          });

          totalNew++;
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        errors.push(`Niche "${niche.name}": ${message}`);
        console.error(`Scan error for niche ${niche.name}:`, err);
      }
    }

    return Response.json({
      data: {
        nichesScanned: activeNiches.length,
        totalFound,
        totalNew,
        totalSkipped: totalFound - totalNew,
        errors: errors.length > 0 ? errors : undefined,
      },
    });
  } catch (error) {
    console.error("Scan failed:", error);
    return Response.json(
      { error: "Scan mislukt. Controleer de Google Places API key." },
      { status: 500 }
    );
  }
}
