import { convexQuery } from "@convex-dev/react-query";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation } from "convex/react";
import { ArrowLeft, Plus, Save, Trophy, BarChart3 } from "lucide-react";
import { api } from "../../convex/_generated/api";
import { useState } from "react";
import { Id } from "../../convex/_generated/dataModel";

export const Route = createFileRoute("/session/$sessionId")({
  loader: async ({ context: { queryClient }, params }) => {
    const sessionDetailsQuery = convexQuery(api.sessions.getSessionDetails, {
      sessionId: params.sessionId as any,
    });
    if ((window as any).Clerk?.session) {
      await queryClient.ensureQueryData(sessionDetailsQuery);
    }
  },
  component: SessionPage,
});

function SessionPage() {
  const { sessionId } = Route.useParams();
  const sessionDetailsQuery = convexQuery(api.sessions.getSessionDetails, {
    sessionId: sessionId as any,
  });
  const { data: session } = useSuspenseQuery(sessionDetailsQuery);

  const [showScoreEntry, setShowScoreEntry] = useState(false);
  const [newGameScores, setNewGameScores] = useState<Record<string, number>>({});
  const [nertsPlayerId, setNertsPlayerId] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const recordGame = useMutation(api.sessionGames.recordSessionGame);
  const endSession = useMutation(api.sessions.endSession);

  // Initialize scores for new game
  const initializeNewGame = () => {
    const initialScores: Record<string, number> = {};
    session.participants.forEach((p) => {
      initialScores[p.userId] = 0;
    });
    setNewGameScores(initialScores);
    setNertsPlayerId("");
    setShowScoreEntry(true);
  };

  const handleRecordGame = async () => {
    const playerScores = Object.entries(newGameScores)
      .filter(([playerId, score]) => score !== undefined && score !== null)
      .map(([playerId, score]) => ({
        playerId: playerId as Id<"users">,
        score: Number(score),
      }));

    if (playerScores.length === 0) {
      alert("Please enter at least one score");
      return;
    }

    setIsSubmitting(true);
    try {
      await recordGame({
        sessionId: sessionId as any,
        playerScores,
        nertsPlayerId: nertsPlayerId ? (nertsPlayerId as any) : undefined,
      });

      setShowScoreEntry(false);
      setNewGameScores({});
      setNertsPlayerId("");
    } catch (error) {
      console.error("Failed to record game:", error);
      alert("Failed to record game. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEndSession = async () => {
    if (!confirm("Are you sure you want to end this session?")) {
      return;
    }

    try {
      await endSession({ sessionId: sessionId as any });
      alert("Session ended");
    } catch (error) {
      console.error("Failed to end session:", error);
      alert("Failed to end session");
    }
  };

  // Auto-select nerts player as highest scorer
  const autoSelectNertsPlayer = () => {
    let highestScore = -Infinity;
    let highestPlayerId = "";

    Object.entries(newGameScores).forEach(([playerId, score]) => {
      if (score > highestScore) {
        highestScore = score;
        highestPlayerId = playerId;
      }
    });

    if (highestPlayerId) {
      setNertsPlayerId(highestPlayerId);
    }
  };

  return (
    <div>
      {/* Header */}
      <div className="flex justify-between items-start mb-6">
        <div>
          <Link to="/sessions" className="btn btn-ghost btn-sm mb-2">
            <ArrowLeft className="w-4 h-4" /> Back to Sessions
          </Link>
          <h1 className="mt-0">{session.name || `Session ${sessionId.slice(-6)}`}</h1>
          <div className="flex gap-4 text-sm opacity-70 not-prose">
            <span>{session.isRanked ? "Ranked" : "Unranked"}</span>
            <span>{new Date(session.date).toLocaleDateString()}</span>
            <span>{session.participants.length} players</span>
          </div>
        </div>
        <div className="flex gap-2 not-prose">
          <Link to="/session/$sessionId/stats" params={{ sessionId }}>
            <button className="btn btn-outline btn-sm">
              <BarChart3 className="w-4 h-4" /> Stats
            </button>
          </Link>
          {session.isActive && (
            <>
              <button className="btn btn-primary btn-sm" onClick={initializeNewGame}>
                <Plus className="w-4 h-4" /> Record Game
              </button>
              <button className="btn btn-error btn-sm" onClick={handleEndSession}>
                End Session
              </button>
            </>
          )}
        </div>
      </div>

      {/* Current Nerts Pile Sizes */}
      {session.isActive && (
        <div className="card card-border bg-base-300 mb-6 not-prose">
          <div className="card-body">
            <h3 className="card-title text-sm">Current Nerts Pile Sizes</h3>
            <div className="flex flex-wrap gap-3">
              {session.participants.map((p) => (
                <div key={p.userId} className="badge badge-lg badge-primary gap-2">
                  <span>{p.name}:</span>
                  <span className="font-bold">{p.currentHandicap} cards</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Score Entry Modal */}
      {showScoreEntry && (
        <dialog open className="modal">
          <div className="modal-box max-w-2xl">
            <h3 className="font-bold text-lg mb-4">Record Game #{session.games.length + 1}</h3>

            <div className="space-y-4">
              {/* Score Inputs */}
              <div className="grid grid-cols-2 gap-4">
                {session.participants.map((p) => (
                  <div key={p.userId}>
                    <label className="label">
                      <span className="label-text">
                        {p.name} ({p.currentHandicap} cards)
                      </span>
                    </label>
                    <input
                      type="number"
                      className="input input-border w-full"
                      placeholder="Score"
                      value={newGameScores[p.userId] || ""}
                      onChange={(e) =>
                        setNewGameScores({
                          ...newGameScores,
                          [p.userId]: e.target.valueAsNumber || 0,
                        })
                      }
                    />
                  </div>
                ))}
              </div>

              {/* Nerts Player Selection */}
              <div>
                <label className="label">
                  <span className="label-text">Who reached Nerts? (ran out of cards)</span>
                </label>
                <select
                  className="select select-border w-full"
                  value={nertsPlayerId}
                  onChange={(e) => setNertsPlayerId(e.target.value)}
                >
                  <option value="">No one reached Nerts</option>
                  {session.participants.map((p) => (
                    <option key={p.userId} value={p.userId}>
                      {p.name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="btn btn-ghost btn-xs mt-2"
                  onClick={autoSelectNertsPlayer}
                >
                  Auto-select highest scorer
                </button>
              </div>
            </div>

            <div className="modal-action">
              <button
                className="btn"
                onClick={() => {
                  setShowScoreEntry(false);
                  setNewGameScores({});
                  setNertsPlayerId("");
                }}
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={handleRecordGame}
                disabled={isSubmitting}
              >
                <Save className="w-4 h-4" />
                {isSubmitting ? "Recording..." : "Record Game"}
              </button>
            </div>
          </div>
          <form method="dialog" className="modal-backdrop">
            <button
              onClick={() => {
                setShowScoreEntry(false);
                setNewGameScores({});
                setNertsPlayerId("");
              }}
            >
              close
            </button>
          </form>
        </dialog>
      )}

      {/* Games Table */}
      <div>
        <h2>Games</h2>
        {session.games.length === 0 ? (
          <div className="not-prose p-8 bg-base-200 rounded-lg text-center">
            <Trophy className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p className="opacity-70">No games recorded yet</p>
          </div>
        ) : (
          <div className="overflow-x-auto not-prose">
            <table className="table table-zebra">
              <thead>
                <tr>
                  <th>Game #</th>
                  <th>Date</th>
                  {session.participants.map((p) => (
                    <th key={p.userId}>{p.name}</th>
                  ))}
                  <th>Nerts</th>
                  <th>Winner</th>
                </tr>
              </thead>
              <tbody>
                {session.games.map((game) => (
                  <tr key={game._id}>
                    <td>{game.gameNumber}</td>
                    <td className="text-xs opacity-70">
                      {new Date(game.date).toLocaleTimeString()}
                    </td>
                    {session.participants.map((p) => {
                      const score = game.playerScores.find((ps) => ps.playerId === p.userId);
                      return (
                        <td key={p.userId} className="text-center">
                          {score ? (
                            <div>
                              <div className="font-bold">{score.score}</div>
                              <div className="text-xs opacity-50">({score.handicap} cards)</div>
                            </div>
                          ) : (
                            <span className="opacity-30">-</span>
                          )}
                        </td>
                      );
                    })}
                    <td>
                      {game.nertsPlayerName && (
                        <span className="badge badge-sm badge-success">{game.nertsPlayerName}</span>
                      )}
                    </td>
                    <td>
                      {game.winnerName && (
                        <span className="badge badge-sm badge-primary">{game.winnerName}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
