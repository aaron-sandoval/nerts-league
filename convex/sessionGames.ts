import { mutation } from "./_generated/server";
import { v } from "convex/values";
import { ConvexError } from "convex/values";
import { getCurrentUserOrCrash } from "./users";
import { Id } from "./_generated/dataModel";
import { DEFAULT_LEAGUE_RULES } from "./sessions";

// Record a game within a session
export const recordSessionGame = mutation({
  args: {
    sessionId: v.id("sessions"),
    playerScores: v.array(
      v.object({
        playerId: v.id("users"),
        score: v.number(),
      })
    ),
    nertsPlayerId: v.optional(v.id("users")), // Who reached Nerts (if any)
    noWinner: v.optional(v.boolean()), // If true, don't set a winner
  },
  handler: async (ctx, args) => {
    await getCurrentUserOrCrash(ctx);

    if (args.playerScores.length === 0) {
      throw new ConvexError("At least one player score is required");
    }

    const session = await ctx.db.get(args.sessionId);
    if (!session) {
      throw new ConvexError("Session not found");
    }

    if (!session.isActive) {
      throw new ConvexError("Cannot add games to an ended session");
    }

    // Parse session rules
    const rules = JSON.parse(session.rules);

    // Get current handicaps for all players
    const playerHandicaps = new Map<Id<"users">, number>();
    for (const ps of args.playerScores) {
      let playerData = await ctx.db
        .query("players")
        .withIndex("by_userId", (q) => q.eq("userId", ps.playerId))
        .unique();

      if (!playerData) {
        // Create player record if it doesn't exist
        const playerId = await ctx.db.insert("players", {
          userId: ps.playerId,
          currentHandicap: rules.startingHandicap || DEFAULT_LEAGUE_RULES.startingHandicap,
          gamesPlayed: 0,
          totalPoints: 0,
          wins: 0,
        });
        playerData = await ctx.db.get(playerId);
      }

      const handicap = playerData?.currentHandicap ?? (rules.startingHandicap || DEFAULT_LEAGUE_RULES.startingHandicap);
      playerHandicaps.set(ps.playerId, handicap);
    }

    // Apply Nerts bonus to the player who reached Nerts
    const adjustedScores = args.playerScores.map((ps) => {
      let adjustedScore = ps.score;
      if (args.nertsPlayerId && ps.playerId === args.nertsPlayerId) {
        adjustedScore += rules.nertsBonus || DEFAULT_LEAGUE_RULES.nertsBonus;
      }
      return {
        playerId: ps.playerId,
        score: adjustedScore,
        originalScore: ps.score,
        handicap: playerHandicaps.get(ps.playerId)!,
      };
    });

    // Determine winner (highest adjusted score) - unless noWinner is true
    let winnerId: Id<"users"> | undefined = undefined;
    if (!args.noWinner) {
      winnerId = adjustedScores[0].playerId;
      let highestScore = adjustedScores[0].score;

      for (const ps of adjustedScores) {
        if (ps.score > highestScore) {
          highestScore = ps.score;
          winnerId = ps.playerId;
        }
      }
    }

    // If no nertsPlayer was specified, default to the winner (or undefined if noWinner)
    const nertsPlayerId: Id<"users"> | undefined = args.nertsPlayerId || winnerId;

    // Get next game number
    const existingGames = await ctx.db
      .query("games")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .collect();

    const gameNumber = existingGames.length + 1;

    // Create game record
    const gameId = await ctx.db.insert("games", {
      sessionId: args.sessionId,
      gameNumber,
      date: Date.now(),
      playerScores: adjustedScores.map((ps) => ({
        playerId: ps.playerId,
        score: ps.score,
        handicap: ps.handicap,
      })),
      nertsPlayerId: nertsPlayerId as Id<"users"> | undefined,
      winnerId: winnerId as Id<"users"> | undefined,
    });

    // Update handicaps based on rules (only if session is ranked)
    if (session.isRanked) {
      await updateHandicapsAfterGame(ctx, adjustedScores, nertsPlayerId, winnerId, rules);
    }

    // Update legacy player stats (for both ranked and unranked)
    for (const ps of adjustedScores) {
      const playerData = await ctx.db
        .query("players")
        .withIndex("by_userId", (q) => q.eq("userId", ps.playerId))
        .unique();

      if (playerData) {
        await ctx.db.patch(playerData._id, {
          gamesPlayed: playerData.gamesPlayed + 1,
          totalPoints: playerData.totalPoints + ps.score,
          wins: ps.playerId === winnerId ? playerData.wins + 1 : playerData.wins,
        });
      }
    }

    return gameId;
  },
});

// Helper function to update handicaps after a game
async function updateHandicapsAfterGame(
  ctx: any,
  playerScores: Array<{
    playerId: any;
    score: number;
    originalScore: number;
    handicap: number;
  }>,
  nertsPlayerId: any,
  winnerId: any,
  rules: any
) {
  for (const ps of playerScores) {
    const playerData = await ctx.db
      .query("players")
      .withIndex("by_userId", (q: any) => q.eq("userId", ps.playerId))
      .unique();

    if (!playerData) continue;

    let newHandicap = playerData.currentHandicap ?? rules.startingHandicap;

    // Decrement handicap if score is <= handicapDecrementLimit
    if (ps.originalScore <= (rules.handicapDecrementLimit ?? 0)) {
      newHandicap = Math.max(newHandicap - 1, rules.minimumHandicap || DEFAULT_LEAGUE_RULES.minimumHandicap);
    }

    // Increment handicap for the player who should get it based on rules
    const playerShouldIncrement =
      rules.whoIncrementsHandicap === "nertsPlayer"
        ? ps.playerId === nertsPlayerId
        : ps.playerId === winnerId;

    if (playerShouldIncrement) {
      newHandicap = newHandicap + 1;
    }

    // Update the handicap
    await ctx.db.patch(playerData._id, {
      currentHandicap: newHandicap,
    });
  }
}

// Update a game's scores (for corrections)
export const updateGameScores = mutation({
  args: {
    gameId: v.id("games"),
    playerScores: v.array(
      v.object({
        playerId: v.id("users"),
        score: v.number(),
      })
    ),
    nertsPlayerId: v.optional(v.id("users")),
    noWinner: v.optional(v.boolean()), // If true, don't set a winner
  },
  handler: async (ctx, args) => {
    await getCurrentUserOrCrash(ctx);

    const game = await ctx.db.get(args.gameId);
    if (!game) {
      throw new ConvexError("Game not found");
    }

    if (!game.sessionId) {
      throw new ConvexError("Cannot update non-session games");
    }

    const session = await ctx.db.get(game.sessionId);
    if (!session) {
      throw new ConvexError("Session not found");
    }

    // Parse session rules
    const rules = JSON.parse(session.rules);

    // Keep the same handicaps as the original game
    const handicapsMap = new Map(
      game.playerScores.map((ps) => [ps.playerId, ps.handicap])
    );

    // Apply Nerts bonus
    const adjustedScores = args.playerScores.map((ps) => {
      let adjustedScore = ps.score;
      if (args.nertsPlayerId && ps.playerId === args.nertsPlayerId) {
        adjustedScore += rules.nertsBonus || DEFAULT_LEAGUE_RULES.nertsBonus;
      }
      return {
        playerId: ps.playerId,
        score: adjustedScore,
        handicap: handicapsMap.get(ps.playerId) || rules.startingHandicap,
      };
    });

    // Determine new winner - unless noWinner is true
    let winnerId: Id<"users"> | undefined = undefined;
    if (!args.noWinner) {
      winnerId = adjustedScores[0].playerId;
      let highestScore = adjustedScores[0].score;

      for (const ps of adjustedScores) {
        if (ps.score > highestScore) {
          highestScore = ps.score;
          winnerId = ps.playerId;
        }
      }
    }

    // Update the game
    await ctx.db.patch(args.gameId, {
      playerScores: adjustedScores,
      nertsPlayerId: (args.nertsPlayerId || winnerId) as Id<"users"> | undefined,
      winnerId: winnerId as Id<"users"> | undefined,
    });

    // TODO: Recalculate handicaps for all subsequent games in the session if ranked
    // This is complex and should be implemented carefully
  },
});
