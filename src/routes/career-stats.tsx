import { convexQuery } from "@convex-dev/react-query";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { api } from "../../convex/_generated/api";

export const Route = createFileRoute("/career-stats")({
  loader: async ({ context: { queryClient } }) => {
    const statsQuery = convexQuery(api.stats.getMyCareerStats, {});
    if ((window as any).Clerk?.session) {
      await queryClient.ensureQueryData(statsQuery);
    }
  },
  component: CareerStatsPage,
});

function CareerStatsPage() {
  const statsQuery = convexQuery(api.stats.getMyCareerStats, {});
  const { data: stats } = useSuspenseQuery(statsQuery);

  const StatRow = ({ label, value }: { label: string; value: string | number }) => (
    <tr>
      <td className="font-medium">{label}</td>
      <td className="text-right">{value}</td>
    </tr>
  );

  return (
    <div>
      <h1>Career Statistics</h1>
      <p className="opacity-70 mb-6">Your performance across all ranked matches</p>

      {stats.matchesPlayed === 0 ? (
        <div className="not-prose p-8 bg-base-200 rounded-lg text-center">
          <p className="opacity-70">No ranked matches played yet</p>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Overall */}
          <div>
            <h2 className="mb-4">Overall</h2>
            <div className="overflow-x-auto not-prose">
              <table className="table table-zebra">
                <tbody>
                  <StatRow label="Sessions played" value={stats.sessionsPlayed} />
                  <StatRow label="Matches played" value={stats.matchesPlayed} />
                  <StatRow
                    label="Rank: Average Score per Match"
                    value={stats.rank ? `#${stats.rank}` : "Unranked"}
                  />
                </tbody>
              </table>
            </div>
          </div>

          {/* Reaching Nerts */}
          <div>
            <h2 className="mb-4">Reaching Nerts</h2>
            <div className="overflow-x-auto not-prose">
              <table className="table table-zebra">
                <tbody>
                  <StatRow label="Matches reached Nerts" value={stats.matchesReachedNerts} />
                  <StatRow
                    label="Fraction of matches reached Nerts"
                    value={stats.fractionReachedNerts.toFixed(3)}
                  />
                  <StatRow
                    label="Average # of players in matches"
                    value={stats.averagePlayersPerMatch.toFixed(2)}
                  />
                  <StatRow
                    label="Expected # of matches reaching Nerts"
                    value={stats.expectedMatchesReachingNerts.toFixed(2)}
                  />
                  <StatRow
                    label="How many times the random rate of reaching Nerts"
                    value={stats.timesRandomRate.toFixed(2)}
                  />
                </tbody>
              </table>
            </div>
          </div>

          {/* Score */}
          <div>
            <h2 className="mb-4">Score</h2>
            <div className="overflow-x-auto not-prose">
              <table className="table table-zebra">
                <tbody>
                  <StatRow label="Total score" value={stats.totalScore} />
                  <StatRow label="Average score per match" value={stats.averageScore.toFixed(2)} />
                  <StatRow label="25th percentile score per match" value={stats.percentile25} />
                  <StatRow label="Median score per match" value={stats.median} />
                  <StatRow label="75th percentile score per match" value={stats.percentile75} />
                  <StatRow label="Standard deviation" value={stats.standardDeviation.toFixed(2)} />
                </tbody>
              </table>
            </div>
          </div>

          {/* Matchups */}
          <div>
            <h2 className="mb-4">Matchups</h2>
            <div className="overflow-x-auto not-prose">
              <table className="table table-zebra">
                <tbody>
                  <StatRow
                    label="Average Handicap"
                    value={`${stats.averageHandicap.toFixed(2)} cards`}
                  />
                  <StatRow
                    label="Average Average Opponent Handicap"
                    value={`${stats.averageOpponentHandicap.toFixed(2)} cards`}
                  />
                  <StatRow
                    label="Average Differential vs Average Average Handicap"
                    value={`${stats.averageDifferential > 0 ? "+" : ""}${stats.averageDifferential.toFixed(2)} cards`}
                  />
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
