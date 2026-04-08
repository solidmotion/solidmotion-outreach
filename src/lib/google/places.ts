const PLACES_API_BASE = "https://places.googleapis.com/v1/places";

function getApiKey(): string {
  const key = process.env.GOOGLE_PLACES_API_KEY;
  if (!key) {
    throw new Error("GOOGLE_PLACES_API_KEY environment variable is not set");
  }
  return key;
}

export interface PlaceResult {
  id: string;
  displayName: { text: string; languageCode: string };
  formattedAddress: string;
  location: { latitude: number; longitude: number };
  websiteUri?: string;
  nationalPhoneNumber?: string;
  internationalPhoneNumber?: string;
  rating?: number;
  userRatingCount?: number;
  businessStatus?: string;
  types?: string[];
  reviews?: PlaceReview[];
  primaryType?: string;
  editorialSummary?: { text: string };
}

export interface PlaceReview {
  name: string;
  relativePublishTimeDescription: string;
  rating: number;
  text?: { text: string; languageCode: string };
  authorAttribution?: {
    displayName: string;
    uri: string;
  };
}

export interface TextSearchResponse {
  places: PlaceResult[];
  nextPageToken?: string;
}

/**
 * Search for businesses near a location using Google Places Text Search API.
 * Uses textQuery instead of includedTypes so Dutch niche names work as search terms.
 */
export async function searchBusinesses(
  niche: string,
  lat: number,
  lng: number,
  radiusKm: number
): Promise<PlaceResult[]> {
  const apiKey = getApiKey();
  const radiusMeters = radiusKm * 1000;

  const response = await fetch(`${PLACES_API_BASE}:searchText`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask":
        "places.id,places.displayName,places.formattedAddress,places.location,places.websiteUri,places.nationalPhoneNumber,places.internationalPhoneNumber,places.rating,places.userRatingCount,places.businessStatus,places.types,places.primaryType",
    },
    body: JSON.stringify({
      textQuery: niche,
      locationBias: {
        circle: {
          center: { latitude: lat, longitude: lng },
          radius: radiusMeters,
        },
      },
      maxResultCount: 20,
      languageCode: "nl",
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(
      `Google Places API error (${response.status}): ${errorBody}`
    );
  }

  const data: TextSearchResponse = await response.json();
  return data.places || [];
}

/**
 * Get detailed information about a specific place.
 */
export async function getPlaceDetails(
  placeId: string
): Promise<PlaceResult> {
  const apiKey = getApiKey();

  const response = await fetch(`${PLACES_API_BASE}/${placeId}`, {
    method: "GET",
    headers: {
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask":
        "id,displayName,formattedAddress,location,websiteUri,nationalPhoneNumber,internationalPhoneNumber,rating,userRatingCount,businessStatus,types,reviews,primaryType,editorialSummary",
    },
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(
      `Google Places API error (${response.status}): ${errorBody}`
    );
  }

  return response.json();
}
