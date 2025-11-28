import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { ConvexError } from "convex/values";
import { getCurrentUserOrCrash, getCurrentUserOrNull } from "./users";

// Default league rules
export const DEFAULT_LEAGUE_RULES = {
  startingHandicap: 13,
  handicapDecrementLimit: 0, // Decrement handicap if score <= this
  minimumHandicap: 3,
  whoIncrementsHandicap: "nertsPlayer", // "nertsPlayer" or "highestScore"
  nertsBonus: 5,
};

// Create a new session
export const createSession = mutation({
  args: {
    name: v.optional(v.string()),
    notes: v.optional(v.string()),
    isRanked: v.boolean(),
    isPublic: v.optional(v.boolean()), // For unranked sessions
    participantIds: v.array(v.id("users")),
    rules: v.optional(v.string()), // JSON string, uses league defaults if not provided
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUserOrCrash(ctx);
    if (!user) {
      throw new ConvexError("Not authenticated");
    }

    // Get league settings for default rules
    let rules = args.rules;
    if (!rules) {
      const leagueSettings = await ctx.db.query("leagueSettings").first();
      rules = leagueSettings?.rules || JSON.stringify(DEFAULT_LEAGUE_RULES);
    }

    // For ranked sessions, isPublic is always true
    const isPublic = args.isRanked ? true : (args.isPublic ?? false);

    const sessionId = await ctx.db.insert("sessions", {
      name: args.name,
      date: Date.now(),
      notes: args.notes,
      isRanked: args.isRanked,
      isPublic,
      participantIds: args.participantIds,
      createdBy: user._id,
      isActive: true,
      rules,
    });

    return sessionId;
  },
});

// Add a player to an existing session
export const addPlayerToSession = mutation({
  args: {
    sessionId: v.id("sessions"),
    playerId: v.id("users"),
  },
  handler: async (ctx, args) => {
    await getCurrentUserOrCrash(ctx);

    const session = await ctx.db.get(args.sessionId);
    if (!session) {
      throw new ConvexError("Session not found");
    }

    if (!session.isActive) {
      throw new ConvexError("Cannot add players to an ended session");
    }

    // Check if player is already a participant
    if (session.participantIds.includes(args.playerId)) {
      return; // Already a participant
    }

    await ctx.db.patch(args.sessionId, {
      participantIds: [...session.participantIds, args.playerId],
    });
  },
});

// End a session
export const endSession = mutation({
  args: {
    sessionId: v.id("sessions"),
  },
  handler: async (ctx, args) => {
    await getCurrentUserOrCrash(ctx);

    await ctx.db.patch(args.sessionId, {
      isActive: false,
    });
  },
});

// Get session details with all games
export const getSessionDetails = query({
  args: { sessionId: v.id("sessions") },
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUserOrNull(ctx);
    const session = await ctx.db.get(args.sessionId);

    if (!session) {
      throw new ConvexError("Session not found");
    }

    // Privacy check
    if (!session.isPublic) {
      if (!currentUser) {
        throw new ConvexError("Not authenticated");
      }
      if (!session.participantIds.includes(currentUser._id)) {
        throw new ConvexError("You do not have access to this session");
      }
    }

    // Get all games in this session
    const games = await ctx.db
      .query("games")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .collect();

    // Sort by game number
    games.sort((a, b) => (a.gameNumber || 0) - (b.gameNumber || 0));

    // Enrich games with player names
    const enrichedGames = await Promise.all(
      games.map(async (game) => {
        const playerScoresWithNames = await Promise.all(
          game.playerScores.map(async (ps) => {
            const user = await ctx.db.get(ps.playerId);
            return {
              ...ps,
              name: user?.name || "Unknown",
              gamertag: user?.gamertag,
            };
          })
        );

        let nertsPlayerName: string | undefined;
        if (game.nertsPlayerId) {
          const nertsPlayer = await ctx.db.get(game.nertsPlayerId);
          nertsPlayerName = nertsPlayer?.name || "Unknown";
        }

        let winnerName: string | undefined;
        if (game.winnerId) {
          const winner = await ctx.db.get(game.winnerId);
          winnerName = winner?.name || "Unknown";
        }

        return {
          ...game,
          playerScores: playerScoresWithNames,
          nertsPlayerName,
          winnerName,
        };
      })
    );

    // Get participant details
    const participants = await Promise.all(
      session.participantIds.map(async (userId) => {
        const user = await ctx.db.get(userId);
        const player = await ctx.db
          .query("players")
          .withIndex("by_userId", (q) => q.eq("userId", userId))
          .unique();

        return {
          userId,
          name: user?.name || "Unknown",
          gamertag: user?.gamertag,
          currentHandicap: player?.currentHandicap || DEFAULT_LEAGUE_RULES.startingHandicap,
        };
      })
    );

    return {
      ...session,
      games: enrichedGames,
      participants,
    };
  },
});

// List all sessions (with privacy filtering)
export const listSessions = query({
  args: {
    includeEnded: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUserOrNull(ctx);

    let sessions = await ctx.db
      .query("sessions")
      .withIndex("by_date")
      .order("desc")
      .collect();

    // Filter by active status if needed
    if (!args.includeEnded) {
      sessions = sessions.filter((s) => s.isActive);
    }

    // Privacy filtering
    sessions = sessions.filter((session) => {
      // Public sessions are visible to all
      if (session.isPublic) return true;

      // Private sessions only visible to participants
      if (currentUser && session.participantIds.includes(currentUser._id)) {
        return true;
      }

      return false;
    });

    // Enrich with participant count and creator name
    const enrichedSessions = await Promise.all(
      sessions.map(async (session) => {
        const creator = await ctx.db.get(session.createdBy);
        return {
          ...session,
          participantCount: session.participantIds.length,
          creatorName: creator?.name || "Unknown",
        };
      })
    );

    return enrichedSessions;
  },
});

// Get active session for current user
export const getActiveSession = query({
  args: {},
  handler: async (ctx) => {
    const currentUser = await getCurrentUserOrNull(ctx);
    if (!currentUser) {
      return null;
    }

    // Find active sessions where user is a participant
    const sessions = await ctx.db
      .query("sessions")
      .withIndex("by_isActive", (q) => q.eq("isActive", true))
      .collect();

    const userSession = sessions.find((s) => s.participantIds.includes(currentUser._id));

    return userSession?._id || null;
  },
});
