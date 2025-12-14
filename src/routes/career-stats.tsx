import { convexQuery } from "@convex-dev/react-query";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { api } from "../../convex/_generated/api";

export const Route = createFileRoute("/career-stats")({
  loader: async ({ context: { queryClient } }) => {
    const statsQuery = convexQuery(api.stats.getCareerStats, {});
    await queryClient.ensureQueryData(statsQuery);
  },
  component: CareerStatsPage,
});

function CareerStatsPage() {
  const statsQuery = convexQuery(api.stats.getCareerStats, {});
  const { data: allStats } = useSuspenseQuery(statsQuery);

  // Filter players who have played at least one game
  const playersWithGames = allStats.filter((player) => player.gamesPlayed > 0);

  return (
    <div>
      <h1>Career Statistics</h1>
      <p className="opacity-70 mb-6">Performance across all ranked matches</p>

      {playersWithGames.length === 0 ? (
        <div className="not-prose p-8 bg-base-200 rounded-lg text-center">
          <p className="opacity-70">No ranked matches played yet</p>
        </div>
      ) : (
        <div className="overflow-x-auto not-prose">
          <table className="table table-zebra table-sm">
            <thead>
              <tr>
                <th className="w-12">Rank</th>
                <th>Player</th>
                <th className="text-right">Sessions</th>
                <th className="text-right">Matches</th>
                <th className="text-right">Avg Score</th>
                <th className="text-right">Times Reached Nerts</th>
                <th className="text-right">Wins</th>
                <th className="text-right">Avg Handicap</th>
              </tr>
            </thead>
            <tbody>
              {playersWithGames.map((player) => (
                <tr key={player.userId}>
                  <td className="font-semibold">
                    {player.rank ? `#${player.rank}` : "-"}
                  </td>
                  <td className="font-medium">
                    {player.gamertag || player.name}
                  </td>
                  <td className="text-right">{player.sessionsPlayed}</td>
                  <td className="text-right">{player.gamesPlayed}</td>
                  <td className="text-right">{player.averageScore.toFixed(1)}</td>
                  <td className="text-right">{player.timesReachedNerts}</td>
                  <td className="text-right">{player.wins}</td>
                  <td className="text-right">{player.averageHandicap.toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
