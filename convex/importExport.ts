import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { ConvexError } from "convex/values";
import { Id } from "./_generated/dataModel";

// Export all game data to CSV format
export const exportGameData = query({
  args: {},
  handler: async (ctx) => {
    // Get all users
    const users = await ctx.db.query("users").collect();

    // Get all sessions with games
    const sessions = await ctx.db.query("sessions").collect();

    // Get all games
    const games = await ctx.db.query("games").collect();

    // Filter games that have a sessionId
    const sessionGames = games.filter(g => g.sessionId);

    return {
      users,
      sessions,
      games: sessionGames,
    };
  },
});

// Import game data from parsed CSV
export const importGameData = mutation({
  args: {
    users: v.array(v.object({
      name: v.string(),
      gamertag: v.string(),
    })),
    sessions: v.array(v.object({
      sessionId: v.string(),
      name: v.optional(v.string()),
      date: v.number(),
      isRanked: v.boolean(),
      isPublic: v.boolean(),
      notes: v.optional(v.string()),
      rules: v.string(),
    })),
    games: v.array(v.object({
      sessionId: v.string(),
      gameNumber: v.number(),
      date: v.number(),
      playerScores: v.array(v.object({
        gamertag: v.string(),
        score: v.number(),
        handicap: v.number(),
      })),
      nertsPlayerGamertag: v.optional(v.string()),
      winnerGamertag: v.optional(v.string()),
    })),
    mode: v.union(v.literal("append"), v.literal("overwrite")),
  },
  handler: async (ctx, args) => {
    // Create a map of gamertag -> userId
    const gamertagToUserId = new Map<string, Id<"users">>();

    // First, ensure all users exist
    for (const userData of args.users) {
      // Check if user already exists
      const existingUser = await ctx.db
        .query("users")
        .withIndex("by_gamertag", (q) => q.eq("gamertag", userData.gamertag))
        .unique();

      if (existingUser) {
        gamertagToUserId.set(userData.gamertag, existingUser._id);
      } else {
        // Create new user
        const userId = await ctx.db.insert("users", {
          name: userData.name,
          gamertag: userData.gamertag,
        });
        gamertagToUserId.set(userData.gamertag, userId);
      }
    }

    // Map of imported sessionId -> actual sessionId
    const sessionIdMap = new Map<string, Id<"sessions">>();

    // Process sessions
    for (const sessionData of args.sessions) {
      if (args.mode === "overwrite") {
        // Check if session with same name and date exists
        const existingSessions = await ctx.db.query("sessions").collect();
        const matchingSession = existingSessions.find(s =>
          s.name === sessionData.name &&
          Math.abs(s.date - sessionData.date) < 86400000 // Within same day
        );

        if (matchingSession) {
          // Delete existing session and its games
          const existingGames = await ctx.db
            .query("games")
            .withIndex("by_sessionId", (q) => q.eq("sessionId", matchingSession._id))
            .collect();

          for (const game of existingGames) {
            await ctx.db.delete(game._id);
          }

          await ctx.db.delete(matchingSession._id);
        }
      } else {
        // Append mode: check if session already exists
        const existingSessions = await ctx.db.query("sessions").collect();
        const matchingSession = existingSessions.find(s =>
          s.name === sessionData.name &&
          Math.abs(s.date - sessionData.date) < 86400000
        );

        if (matchingSession) {
          // Skip this session, it already exists
          sessionIdMap.set(sessionData.sessionId, matchingSession._id);
          continue;
        }
      }

      // Get participant user IDs
      const participantGamertagsSet = new Set<string>();
      for (const game of args.games) {
        if (game.sessionId === sessionData.sessionId) {
          for (const ps of game.playerScores) {
            participantGamertagsSet.add(ps.gamertag);
          }
        }
      }

      const participantIds: Id<"users">[] = [];
      for (const gamertag of participantGamertagsSet) {
        const userId = gamertagToUserId.get(gamertag);
        if (userId) {
          participantIds.push(userId);
        }
      }

      // Find createdBy - use first participant or first user
      const createdBy = participantIds[0] || Array.from(gamertagToUserId.values())[0];

      if (!createdBy) {
        throw new ConvexError("No users found to set as session creator");
      }

      // Create session
      const newSessionId = await ctx.db.insert("sessions", {
        name: sessionData.name,
        date: sessionData.date,
        isRanked: sessionData.isRanked,
        isPublic: sessionData.isPublic,
        notes: sessionData.notes,
        participantIds,
        createdBy,
        isActive: false, // Imported sessions are marked as ended
        rules: sessionData.rules,
      });

      sessionIdMap.set(sessionData.sessionId, newSessionId);
    }

    // Process games
    let gamesImported = 0;
    for (const gameData of args.games) {
      const actualSessionId = sessionIdMap.get(gameData.sessionId);
      if (!actualSessionId) {
        // Session was skipped in append mode
        continue;
      }

      // Convert gamertags to user IDs
      const playerScores = gameData.playerScores.map(ps => {
        const userId = gamertagToUserId.get(ps.gamertag);
        if (!userId) {
          throw new ConvexError(`User not found for gamertag: ${ps.gamertag}`);
        }
        return {
          playerId: userId,
          score: ps.score,
          handicap: ps.handicap,
        };
      });

      let nertsPlayerId: Id<"users"> | undefined;
      if (gameData.nertsPlayerGamertag) {
        nertsPlayerId = gamertagToUserId.get(gameData.nertsPlayerGamertag);
      }

      let winnerId: Id<"users"> | undefined;
      if (gameData.winnerGamertag) {
        winnerId = gamertagToUserId.get(gameData.winnerGamertag);
      }

      // Create game
      await ctx.db.insert("games", {
        sessionId: actualSessionId,
        gameNumber: gameData.gameNumber,
        date: gameData.date,
        playerScores,
        nertsPlayerId,
        winnerId,
      });

      gamesImported++;
    }

    return {
      usersCreated: args.users.length - Array.from(gamertagToUserId.values()).length,
      sessionsCreated: sessionIdMap.size,
      gamesImported,
    };
  },
});
