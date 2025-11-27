import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

// The schema defines your data model for the database.
// For more information, see https://docs.convex.dev/database/schema
export default defineSchema({
  users: defineTable({
    clerkId: v.string(),
    name: v.optional(v.string()),
  }).index("by_clerkId", ["clerkId"]),

  // Player profiles with stats
  players: defineTable({
    userId: v.id("users"),
    gamesPlayed: v.number(),
    totalPoints: v.number(),
    wins: v.number(),
  }).index("by_userId", ["userId"]),

  // Game results
  games: defineTable({
    date: v.number(), // timestamp
    playerScores: v.array(
      v.object({
        playerId: v.id("users"),
        score: v.number(),
      })
    ),
    winnerId: v.optional(v.id("users")),
    rules: v.optional(v.string()), // JSON string or description
  }).index("by_date", ["date"]),

  // League settings (singleton pattern - should have only one document)
  leagueSettings: defineTable({
    name: v.string(),
    description: v.optional(v.string()),
    rules: v.string(), // JSON string with rule configurations
  }),

  // Session rule templates
  sessionRules: defineTable({
    name: v.string(),
    description: v.optional(v.string()),
    rules: v.string(), // JSON string with rule configurations
  }),
});
