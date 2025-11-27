import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { ConvexError } from "convex/values";
import { getCurrentUserOrCrash } from "./users";

// Get league settings (singleton)
export const getLeagueSettings = query({
  args: {},
  handler: async (ctx) => {
    const settings = await ctx.db.query("leagueSettings").first();
    return settings;
  },
});

// Update or create league settings
export const updateLeagueSettings = mutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
    rules: v.string(),
  },
  handler: async (ctx, args) => {
    await getCurrentUserOrCrash(ctx);

    const existingSettings = await ctx.db.query("leagueSettings").first();

    if (existingSettings) {
      await ctx.db.patch(existingSettings._id, {
        name: args.name,
        description: args.description,
        rules: args.rules,
      });
      return existingSettings._id;
    } else {
      const settingsId = await ctx.db.insert("leagueSettings", {
        name: args.name,
        description: args.description,
        rules: args.rules,
      });
      return settingsId;
    }
  },
});

// List all session rule templates
export const listSessionRules = query({
  args: {},
  handler: async (ctx) => {
    const rules = await ctx.db.query("sessionRules").collect();
    return rules;
  },
});

// Create a new session rule template
export const createSessionRule = mutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
    rules: v.string(),
  },
  handler: async (ctx, args) => {
    await getCurrentUserOrCrash(ctx);

    const ruleId = await ctx.db.insert("sessionRules", {
      name: args.name,
      description: args.description,
      rules: args.rules,
    });

    return ruleId;
  },
});

// Update a session rule template
export const updateSessionRule = mutation({
  args: {
    id: v.id("sessionRules"),
    name: v.string(),
    description: v.optional(v.string()),
    rules: v.string(),
  },
  handler: async (ctx, args) => {
    await getCurrentUserOrCrash(ctx);

    await ctx.db.patch(args.id, {
      name: args.name,
      description: args.description,
      rules: args.rules,
    });

    return args.id;
  },
});

// Delete a session rule template
export const deleteSessionRule = mutation({
  args: {
    id: v.id("sessionRules"),
  },
  handler: async (ctx, args) => {
    await getCurrentUserOrCrash(ctx);

    await ctx.db.delete(args.id);
  },
});
