import type { BusinessStatus, WebsiteQuality } from "@/lib/db/schema";

export interface Business {
  id: number;
  nicheId: number | null;
  googlePlaceId: string | null;
  name: string;
  contactPerson: string | null;
  phone: string | null;
  email: string | null;
  websiteUrl: string | null;
  websiteQuality: WebsiteQuality | null;
  address: string | null;
  locationLat: string | null;
  locationLng: string | null;
  city: string | null;
  status: BusinessStatus;
  responseStatus: string | null;
  createdAt: Date;
  updatedAt: Date;
  nicheName?: string;
}

export interface BusinessFilters {
  nicheId?: number;
  city?: string;
  status?: BusinessStatus;
  radiusKm?: number;
}
