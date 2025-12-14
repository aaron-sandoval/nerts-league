import { internalMutation } from "./_generated/server";

// One-time migration to clear old users with clerkId
export const clearOldUsers = internalMutation({
  args: {},
  handler: async (ctx) => {
    const users = await ctx.db.query("users").collect();
    for (const user of users) {
      await ctx.db.delete(user._id);
    }
    return { deleted: users.length };
  },
});
