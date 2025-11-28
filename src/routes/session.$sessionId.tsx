import { convexQuery } from "@convex-dev/react-query";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation } from "convex/react";
import { ArrowLeft, Save, Trophy, BarChart3, Check, X } from "lucide-react";
import { api } from "../../convex/_generated/api";
import { useState, useRef, useEffect } from "react";
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
  const [newGameScores, setNewGameScores] = useState<Record<string, number | "">>({});
  const [focusedCell, setFocusedCell] = useState<number>(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const recordGame = useMutation(api.sessionGames.recordSessionGame);
  const endSession = useMutation(api.sessions.endSession);

  // Initialize scores for new game
  const initializeNewGame = () => {
    const initialScores: Record<string, number | ""> = {};
    session.participants.forEach((p) => {
      initialScores[p.userId] = "";
    });
    setNewGameScores(initialScores);
    setShowScoreEntry(true);
    setFocusedCell(0);
  };

  // Calculate winner (highest score)
  const getWinner = () => {
    let highestScore = -Infinity;
    let winnerId = "";

    Object.entries(newGameScores).forEach(([playerId, score]) => {
      const numScore = Number(score);
      if (!isNaN(numScore) && numScore > highestScore) {
        highestScore = numScore;
        winnerId = playerId;
      }
    });

    return winnerId;
  };

  // Calculate nerts player (highest score)
  const getNertsPlayer = () => {
    return getWinner();
  };

  const handleRecordGame = async () => {
    const playerScores = Object.entries(newGameScores)
      .filter(([_, score]) => score !== "" && !isNaN(Number(score)))
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
      const nertsPlayerId = getNertsPlayer();
      await recordGame({
        sessionId: sessionId as any,
        playerScores,
        nertsPlayerId: nertsPlayerId ? (nertsPlayerId as any) : undefined,
      });

      setShowScoreEntry(false);
      setNewGameScores({});
      setFocusedCell(0);
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

  const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
    if (e.key === "ArrowRight" && index < session.participants.length - 1) {
      e.preventDefault();
      setFocusedCell(index + 1);
    } else if (e.key === "ArrowLeft" && index > 0) {
      e.preventDefault();
      setFocusedCell(index - 1);
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (index < session.participants.length - 1) {
        setFocusedCell(index + 1);
      } else {
        handleRecordGame();
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      setShowScoreEntry(false);
      setNewGameScores({});
      setFocusedCell(0);
    }
  };

  // Focus the input when focusedCell changes
  useEffect(() => {
    if (showScoreEntry && inputRefs.current[focusedCell]) {
      inputRefs.current[focusedCell]?.focus();
      inputRefs.current[focusedCell]?.select();
    }
  }, [focusedCell, showScoreEntry]);

  const winnerId = getWinner();
  const nertsPlayerId = getNertsPlayer();

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
          {session.isActive && !showScoreEntry && (
            <>
              <button className="btn btn-primary btn-sm" onClick={initializeNewGame}>
                <Save className="w-4 h-4" /> Record New Game
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

      {/* Games Table */}
      <div>
        <h2>Games</h2>
        {session.games.length === 0 && !showScoreEntry ? (
          <div className="not-prose p-8 bg-base-200 rounded-lg text-center">
            <Trophy className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p className="opacity-70">No games recorded yet</p>
          </div>
        ) : (
          <div className="overflow-x-auto not-prose">
            <table className="table table-zebra">
              <thead>
                <tr>
                  <th className="w-16">Game #</th>
                  <th className="w-24">Time</th>
                  {session.participants.map((p) => (
                    <th key={p.userId} className="text-center min-w-24">
                      <div>{p.name}</div>
                      <div className="text-xs font-normal opacity-50">({p.currentHandicap} cards)</div>
                    </th>
                  ))}
                  <th className="w-24">Nerts</th>
                  <th className="w-24">Winner</th>
                  {showScoreEntry && <th className="w-24">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {/* New game entry row */}
                {showScoreEntry && (
                  <tr className="bg-primary bg-opacity-10">
                    <td className="font-bold">#{session.games.length + 1}</td>
                    <td className="text-xs opacity-70">Now</td>
                    {session.participants.map((p, index) => (
                      <td key={p.userId} className="text-center p-1">
                        <input
                          ref={(el) => {
                            inputRefs.current[index] = el;
                          }}
                          type="number"
                          className="input input-sm input-border w-full text-center font-bold"
                          placeholder="0"
                          value={newGameScores[p.userId] ?? ""}
                          onChange={(e) =>
                            setNewGameScores({
                              ...newGameScores,
                              [p.userId]: e.target.value === "" ? "" : e.target.valueAsNumber,
                            })
                          }
                          onKeyDown={(e) => handleKeyDown(e, index)}
                          onFocus={() => setFocusedCell(index)}
                          disabled={isSubmitting}
                        />
                      </td>
                    ))}
                    <td className="text-center">
                      {nertsPlayerId && (
                        <span className="badge badge-sm badge-success">
                          {session.participants.find((p) => p.userId === nertsPlayerId)?.name}
                        </span>
                      )}
                    </td>
                    <td className="text-center">
                      {winnerId && (
                        <span className="badge badge-sm badge-primary">
                          {session.participants.find((p) => p.userId === winnerId)?.name}
                        </span>
                      )}
                    </td>
                    <td>
                      <div className="flex gap-1">
                        <button
                          className="btn btn-success btn-xs"
                          onClick={handleRecordGame}
                          disabled={isSubmitting}
                          title="Save (Enter)"
                        >
                          <Check className="w-3 h-3" />
                        </button>
                        <button
                          className="btn btn-ghost btn-xs"
                          onClick={() => {
                            setShowScoreEntry(false);
                            setNewGameScores({});
                            setFocusedCell(0);
                          }}
                          disabled={isSubmitting}
                          title="Cancel (Esc)"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )}

                {/* Previous games */}
                {session.games.map((game) => (
                  <tr key={game._id}>
                    <td>#{game.gameNumber}</td>
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
                    <td className="text-center">
                      {game.nertsPlayerName && (
                        <span className="badge badge-sm badge-success">{game.nertsPlayerName}</span>
                      )}
                    </td>
                    <td className="text-center">
                      {game.winnerName && (
                        <span className="badge badge-sm badge-primary">{game.winnerName}</span>
                      )}
                    </td>
                    {showScoreEntry && <td></td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showScoreEntry && (
        <div className="not-prose mt-4 p-4 bg-base-200 rounded-lg">
          <p className="text-sm opacity-70">
            <strong>Keyboard shortcuts:</strong> Use <kbd className="kbd kbd-sm">←</kbd> and <kbd className="kbd kbd-sm">→</kbd> to navigate between cells,
            <kbd className="kbd kbd-sm">Enter</kbd> to save, <kbd className="kbd kbd-sm">Esc</kbd> to cancel
          </p>
        </div>
      )}
    </div>
  );
}
