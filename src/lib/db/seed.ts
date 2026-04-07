import { config } from "dotenv";
config({ path: ".env.local" });

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { niches, settings } from "./schema";

async function seed() {
  const sql = neon(process.env.DATABASE_URL!);
  const db = drizzle(sql);

  console.log("Seeding niches...");
  await db.insert(niches).values([
    { name: "Barbers", icon: "\u2702\uFE0F" },
    { name: "Loodgieters", icon: "\uD83D\uDD27" },
    { name: "Hoveniers", icon: "\uD83C\uDF3F" },
    { name: "Restaurants", icon: "\uD83C\uDF7D\uFE0F" },
    { name: "Kroegen", icon: "\uD83C\uDF7A" },
    { name: "Klusjesmannen", icon: "\uD83D\uDD28" },
  ]).onConflictDoNothing();

  console.log("Seeding settings...");
  await db.insert(settings).values({
    id: 1,
    autoMode: false,
    active: false,
    defaultLocation: "Nederland",
    defaultLat: "52.3676",
    defaultLng: "4.9041",
    defaultRadiusKm: 50,
    dailyLimit: 20,
  }).onConflictDoNothing();

  console.log("Seed complete!");
}

seed().catch(console.error);
