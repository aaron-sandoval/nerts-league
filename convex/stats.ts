import { query } from "./_generated/server";
import { v } from "convex/values";
import { ConvexError } from "convex/values";
import { getCurrentUserOrNull } from "./users";

// Calculate stats for a single session
export const getSessionStats = query({
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

    // Calculate stats for each participant
    const statsMap = new Map<string, {
      userId: string;
      gamesPlayed: number;
      totalScore: number;
      timesReachedNerts: number;
      totalHandicap: number;
      wins: number;
    }>();

    // Initialize stats for all participants
    for (const participantId of session.participantIds) {
      statsMap.set(participantId, {
        userId: participantId,
        gamesPlayed: 0,
        totalScore: 0,
        timesReachedNerts: 0,
        totalHandicap: 0,
        wins: 0,
      });
    }

    // Process each game
    for (const game of games) {
      for (const ps of game.playerScores) {
        const stats = statsMap.get(ps.playerId);
        if (stats) {
          stats.gamesPlayed++;
          stats.totalScore += ps.score;
          stats.totalHandicap += ps.handicap || 0;

          if (game.nertsPlayerId === ps.playerId) {
            stats.timesReachedNerts++;
          }

          if (game.winnerId === ps.playerId) {
            stats.wins++;
          }
        }
      }
    }

    // Convert to array and calculate averages
    const statsArray = await Promise.all(
      Array.from(statsMap.values()).map(async (stats) => {
        const userDoc = await ctx.db.get(stats.userId as any);
        const userName = userDoc && 'name' in userDoc ? userDoc.name : undefined;
        const userGamertag = userDoc && 'gamertag' in userDoc ? userDoc.gamertag : undefined;
        return {
          userId: stats.userId,
          name: userName || "Unknown",
          gamertag: userGamertag,
          gamesPlayed: stats.gamesPlayed,
          averageScore: stats.gamesPlayed > 0 ? stats.totalScore / stats.gamesPlayed : 0,
          timesReachedNerts: stats.timesReachedNerts,
          averageHandicap: stats.gamesPlayed > 0 ? stats.totalHandicap / stats.gamesPlayed : 0,
          wins: stats.wins,
        };
      })
    );

    // Sort by average score (descending) and add rank
    statsArray.sort((a, b) => {
      // Only rank players who have played at least one game
      if (a.gamesPlayed === 0 && b.gamesPlayed === 0) return 0;
      if (a.gamesPlayed === 0) return 1;
      if (b.gamesPlayed === 0) return -1;
      return b.averageScore - a.averageScore;
    });

    const rankedStats = statsArray.map((stats, index) => ({
      ...stats,
      rank: stats.gamesPlayed > 0 ? index + 1 : null,
    }));

    return rankedStats;
  },
});

// Calculate career stats (only ranked games)
export const getCareerStats = query({
  args: {},
  handler: async (ctx) => {
    // Get all ranked sessions
    const sessions = await ctx.db.query("sessions").collect();
    const rankedSessions = sessions.filter((s) => s.isRanked);

    // Get all games from ranked sessions
    const allGames: any[] = [];
    for (const session of rankedSessions) {
      const sessionGames = await ctx.db
        .query("games")
        .withIndex("by_sessionId", (q) => q.eq("sessionId", session._id))
        .collect();
      allGames.push(...sessionGames);
    }

    // Get all players
    const players = await ctx.db.query("players").collect();

    // Calculate stats for each player
    const statsMap = new Map<string, {
      userId: string;
      sessionsPlayed: Set<string>;
      gamesPlayed: number;
      totalScore: number;
      timesReachedNerts: number;
      totalHandicap: number;
      wins: number;
    }>();

    for (const player of players) {
      statsMap.set(player.userId, {
        userId: player.userId,
        sessionsPlayed: new Set(),
        gamesPlayed: 0,
        totalScore: 0,
        timesReachedNerts: 0,
        totalHandicap: 0,
        wins: 0,
      });
    }

    // Process each game
    for (const game of allGames) {
      for (const ps of game.playerScores) {
        let stats = statsMap.get(ps.playerId);
        if (!stats) {
          // Initialize if player doesn't have a record yet
          stats = {
            userId: ps.playerId,
            sessionsPlayed: new Set(),
            gamesPlayed: 0,
            totalScore: 0,
            timesReachedNerts: 0,
            totalHandicap: 0,
            wins: 0,
          };
          statsMap.set(ps.playerId, stats);
        }

        if (game.sessionId) {
          stats.sessionsPlayed.add(game.sessionId);
        }
        stats.gamesPlayed++;
        stats.totalScore += ps.score;
        stats.totalHandicap += ps.handicap || 0;

        if (game.nertsPlayerId === ps.playerId) {
          stats.timesReachedNerts++;
        }

        if (game.winnerId === ps.playerId) {
          stats.wins++;
        }
      }
    }

    // Convert to array and calculate averages
    const statsArray = await Promise.all(
      Array.from(statsMap.values()).map(async (stats) => {
        const userDoc = await ctx.db.get(stats.userId as any);
        const userName = userDoc && 'name' in userDoc ? userDoc.name : undefined;
        const userGamertag = userDoc && 'gamertag' in userDoc ? userDoc.gamertag : undefined;
        return {
          userId: stats.userId,
          name: userName || "Unknown",
          gamertag: userGamertag,
          sessionsPlayed: stats.sessionsPlayed.size,
          gamesPlayed: stats.gamesPlayed,
          averageScore: stats.gamesPlayed > 0 ? stats.totalScore / stats.gamesPlayed : 0,
          timesReachedNerts: stats.timesReachedNerts,
          averageHandicap: stats.gamesPlayed > 0 ? stats.totalHandicap / stats.gamesPlayed : 0,
          wins: stats.wins,
        };
      })
    );

    // Sort by average score (descending) and add rank
    statsArray.sort((a, b) => {
      if (a.gamesPlayed === 0 && b.gamesPlayed === 0) return 0;
      if (a.gamesPlayed === 0) return 1;
      if (b.gamesPlayed === 0) return -1;
      return b.averageScore - a.averageScore;
    });

    const rankedStats = statsArray.map((stats, index) => ({
      ...stats,
      rank: stats.gamesPlayed > 0 ? index + 1 : null,
    }));

    return rankedStats;
  },
});
