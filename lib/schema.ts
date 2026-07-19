import { pgTable, text, timestamp, boolean, uuid, date } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const loginTokens = pgTable("login_tokens", {
  token: text("token").primaryKey(),
  email: text("email").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
});

export const babies = pgTable("babies", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id),
  name: text("name").notNull(),
  birthdate: date("birthdate").notNull(),
});

export const entries = pgTable("entries", {
  id: uuid("id").primaryKey().defaultRandom(),
  babyId: uuid("baby_id").notNull().references(() => babies.id),
  recordedAt: timestamp("recorded_at").notNull().defaultNow(),
  audioUrl: text("audio_url").notNull(),
  transcript: text("transcript"),
  title: text("title"),
  summary: text("summary"),
  quote: text("quote"),
  isMilestone: boolean("is_milestone").notNull().default(false),
  milestoneType: text("milestone_type"),
  photoPrompt: text("photo_prompt"),
  inAlbum: boolean("in_album").notNull().default(false),
  status: text("status").notNull().default("processing"), // processing | ready | failed
});

export const photos = pgTable("photos", {
  id: uuid("id").primaryKey().defaultRandom(),
  entryId: uuid("entry_id").notNull().references(() => entries.id, { onDelete: "cascade" }),
  blobUrl: text("blob_url").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
