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

// Helper function to calculate career stats for all players
async function calculateAllCareerStats(ctx: any) {
  // Get all ranked sessions
  const sessions = await ctx.db.query("sessions").collect();
  const rankedSessions = sessions.filter((s: any) => s.isRanked);

  // Get all games from ranked sessions
  const allGames: any[] = [];
  for (const session of rankedSessions) {
    const sessionGames = await ctx.db
      .query("games")
      .withIndex("by_sessionId", (q: any) => q.eq("sessionId", session._id))
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
    scores: number[];
    handicaps: number[];
    timesReachedNerts: number;
    totalPlayersInGames: number;
    opponentHandicaps: number[];
    wins: number;
  }>();

  for (const player of players) {
    statsMap.set(player.userId, {
      userId: player.userId,
      sessionsPlayed: new Set(),
      gamesPlayed: 0,
      scores: [],
      handicaps: [],
      timesReachedNerts: 0,
      totalPlayersInGames: 0,
      opponentHandicaps: [],
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
          scores: [],
          handicaps: [],
          timesReachedNerts: 0,
          totalPlayersInGames: 0,
          opponentHandicaps: [],
          wins: 0,
        };
        statsMap.set(ps.playerId, stats);
      }

      if (game.sessionId) {
        stats.sessionsPlayed.add(game.sessionId);
      }
      stats.gamesPlayed++;
      stats.scores.push(ps.score);
      stats.handicaps.push(ps.handicap || 0);

      // Count total players in this game
      stats.totalPlayersInGames += game.playerScores.length;

      // Collect opponent handicaps (all players except this one)
      const opponentHandicapsInGame = game.playerScores
        .filter((otherPs: any) => otherPs.playerId !== ps.playerId)
        .map((otherPs: any) => otherPs.handicap || 0);

      if (opponentHandicapsInGame.length > 0) {
        const avgOpponentHandicap = opponentHandicapsInGame.reduce((a: number, b: number) => a + b, 0) / opponentHandicapsInGame.length;
        stats.opponentHandicaps.push(avgOpponentHandicap);
      }

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

      const matchesPlayed = stats.gamesPlayed;

      // Calculate basic stats
      const totalScore = stats.scores.reduce((a, b) => a + b, 0);
      const averageScore = matchesPlayed > 0 ? totalScore / matchesPlayed : 0;
      const averagePlayersPerMatch = matchesPlayed > 0 ? stats.totalPlayersInGames / matchesPlayed : 0;
      const expectedMatchesReachingNerts = averagePlayersPerMatch > 0 ? matchesPlayed / averagePlayersPerMatch : 0;
      const timesRandomRate = expectedMatchesReachingNerts > 0 ? stats.timesReachedNerts / expectedMatchesReachingNerts : 0;

      // Calculate percentiles
      const sortedScores = [...stats.scores].sort((a, b) => a - b);
      const percentile25 = matchesPlayed > 0 ? sortedScores[Math.floor(matchesPlayed * 0.25)] || 0 : 0;
      const median = matchesPlayed > 0 ? sortedScores[Math.floor(matchesPlayed * 0.5)] || 0 : 0;
      const percentile75 = matchesPlayed > 0 ? sortedScores[Math.floor(matchesPlayed * 0.75)] || 0 : 0;

      // Calculate standard deviation
      const variance = matchesPlayed > 0
        ? stats.scores.reduce((sum, score) => sum + Math.pow(score - averageScore, 2), 0) / matchesPlayed
        : 0;
      const standardDeviation = Math.sqrt(variance);

      // Calculate matchup stats
      const averageHandicap = matchesPlayed > 0
        ? stats.handicaps.reduce((a, b) => a + b, 0) / matchesPlayed
        : 0;
      const averageOpponentHandicap = stats.opponentHandicaps.length > 0
        ? stats.opponentHandicaps.reduce((a, b) => a + b, 0) / stats.opponentHandicaps.length
        : 0;
      const averageDifferential = averageHandicap - averageOpponentHandicap;

      return {
        userId: stats.userId,
        name: userName || "Unknown",
        gamertag: userGamertag,
        sessionsPlayed: stats.sessionsPlayed.size,
        matchesPlayed,
        matchesReachedNerts: stats.timesReachedNerts,
        fractionReachedNerts: matchesPlayed > 0 ? stats.timesReachedNerts / matchesPlayed : 0,
        averagePlayersPerMatch,
        expectedMatchesReachingNerts,
        timesRandomRate,
        totalScore,
        averageScore,
        percentile25,
        median,
        percentile75,
        standardDeviation,
        averageHandicap,
        averageOpponentHandicap,
        averageDifferential,
        wins: stats.wins,
      };
    })
  );

  // Sort by average score (descending) and add rank
  statsArray.sort((a, b) => {
    if (a.matchesPlayed === 0 && b.matchesPlayed === 0) return 0;
    if (a.matchesPlayed === 0) return 1;
    if (b.matchesPlayed === 0) return -1;
    return b.averageScore - a.averageScore;
  });

  const rankedStats = statsArray.map((stats, index) => ({
    ...stats,
    rank: stats.matchesPlayed > 0 ? index + 1 : null,
  }));

  return rankedStats;
}

// Calculate career stats (only ranked games)
export const getCareerStats = query({
  args: {},
  handler: async (ctx) => {
    return await calculateAllCareerStats(ctx);
  },
});

// Get detailed career stats for the current user
export const getMyCareerStats = query({
  args: {},
  handler: async (ctx) => {
    const currentUser = await getCurrentUserOrNull(ctx);
    if (!currentUser) {
      throw new ConvexError("Not authenticated");
    }

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

    // Collect data for this user
    const myScores: number[] = [];
    const myHandicaps: number[] = [];
    const sessionsPlayed = new Set<string>();
    let timesReachedNerts = 0;
    let totalPlayersInGames = 0;
    const opponentHandicaps: number[] = [];

    for (const game of allGames) {
      const myScore = game.playerScores.find((ps: any) => ps.playerId === currentUser._id);
      if (myScore) {
        myScores.push(myScore.score);
        myHandicaps.push(myScore.handicap || 0);
        if (game.sessionId) {
          sessionsPlayed.add(game.sessionId);
        }
        if (game.nertsPlayerId === currentUser._id) {
          timesReachedNerts++;
        }

        // Count total players in this game
        totalPlayersInGames += game.playerScores.length;

        // Collect opponent handicaps (all players except me)
        const opponentHandicapsInGame = game.playerScores
          .filter((ps: any) => ps.playerId !== currentUser._id)
          .map((ps: any) => ps.handicap || 0);

        if (opponentHandicapsInGame.length > 0) {
          const avgOpponentHandicap = opponentHandicapsInGame.reduce((a: number, b: number) => a + b, 0) / opponentHandicapsInGame.length;
          opponentHandicaps.push(avgOpponentHandicap);
        }
      }
    }

    const matchesPlayed = myScores.length;

    if (matchesPlayed === 0) {
      return {
        sessionsPlayed: 0,
        matchesPlayed: 0,
        rank: null,
        matchesReachedNerts: 0,
        fractionReachedNerts: 0,
        averagePlayersPerMatch: 0,
        expectedMatchesReachingNerts: 0,
        timesRandomRate: 0,
        totalScore: 0,
        averageScore: 0,
        percentile25: 0,
        median: 0,
        percentile75: 0,
        standardDeviation: 0,
        averageHandicap: 0,
        averageOpponentHandicap: 0,
        averageDifferential: 0,
      };
    }

    // Calculate Overall stats
    const totalScore = myScores.reduce((a, b) => a + b, 0);
    const averageScore = totalScore / matchesPlayed;
    const averagePlayersPerMatch = totalPlayersInGames / matchesPlayed;
    const expectedMatchesReachingNerts = matchesPlayed / averagePlayersPerMatch;
    const timesRandomRate = timesReachedNerts / expectedMatchesReachingNerts;

    // Calculate rank by getting all career stats and finding this user
    const allStats = await calculateAllCareerStats(ctx);
    const myRank = allStats.find((s) => s.userId === currentUser._id)?.rank || null;

    // Calculate percentiles
    const sortedScores = [...myScores].sort((a, b) => a - b);
    const percentile25 = sortedScores[Math.floor(matchesPlayed * 0.25)] || 0;
    const median = sortedScores[Math.floor(matchesPlayed * 0.5)] || 0;
    const percentile75 = sortedScores[Math.floor(matchesPlayed * 0.75)] || 0;

    // Calculate standard deviation
    const variance = myScores.reduce((sum, score) => sum + Math.pow(score - averageScore, 2), 0) / matchesPlayed;
    const standardDeviation = Math.sqrt(variance);

    // Calculate Matchup stats
    const averageHandicap = myHandicaps.reduce((a, b) => a + b, 0) / matchesPlayed;
    const averageOpponentHandicap = opponentHandicaps.length > 0
      ? opponentHandicaps.reduce((a, b) => a + b, 0) / opponentHandicaps.length
      : 0;
    const averageDifferential = averageHandicap - averageOpponentHandicap;

    return {
      // Overall
      sessionsPlayed: sessionsPlayed.size,
      matchesPlayed,
      rank: myRank,

      // Reaching Nerts
      matchesReachedNerts: timesReachedNerts,
      fractionReachedNerts: timesReachedNerts / matchesPlayed,
      averagePlayersPerMatch,
      expectedMatchesReachingNerts,
      timesRandomRate,

      // Score
      totalScore,
      averageScore,
      percentile25,
      median,
      percentile75,
      standardDeviation,

      // Matchups
      averageHandicap,
      averageOpponentHandicap,
      averageDifferential,
    };
  },
});
