import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { ConvexError } from "convex/values";

// Create a new user
export const createUser = mutation({
  args: {
    name: v.string(),
    gamertag: v.string(),
  },
  handler: async (ctx, args) => {
    // Check if gamertag already exists
    const existingUser = await ctx.db
      .query("users")
      .withIndex("by_gamertag", (q) => q.eq("gamertag", args.gamertag))
      .unique();

    if (existingUser) {
      throw new ConvexError("Gamertag already taken");
    }

    const userId = await ctx.db.insert("users", {
      name: args.name,
      gamertag: args.gamertag,
    });

    return userId;
  },
});

// Get user by ID
export const getUser = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.userId);
  },
});

// List all users
export const listUsers = query({
  args: {},
  handler: async (ctx) => {
    const users = await ctx.db.query("users").collect();
    return users;
  },
});
