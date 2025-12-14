import { convexQuery } from "@convex-dev/react-query";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { api } from "../../convex/_generated/api";
import { useState, useMemo } from "react";
import { ChevronUp, ChevronDown } from "lucide-react";

export const Route = createFileRoute("/career-stats")({
  loader: async ({ context: { queryClient } }) => {
    const statsQuery = convexQuery(api.stats.getCareerStats, {});
    await queryClient.ensureQueryData(statsQuery);
  },
  component: CareerStatsPage,
});

type SortDirection = "asc" | "desc";

function CareerStatsPage() {
  const statsQuery = convexQuery(api.stats.getCareerStats, {});
  const { data: allStats } = useSuspenseQuery(statsQuery);

  type SortKey = keyof (typeof allStats)[0];

  const [sortKey, setSortKey] = useState<SortKey>("rank");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

  // Filter players who have played at least one game
  const playersWithGames = useMemo(
    () => allStats.filter((player) => player.matchesPlayed > 0),
    [allStats]
  );

  // Sort players based on current sort key and direction
  const sortedPlayers = useMemo(() => {
    const sorted = [...playersWithGames].sort((a, b) => {
      const aVal = a[sortKey];
      const bVal = b[sortKey];

      // Handle null values (rank can be null)
      if (aVal === null && bVal === null) return 0;
      if (aVal === null) return 1;
      if (bVal === null) return -1;

      // Compare values
      if (typeof aVal === "number" && typeof bVal === "number") {
        return sortDirection === "asc" ? aVal - bVal : bVal - aVal;
      }
      if (typeof aVal === "string" && typeof bVal === "string") {
        return sortDirection === "asc"
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      }
      return 0;
    });
    return sorted;
  }, [playersWithGames, sortKey, sortDirection]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      // Toggle direction if same column
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      // New column, default to ascending
      setSortKey(key);
      setSortDirection("asc");
    }
  };

  const SortableHeader = ({
    label,
    sortKey: key,
    align = "left",
  }: {
    label: string;
    sortKey: SortKey;
    align?: "left" | "right";
  }) => (
    <th
      className={`cursor-pointer hover:bg-base-300 select-none ${align === "right" ? "text-right" : ""}`}
      onClick={() => handleSort(key)}
    >
      <div className={`flex items-center gap-1 ${align === "right" ? "justify-end" : ""}`}>
        <span>{label}</span>
        <div className="flex flex-col opacity-50">
          <ChevronUp
            className={`w-3 h-3 -mb-1 ${sortKey === key && sortDirection === "asc" ? "opacity-100" : "opacity-30"}`}
          />
          <ChevronDown
            className={`w-3 h-3 -mt-1 ${sortKey === key && sortDirection === "desc" ? "opacity-100" : "opacity-30"}`}
          />
        </div>
      </div>
    </th>
  );

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
          <table className="table table-zebra table-xs">
            <thead>
              <tr>
                <SortableHeader label="Rank" sortKey="rank" />
                <SortableHeader label="Player" sortKey="name" />
                <SortableHeader label="Sessions" sortKey="sessionsPlayed" align="right" />
                <SortableHeader label="Matches" sortKey="matchesPlayed" align="right" />
                <SortableHeader label="Matches Reached Nerts" sortKey="matchesReachedNerts" align="right" />
                <SortableHeader label="Fraction Reached Nerts" sortKey="fractionReachedNerts" align="right" />
                <SortableHeader label="Avg Players/Match" sortKey="averagePlayersPerMatch" align="right" />
                <SortableHeader label="Expected Nerts" sortKey="expectedMatchesReachingNerts" align="right" />
                <SortableHeader label="Times Random Rate" sortKey="timesRandomRate" align="right" />
                <SortableHeader label="Total Score" sortKey="totalScore" align="right" />
                <SortableHeader label="Avg Score" sortKey="averageScore" align="right" />
                <SortableHeader label="25th %ile" sortKey="percentile25" align="right" />
                <SortableHeader label="Median" sortKey="median" align="right" />
                <SortableHeader label="75th %ile" sortKey="percentile75" align="right" />
                <SortableHeader label="Std Dev" sortKey="standardDeviation" align="right" />
                <SortableHeader label="Avg Handicap" sortKey="averageHandicap" align="right" />
                <SortableHeader label="Avg Opp Handicap" sortKey="averageOpponentHandicap" align="right" />
                <SortableHeader label="Differential" sortKey="averageDifferential" align="right" />
                <SortableHeader label="Wins" sortKey="wins" align="right" />
              </tr>
            </thead>
            <tbody>
              {sortedPlayers.map((player) => (
                <tr key={player.userId}>
                  <td className="font-semibold">
                    {player.rank ? `#${player.rank}` : "-"}
                  </td>
                  <td className="font-medium whitespace-nowrap">
                    {player.gamertag || player.name}
                  </td>
                  <td className="text-right">{player.sessionsPlayed}</td>
                  <td className="text-right">{player.matchesPlayed}</td>
                  <td className="text-right">{player.matchesReachedNerts}</td>
                  <td className="text-right">{player.fractionReachedNerts.toFixed(3)}</td>
                  <td className="text-right">{player.averagePlayersPerMatch.toFixed(2)}</td>
                  <td className="text-right">{player.expectedMatchesReachingNerts.toFixed(2)}</td>
                  <td className="text-right">{player.timesRandomRate.toFixed(2)}</td>
                  <td className="text-right">{player.totalScore}</td>
                  <td className="text-right">{player.averageScore.toFixed(1)}</td>
                  <td className="text-right">{player.percentile25}</td>
                  <td className="text-right">{player.median}</td>
                  <td className="text-right">{player.percentile75}</td>
                  <td className="text-right">{player.standardDeviation.toFixed(2)}</td>
                  <td className="text-right">{player.averageHandicap.toFixed(1)}</td>
                  <td className="text-right">{player.averageOpponentHandicap.toFixed(1)}</td>
                  <td className="text-right">{player.averageDifferential > 0 ? "+" : ""}{player.averageDifferential.toFixed(1)}</td>
                  <td className="text-right">{player.wins}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
