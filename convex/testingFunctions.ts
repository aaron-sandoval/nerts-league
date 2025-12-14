import { v } from "convex/values";
import { customMutation } from "convex-helpers/server/customFunctions";
import { mutation } from "./_generated/server";
import { DEFAULT_LEAGUE_RULES } from "./sessions";

const testingMutation = customMutation(mutation, {
  args: {},
  input: async (_ctx, _args) => {
    if (process.env.IS_TEST !== "true") {
      throw new Error("Calling a test-only function in non-test environment");
    }
    return { ctx: {}, args: {} };
  },
});

export const deleteTestUser = testingMutation({
  args: { name: v.string() },
  handler: async (ctx, { name }) => {
    const users = await ctx.db.query("users").collect();
    const user = users.find(u => u.name === name);
    if (user) {
      await ctx.db.delete(user._id);
    }
  },
});

export const createTestUser = testingMutation({
  args: { name: v.string(), gamertag: v.optional(v.string()) },
  handler: async (ctx, { name, gamertag }) => {
    const userId = await ctx.db.insert("users", {
      name,
      gamertag: gamertag || `test_${name.toLowerCase().replace(/\s+/g, "_")}_${Date.now()}`,
    });
    return userId;
  },
});

export const createTestSession = testingMutation({
  args: {
    name: v.optional(v.string()),
    notes: v.optional(v.string()),
    isRanked: v.boolean(),
    isPublic: v.optional(v.boolean()),
    participantIds: v.array(v.id("users")),
    createdBy: v.id("users"),
    rules: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const rules = args.rules || JSON.stringify(DEFAULT_LEAGUE_RULES);
    const isPublic = args.isRanked ? true : (args.isPublic ?? false);

    const sessionId = await ctx.db.insert("sessions", {
      name: args.name,
      date: Date.now(),
      notes: args.notes,
      isRanked: args.isRanked,
      isPublic,
      participantIds: args.participantIds,
      createdBy: args.createdBy,
      isActive: true,
      rules,
    });
    return sessionId;
  },
});
