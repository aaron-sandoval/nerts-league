import { query } from "./_generated/server";
import { v } from "convex/values";

// Get player stats for a specific user
export const getPlayerStats = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const stats = await ctx.db
      .query("players")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .unique();

    if (!stats) {
      return {
        userId: args.userId,
        gamesPlayed: 0,
        totalPoints: 0,
        wins: 0,
        averagePoints: 0,
      };
    }

    return {
      ...stats,
      averagePoints: stats.gamesPlayed > 0 ? stats.totalPoints / stats.gamesPlayed : 0,
    };
  },
});

// Get all players with stats for leaderboard
export const getLeaderboard = query({
  args: {},
  handler: async (ctx) => {
    const players = await ctx.db.query("players").collect();
    const usersMap = new Map();

    // Fetch all user details
    for (const player of players) {
      const user = await ctx.db.get(player.userId);
      if (user) {
        usersMap.set(player.userId, user);
      }
    }

    // Combine player stats with user info
    const leaderboard = players
      .map((player) => {
        const user = usersMap.get(player.userId);
        return {
          ...player,
          name: user?.name || "Unknown",
          averagePoints: player.gamesPlayed > 0 ? player.totalPoints / player.gamesPlayed : 0,
        };
      })
      .sort((a, b) => b.totalPoints - a.totalPoints); // Sort by total points descending

    return leaderboard;
  },
});
