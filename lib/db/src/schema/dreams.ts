import { pgTable, text, timestamp, boolean, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const dreamsTable = pgTable("dreams", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  mood: text("mood").notNull(),
  clarity: text("clarity").notNull(),
  isRecurring: boolean("is_recurring").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  summary: text("summary"),
  keywords: text("keywords").array(),
  emotionAnalysis: text("emotion_analysis"),
  possibleConnection: text("possible_connection"),
  aiResponse: text("ai_response"),
  imageUrl: text("image_url"),
});

export const insertDreamSchema = createInsertSchema(dreamsTable).omit({ id: true, createdAt: true });
export type InsertDream = z.infer<typeof insertDreamSchema>;
export type Dream = typeof dreamsTable.$inferSelect;
