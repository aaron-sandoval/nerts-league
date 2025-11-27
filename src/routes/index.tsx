import { SignInButton } from "@clerk/clerk-react";
import { convexQuery } from "@convex-dev/react-query";
import { useSuspenseQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Authenticated, Unauthenticated, useMutation as useConvexMutation } from "convex/react";
import { Trophy, Plus } from "lucide-react";
import { api } from "../../convex/_generated/api";
import { useState } from "react";
import { useForm } from "@tanstack/react-form";
import { z } from "zod";

const leaderboardQueryOptions = convexQuery(api.players.getLeaderboard, {});
const gamesQueryOptions = convexQuery(api.games.listGames, {});
const usersQueryOptions = convexQuery(api.users.listUsers, {});
const leagueSettingsQueryOptions = convexQuery(api.settings.getLeagueSettings, {});
const sessionRulesQueryOptions = convexQuery(api.settings.listSessionRules, {});

export const Route = createFileRoute("/")({
  loader: async ({ context: { queryClient } }) => {
    await queryClient.ensureQueryData(leaderboardQueryOptions);
    await queryClient.ensureQueryData(gamesQueryOptions);
  },
  component: HomePage,
});

function HomePage() {
  return (
    <div className="text-center">
      <div className="not-prose flex justify-center mb-4">
        <Trophy className="w-16 h-16 text-primary" />
      </div>
      <h1>Nerts League</h1>

      <Unauthenticated>
        <p>Sign in to view the leaderboard and record games.</p>
        <div className="not-prose mt-4">
          <SignInButton mode="modal">
            <button className="btn btn-primary btn-lg">Get Started</button>
          </SignInButton>
        </div>
      </Unauthenticated>

      <Authenticated>
        <LeagueContent />
      </Authenticated>
    </div>
  );
}

function LeagueContent() {
  const [activeTab, setActiveTab] = useState<"leaderboard" | "games" | "record">("leaderboard");

  return (
    <div className="not-prose mt-8">
      <div role="tablist" className="tabs tabs-border tabs-lg">
        <button
          role="tab"
          className={`tab ${activeTab === "leaderboard" ? "tab-active" : ""}`}
          onClick={() => setActiveTab("leaderboard")}
        >
          Leaderboard
        </button>
        <button
          role="tab"
          className={`tab ${activeTab === "games" ? "tab-active" : ""}`}
          onClick={() => setActiveTab("games")}
        >
          Recent Games
        </button>
        <button
          role="tab"
          className={`tab ${activeTab === "record" ? "tab-active" : ""}`}
          onClick={() => setActiveTab("record")}
        >
          Record Game
        </button>
      </div>

      <div className="mt-8">
        {activeTab === "leaderboard" && <Leaderboard />}
        {activeTab === "games" && <RecentGames />}
        {activeTab === "record" && <RecordGame />}
      </div>
    </div>
  );
}

function Leaderboard() {
  const { data: leaderboard } = useSuspenseQuery(leaderboardQueryOptions);

  if (leaderboard.length === 0) {
    return (
      <div className="p-8 bg-base-200 rounded-lg">
        <p className="opacity-70">No players yet. Record your first game to get started!</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="table">
        <thead>
          <tr>
            <th>Rank</th>
            <th>Player</th>
            <th>Games</th>
            <th>Wins</th>
            <th>Total Points</th>
            <th>Avg Points</th>
          </tr>
        </thead>
        <tbody>
          {leaderboard.map((player, index) => (
            <tr key={player._id}>
              <td>{index + 1}</td>
              <td>{player.name}</td>
              <td>{player.gamesPlayed}</td>
              <td>{player.wins}</td>
              <td>{player.totalPoints}</td>
              <td>{player.averagePoints.toFixed(1)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RecentGames() {
  const { data: games } = useSuspenseQuery(gamesQueryOptions);

  if (games.length === 0) {
    return (
      <div className="p-8 bg-base-200 rounded-lg">
        <p className="opacity-70">No games recorded yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {games.map((game) => (
        <div key={game._id} className="card card-border bg-base-200">
          <div className="card-body">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm opacity-70">
                  {new Date(game.date).toLocaleDateString()} at{" "}
                  {new Date(game.date).toLocaleTimeString()}
                </p>
                {game.winnerName && (
                  <p className="font-medium mt-1">
                    Winner: <span className="text-primary">{game.winnerName}</span>
                  </p>
                )}
              </div>
            </div>
            <div className="mt-4">
              <h3 className="text-sm font-medium mb-2">Scores:</h3>
              <div className="space-y-1">
                {game.playerScores.map((ps) => (
                  <div key={ps.playerId} className="flex justify-between">
                    <span>{ps.name}</span>
                    <span className="font-medium">{ps.score}</span>
                  </div>
                ))}
              </div>
            </div>
            {game.rules && (
              <div className="mt-2">
                <p className="text-sm opacity-70">Rules: {game.rules}</p>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function RecordGame() {
  const { data: users } = useSuspenseQuery(usersQueryOptions);
  const recordGame = useConvexMutation(api.games.recordGame);
  const [playerScores, setPlayerScores] = useState<Array<{ playerId: string; score: number }>>([
    { playerId: "", score: 0 },
  ]);
  const [rules, setRules] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const addPlayer = () => {
    setPlayerScores([...playerScores, { playerId: "", score: 0 }]);
  };

  const removePlayer = (index: number) => {
    setPlayerScores(playerScores.filter((_, i) => i !== index));
  };

  const updatePlayer = (index: number, field: "playerId" | "score", value: string | number) => {
    const updated = [...playerScores];
    updated[index] = { ...updated[index], [field]: value };
    setPlayerScores(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const validScores = playerScores
        .filter((ps) => ps.playerId && ps.score !== undefined)
        .map((ps) => ({
          playerId: ps.playerId as any,
          score: Number(ps.score),
        }));

      if (validScores.length === 0) {
        alert("Please add at least one player with a score");
        setIsSubmitting(false);
        return;
      }

      await recordGame({
        playerScores: validScores,
        rules: rules || undefined,
      });

      // Reset form
      setPlayerScores([{ playerId: "", score: 0 }]);
      setRules("");
      alert("Game recorded successfully!");
    } catch (error) {
      console.error("Failed to record game:", error);
      alert("Failed to record game. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="card card-border bg-base-200">
        <div className="card-body">
          <h2 className="card-title">Record New Game</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <h3 className="font-medium mb-2">Player Scores</h3>
              {playerScores.map((ps, index) => (
                <div key={index} className="flex gap-2 mb-2">
                  <select
                    className="select select-border flex-1"
                    value={ps.playerId}
                    onChange={(e) => updatePlayer(index, "playerId", e.target.value)}
                  >
                    <option value="">Select Player</option>
                    {users.map((user) => (
                      <option key={user._id} value={user._id}>
                        {user.name || "Unknown"}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    className="input input-border w-24"
                    placeholder="Score"
                    value={ps.score}
                    onChange={(e) => updatePlayer(index, "score", e.target.valueAsNumber || 0)}
                  />
                  {playerScores.length > 1 && (
                    <button
                      type="button"
                      className="btn btn-error"
                      onClick={() => removePlayer(index)}
                    >
                      Remove
                    </button>
                  )}
                </div>
              ))}
              <button type="button" className="btn btn-outline btn-sm mt-2" onClick={addPlayer}>
                <Plus className="w-4 h-4" /> Add Player
              </button>
            </div>

            <div>
              <label className="label">
                <span className="label-text">Rules (optional)</span>
              </label>
              <textarea
                className="textarea textarea-border w-full"
                placeholder="Describe any custom rules for this game"
                value={rules}
                onChange={(e) => setRules(e.target.value)}
                rows={3}
              />
            </div>

            <div className="card-actions justify-end">
              <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
                {isSubmitting ? "Recording..." : "Record Game"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
