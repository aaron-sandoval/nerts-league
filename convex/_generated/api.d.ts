/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";
import type * as games from "../games.js";
import type * as players from "../players.js";
import type * as sessionGames from "../sessionGames.js";
import type * as sessions from "../sessions.js";
import type * as settings from "../settings.js";
import type * as stats from "../stats.js";
import type * as testingFunctions from "../testingFunctions.js";
import type * as users from "../users.js";

/**
 * A utility for referencing Convex functions in your app's API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
declare const fullApi: ApiFromModules<{
  games: typeof games;
  players: typeof players;
  sessionGames: typeof sessionGames;
  sessions: typeof sessions;
  settings: typeof settings;
  stats: typeof stats;
  testingFunctions: typeof testingFunctions;
  users: typeof users;
}>;
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;
