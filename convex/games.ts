import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { ConvexError } from "convex/values";
import { getCurrentUserOrCrash } from "./users";

// Get all games, sorted by date (most recent first)
export const listGames = query({
  args: {},
  handler: async (ctx) => {
    const games = await ctx.db
      .query("games")
      .withIndex("by_date")
      .order("desc")
      .collect();

    // Enrich with player names
    const enrichedGames = await Promise.all(
      games.map(async (game) => {
        const playerScoresWithNames = await Promise.all(
          game.playerScores.map(async (ps) => {
            const user = await ctx.db.get(ps.playerId);
            return {
              ...ps,
              name: user?.name || "Unknown",
            };
          })
        );

        let winnerName = undefined;
        if (game.winnerId) {
          const winner = await ctx.db.get(game.winnerId);
          winnerName = winner?.name || "Unknown";
        }

        return {
          ...game,
          playerScores: playerScoresWithNames,
          winnerName,
        };
      })
    );

    return enrichedGames;
  },
});

// Get games for a specific player
export const getPlayerGames = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const allGames = await ctx.db
      .query("games")
      .withIndex("by_date")
      .order("desc")
      .collect();

    // Filter games where the user participated
    const playerGames = allGames.filter((game) =>
      game.playerScores.some((ps) => ps.playerId === args.userId)
    );

    return playerGames;
  },
});

// Record a new game result
export const recordGame = mutation({
  args: {
    playerScores: v.array(
      v.object({
        playerId: v.id("users"),
        score: v.number(),
      })
    ),
    rules: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await getCurrentUserOrCrash(ctx);

    if (args.playerScores.length === 0) {
      throw new ConvexError("At least one player score is required");
    }

    // Determine winner (highest score)
    let winnerId = args.playerScores[0].playerId;
    let highestScore = args.playerScores[0].score;

    for (const ps of args.playerScores) {
      if (ps.score > highestScore) {
        highestScore = ps.score;
        winnerId = ps.playerId;
      }
    }

    // Create game record
    const gameId = await ctx.db.insert("games", {
      date: Date.now(),
      playerScores: args.playerScores,
      winnerId,
      rules: args.rules,
    });

    // Update player stats
    for (const ps of args.playerScores) {
      const existingStats = await ctx.db
        .query("players")
        .withIndex("by_userId", (q) => q.eq("userId", ps.playerId))
        .unique();

      if (existingStats) {
        await ctx.db.patch(existingStats._id, {
          gamesPlayed: existingStats.gamesPlayed + 1,
          totalPoints: existingStats.totalPoints + ps.score,
          wins: ps.playerId === winnerId ? existingStats.wins + 1 : existingStats.wins,
        });
      } else {
        // Create new stats if they don't exist
        await ctx.db.insert("players", {
          userId: ps.playerId,
          gamesPlayed: 1,
          totalPoints: ps.score,
          wins: ps.playerId === winnerId ? 1 : 0,
        });
      }
    }

    return gameId;
  },
});
