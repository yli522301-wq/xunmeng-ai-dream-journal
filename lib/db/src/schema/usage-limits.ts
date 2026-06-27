import { pgTable, text, timestamp, integer, date, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const anonymousSessionsTable = pgTable("anonymous_sessions", {
  id: text("id").primaryKey(),
  ipHash: text("ip_hash").notNull(),
  deviceFingerprint: text("device_fingerprint"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  lastActiveAt: timestamp("last_active_at", { withTimezone: true }).notNull().defaultNow(),
});

export const usageLimitsTable = pgTable("usage_limits", {
  id: text("id").primaryKey(),
  anonymousId: text("anonymous_id").notNull().references(() => anonymousSessionsTable.id, { onDelete: "cascade" }),
  limitDate: date("limit_date", { mode: "string" }).notNull(),
  chatCount: integer("chat_count").notNull().default(0),
  songSearchCount: integer("song_search_count").notNull().default(0),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("usage_limits_anon_date_idx").on(table.anonymousId, table.limitDate),
]);

export const requestLogsTable = pgTable("request_logs", {
  id: text("id").primaryKey(),
  anonymousId: text("anonymous_id").notNull().references(() => anonymousSessionsTable.id, { onDelete: "cascade" }),
  requestType: text("request_type").notNull(),
  success: text("success").notNull().default("true"),
  tokenUsage: integer("token_usage"),
  errorType: text("error_type"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("request_logs_anon_idx").on(table.anonymousId),
  index("request_logs_time_idx").on(table.createdAt),
]);

export const rateLimitEntriesTable = pgTable("rate_limit_entries", {
  id: text("id").primaryKey(),
  anonymousId: text("anonymous_id").notNull().references(() => anonymousSessionsTable.id, { onDelete: "cascade" }),
  windowStart: timestamp("window_start", { withTimezone: true }).notNull(),
  requestCount: integer("request_count").notNull().default(1),
}, (table) => [
  index("rate_limit_window_idx").on(table.anonymousId, table.windowStart),
]);

export const insertAnonymousSessionSchema = createInsertSchema(anonymousSessionsTable).omit({ id: true, createdAt: true, lastActiveAt: true });
export type InsertAnonymousSession = z.infer<typeof insertAnonymousSessionSchema>;
export type AnonymousSession = typeof anonymousSessionsTable.$inferSelect;

export const insertUsageLimitSchema = createInsertSchema(usageLimitsTable).omit({ id: true, updatedAt: true });
export type InsertUsageLimit = z.infer<typeof insertUsageLimitSchema>;
export type UsageLimit = typeof usageLimitsTable.$inferSelect;

export const insertRequestLogSchema = createInsertSchema(requestLogsTable).omit({ id: true, createdAt: true });
export type InsertRequestLog = z.infer<typeof insertRequestLogSchema>;
export type RequestLog = typeof requestLogsTable.$inferSelect;

export const insertRateLimitEntrySchema = createInsertSchema(rateLimitEntriesTable).omit({ id: true });
export type InsertRateLimitEntry = z.infer<typeof insertRateLimitEntrySchema>;
export type RateLimitEntry = typeof rateLimitEntriesTable.$inferSelect;
