import { pgTable, text, timestamp, boolean, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const charactersTable = pgTable("characters", {
  id: uuid("id").primaryKey().defaultRandom(),
  anonymousId: text("anonymous_id").notNull(),
  name: text("name").notNull(),
  avatar: text("avatar"),
  role: text("role").notNull(),
  personality: text("personality").array().notNull().default([]),
  speakingStyle: text("speaking_style").notNull(),
  relationship: text("relationship").notNull(),
  language: text("language").notNull().default("zh"),
  voiceType: text("voice_type").notNull(),
  systemPrompt: text("system_prompt").notNull(),
  isActive: boolean("is_active").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertCharacterSchema = createInsertSchema(charactersTable).omit({ id: true, createdAt: true });
export type InsertCharacter = z.infer<typeof insertCharacterSchema>;
export type Character = typeof charactersTable.$inferSelect;
