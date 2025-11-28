import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

// The schema defines your data model for the database.
// For more information, see https://docs.convex.dev/database/schema
export default defineSchema({
  users: defineTable({
    clerkId: v.string(),
    name: v.optional(v.string()),
    gamertag: v.optional(v.string()),
  }).index("by_clerkId", ["clerkId"]),

  // Player profiles with stats and current handicap
  players: defineTable({
    userId: v.id("users"),
    currentHandicap: v.optional(v.number()), // Current size of Nerts pile (optional for backward compatibility)
    // Legacy stats - now calculated from games
    gamesPlayed: v.number(),
    totalPoints: v.number(),
    wins: v.number(),
  }).index("by_userId", ["userId"]),

  // Sessions: A sequence of games played together
  sessions: defineTable({
    name: v.optional(v.string()),
    date: v.number(), // timestamp when session started
    notes: v.optional(v.string()),
    isRanked: v.boolean(), // Does this session affect career stats and handicaps?
    isPublic: v.boolean(), // Can non-participants see this session?
    participantIds: v.array(v.id("users")), // Players who can participate
    createdBy: v.id("users"),
    isActive: v.boolean(), // Is the session still ongoing?
    // Rules for this session (JSON string)
    rules: v.string(),
  })
    .index("by_date", ["date"])
    .index("by_createdBy", ["createdBy"])
    .index("by_isActive", ["isActive"]),

  // Game results
  games: defineTable({
    sessionId: v.optional(v.id("sessions")), // Optional for backward compatibility
    gameNumber: v.optional(v.number()), // Game number within the session (1, 2, 3, ...)
    date: v.number(), // timestamp
    playerScores: v.array(
      v.object({
        playerId: v.id("users"),
        score: v.number(),
        handicap: v.optional(v.number()), // Size of Nerts pile at start of this game (optional for backward compatibility)
      })
    ),
    nertsPlayerId: v.optional(v.id("users")), // Player who reached Nerts (ran out of cards)
    winnerId: v.optional(v.id("users")), // Player with highest score (may differ from nertsPlayer)
    rules: v.optional(v.string()), // JSON string or description (for legacy games)
  })
    .index("by_date", ["date"])
    .index("by_sessionId", ["sessionId"]),

  // League settings (singleton pattern - should have only one document)
  leagueSettings: defineTable({
    name: v.string(),
    description: v.optional(v.string()),
    // Default rules for new sessions (JSON string)
    // Structure: { startingHandicap, handicapDecrementLimit, minimumHandicap, whoIncrementsHandicap, nertsBonus }
    rules: v.string(),
  }),

  // Session rule templates (deprecated - keeping for backward compatibility)
  sessionRules: defineTable({
    name: v.string(),
    description: v.optional(v.string()),
    rules: v.string(), // JSON string with rule configurations
  }),
});
