import { convexQuery } from "@convex-dev/react-query";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { api } from "../../convex/_generated/api";

export const Route = createFileRoute("/session/$sessionId/stats")({
  loader: async ({ context: { queryClient }, params }) => {
    const statsQuery = convexQuery(api.stats.getSessionStats, {
      sessionId: params.sessionId as any,
    });
    if ((window as any).Clerk?.session) {
      await queryClient.ensureQueryData(statsQuery);
    }
  },
  component: SessionStatsPage,
});

function SessionStatsPage() {
  const { sessionId } = Route.useParams();
  const statsQuery = convexQuery(api.stats.getSessionStats, { sessionId: sessionId as any });
  const { data: stats } = useSuspenseQuery(statsQuery);

  return (
    <div>
      <Link to="/session/$sessionId" params={{ sessionId }} className="btn btn-ghost btn-sm mb-4">
        <ArrowLeft className="w-4 h-4" /> Back to Session
      </Link>

      <h1>Session Statistics</h1>

      <div className="overflow-x-auto not-prose">
        <table className="table">
          <thead>
            <tr>
              <th>Rank</th>
              <th>Player</th>
              <th>Games Played</th>
              <th>Average Score</th>
              <th>Times Reached Nerts</th>
              <th>Average Nerts Pile</th>
              <th>Wins</th>
            </tr>
          </thead>
          <tbody>
            {stats.map((playerStats) => (
              <tr key={playerStats.userId}>
                <td>
                  {playerStats.rank !== null ? (
                    <span className="badge badge-primary">{playerStats.rank}</span>
                  ) : (
                    <span className="opacity-30">-</span>
                  )}
                </td>
                <td>
                  <div>
                    <div className="font-bold">{playerStats.name}</div>
                    {playerStats.gamertag && (
                      <div className="text-sm opacity-50">@{playerStats.gamertag}</div>
                    )}
                  </div>
                </td>
                <td>{playerStats.gamesPlayed}</td>
                <td>
                  {playerStats.gamesPlayed > 0 ? (
                    <span className="font-bold">{playerStats.averageScore.toFixed(1)}</span>
                  ) : (
                    <span className="opacity-30">-</span>
                  )}
                </td>
                <td>{playerStats.timesReachedNerts}</td>
                <td>
                  {playerStats.gamesPlayed > 0 ? (
                    <span>{playerStats.averageHandicap.toFixed(1)} cards</span>
                  ) : (
                    <span className="opacity-30">-</span>
                  )}
                </td>
                <td>{playerStats.wins}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {stats.every((s) => s.gamesPlayed === 0) && (
        <div className="not-prose p-8 bg-base-200 rounded-lg text-center mt-4">
          <p className="opacity-70">No games played yet in this session</p>
        </div>
      )}
    </div>
  );
}
