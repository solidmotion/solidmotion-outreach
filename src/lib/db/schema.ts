import {
  pgTable,
  serial,
  varchar,
  text,
  boolean,
  integer,
  timestamp,
  date,
  time,
  jsonb,
  numeric,
  check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const niches = pgTable("niches", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 100 }).notNull().unique(),
  icon: varchar("icon", { length: 50 }).notNull().default("🏢"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const businesses = pgTable("businesses", {
  id: serial("id").primaryKey(),
  nicheId: integer("niche_id").references(() => niches.id),
  googlePlaceId: varchar("google_place_id", { length: 255 }).unique(),
  name: varchar("name", { length: 255 }).notNull(),
  contactPerson: varchar("contact_person", { length: 255 }),
  phone: varchar("phone", { length: 50 }),
  email: varchar("email", { length: 255 }),
  websiteUrl: varchar("website_url", { length: 500 }),
  websiteQuality: varchar("website_quality", { length: 20 }).default("none"),
  address: text("address"),
  locationLat: numeric("location_lat", { precision: 10, scale: 7 }),
  locationLng: numeric("location_lng", { precision: 10, scale: 7 }),
  city: varchar("city", { length: 100 }),
  status: varchar("status", { length: 30 }).notNull().default("discovered"),
  responseStatus: varchar("response_status", { length: 20 }),
  placesDataCached: jsonb("places_data_cached"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const campaigns = pgTable("campaigns", {
  id: serial("id").primaryKey(),
  businessId: integer("business_id")
    .references(() => businesses.id)
    .notNull()
    .unique(),
  demoWebsiteUrl: varchar("demo_website_url", { length: 500 }),
  demoWebsiteHtml: text("demo_website_html"),
  emailHtml: text("email_html"),
  emailSubject: varchar("email_subject", { length: 255 }),
  emailPlainText: text("email_plain_text"),
  gmailDraftId: varchar("gmail_draft_id", { length: 100 }),
  gmailMessageId: varchar("gmail_message_id", { length: 100 }),
  status: varchar("status", { length: 20 }).notNull().default("pending"),
  scheduledSendAt: timestamp("scheduled_send_at"),
  sentAt: timestamp("sent_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const agentLogs = pgTable("agent_logs", {
  id: serial("id").primaryKey(),
  businessId: integer("business_id").references(() => businesses.id),
  agentName: varchar("agent_name", { length: 50 }).notNull(),
  modelUsed: varchar("model_used", { length: 30 }),
  inputSummary: text("input_summary"),
  outputSummary: text("output_summary"),
  fullOutput: jsonb("full_output"),
  tokensIn: integer("tokens_in"),
  tokensOut: integer("tokens_out"),
  costCents: numeric("cost_cents", { precision: 10, scale: 4 }),
  durationMs: integer("duration_ms"),
  status: varchar("status", { length: 20 }).notNull().default("success"),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const settings = pgTable(
  "settings",
  {
    id: integer("id").primaryKey().default(1),
    autoMode: boolean("auto_mode").notNull().default(false),
    active: boolean("active").notNull().default(false),
    defaultLocation: varchar("default_location", { length: 255 }).default(
      "Nederland"
    ),
    defaultLat: numeric("default_lat", { precision: 10, scale: 7 }).default(
      "52.3676"
    ),
    defaultLng: numeric("default_lng", { precision: 10, scale: 7 }).default(
      "4.9041"
    ),
    defaultRadiusKm: integer("default_radius_km").default(50),
    dailyLimit: integer("daily_limit").default(20),
    gmailRefreshToken: text("gmail_refresh_token"),
    gmailEmail: varchar("gmail_email", { length: 255 }),
    githubToken: text("github_token"),
    githubRepo: varchar("github_repo", { length: 255 }),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [check("single_row", sql`${table.id} = 1`)]
);

export const scheduleSlots = pgTable("schedule_slots", {
  id: serial("id").primaryKey(),
  businessId: integer("business_id")
    .references(() => businesses.id)
    .notNull(),
  scheduledDate: date("scheduled_date").notNull(),
  scheduledTime: time("scheduled_time").notNull(),
  status: varchar("status", { length: 20 }).notNull().default("pending"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Status enums als constanten
export const BUSINESS_STATUSES = [
  "discovered",
  "researching",
  "designing",
  "copywriting",
  "reviewing",
  "ready",
  "sent",
  "replied",
  "converted",
  "rejected",
] as const;

export const CAMPAIGN_STATUSES = [
  "pending",
  "draft_created",
  "sent",
  "failed",
] as const;

export const WEBSITE_QUALITIES = [
  "none",
  "poor",
  "decent",
  "good",
] as const;

export type BusinessStatus = (typeof BUSINESS_STATUSES)[number];
export type CampaignStatus = (typeof CAMPAIGN_STATUSES)[number];
export type WebsiteQuality = (typeof WEBSITE_QUALITIES)[number];
