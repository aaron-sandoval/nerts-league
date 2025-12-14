import { convexQuery } from "@convex-dev/react-query";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import { ArrowLeft, Save, Trophy, BarChart3, Check, X, Pencil, UserPlus } from "lucide-react";
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
  const [selectedWinnerId, setSelectedWinnerId] = useState<string | null>(null);
  const [manuallySelectedWinner, setManuallySelectedWinner] = useState(false);
  const [editingGameId, setEditingGameId] = useState<string | null>(null);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const [playerOrder, setPlayerOrder] = useState<string[]>([]);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [showAddPlayer, setShowAddPlayer] = useState(false);

  const recordGame = useMutation(api.sessionGames.recordSessionGame);
  const updateGame = useMutation(api.sessionGames.updateGameScores);
  const endSession = useMutation(api.sessions.endSession);
  const addPlayer = useMutation(api.sessions.addPlayerToSession);
  const allUsers = useQuery(api.users.listUsers);

  // Initialize player order from session participants
  useEffect(() => {
    if (session && playerOrder.length === 0) {
      setPlayerOrder(session.participants.map((p) => p.userId));
    }
  }, [session, playerOrder.length]);

  // Get ordered participants based on custom order
  const orderedParticipants = playerOrder
    .map((userId) => session.participants.find((p) => p.userId === userId))
    .filter((p): p is NonNullable<typeof p> => p !== undefined);

  // Drag and drop handlers
  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;

    const newOrder = [...playerOrder];
    const draggedItem = newOrder[draggedIndex];
    newOrder.splice(draggedIndex, 1);
    newOrder.splice(index, 0, draggedItem);

    setPlayerOrder(newOrder);
    setDraggedIndex(index);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  // Initialize scores for new game
  const initializeNewGame = () => {
    const initialScores: Record<string, number | ""> = {};
    orderedParticipants.forEach((p) => {
      initialScores[p.userId] = "";
    });
    setNewGameScores(initialScores);
    setShowScoreEntry(true);
    setFocusedCell(0);
    setSelectedWinnerId(null);
    setManuallySelectedWinner(false);
    setEditingGameId(null);
  };

  // Initialize editing an existing game
  const initializeEditGame = (gameId: string) => {
    const game = session.games.find((g) => g._id === gameId);
    if (!game) return;

    const scores: Record<string, number | ""> = {};
    game.playerScores.forEach((ps) => {
      scores[ps.playerId] = ps.score;
    });
    setNewGameScores(scores);
    setShowScoreEntry(true);
    setEditingGameId(gameId);
    setFocusedCell(0);
    setSelectedWinnerId(game.winnerId || null);
    setManuallySelectedWinner(false);
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
      // Use selectedWinnerId if set, otherwise use auto-calculated winner
      const winnerId = selectedWinnerId || getWinner();
      const noWinner = selectedWinnerId === null;
      const nertsPlayerId = noWinner ? undefined : (selectedWinnerId || getNertsPlayer());

      if (editingGameId) {
        // Update existing game
        await updateGame({
          gameId: editingGameId as any,
          playerScores,
          nertsPlayerId: nertsPlayerId ? (nertsPlayerId as any) : undefined,
          noWinner: noWinner || undefined,
        });
      } else {
        // Create new game
        await recordGame({
          sessionId: sessionId as any,
          playerScores,
          nertsPlayerId: nertsPlayerId ? (nertsPlayerId as any) : undefined,
          noWinner: noWinner || undefined,
        });
      }

      setShowScoreEntry(false);
      setNewGameScores({});
      setFocusedCell(0);
      setSelectedWinnerId(null);
      setManuallySelectedWinner(false);
      setEditingGameId(null);
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

  const handleAddPlayer = async (userId: string) => {
    try {
      await addPlayer({
        sessionId: sessionId as any,
        playerId: userId as any,
      });
      setShowAddPlayer(false);
      // Add the new player to the end of the player order
      setPlayerOrder([...playerOrder, userId]);
    } catch (error) {
      console.error("Failed to add player:", error);
      alert("Failed to add player");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
    if (e.key === "ArrowRight" && index < orderedParticipants.length - 1) {
      e.preventDefault();
      setFocusedCell(index + 1);
    } else if (e.key === "ArrowLeft" && index > 0) {
      e.preventDefault();
      setFocusedCell(index - 1);
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (index < orderedParticipants.length - 1) {
        setFocusedCell(index + 1);
      } else {
        handleRecordGame();
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      setShowScoreEntry(false);
      setNewGameScores({});
      setFocusedCell(0);
      setSelectedWinnerId(null);
      setManuallySelectedWinner(false);
      setEditingGameId(null);
    }
  };

  // Focus the input when focusedCell changes
  useEffect(() => {
    if (showScoreEntry && inputRefs.current[focusedCell]) {
      inputRefs.current[focusedCell]?.focus();
      inputRefs.current[focusedCell]?.select();
    }
  }, [focusedCell, showScoreEntry]);

  // Auto-set winner when scores change (only if not manually set)
  useEffect(() => {
    if (showScoreEntry && !manuallySelectedWinner) {
      const autoWinner = getWinner();
      setSelectedWinnerId(autoWinner || null);
    }
  }, [newGameScores, showScoreEntry, manuallySelectedWinner]);

  // Get players with scores for the dropdown
  const playersWithScores = Object.entries(newGameScores)
    .filter(([_, score]) => score !== "" && !isNaN(Number(score)))
    .map(([playerId]) => playerId);

  const winnerId = selectedWinnerId;
  const nertsPlayerId = selectedWinnerId;

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
              <button className="btn btn-outline btn-sm" onClick={() => setShowAddPlayer(true)}>
                <UserPlus className="w-4 h-4" /> Add Player
              </button>
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
              {orderedParticipants.map((p) => (
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
              <thead className="sticky top-0 bg-base-100 z-10">
                <tr>
                  <th className="w-16">Game #</th>
                  <th className="w-24">Time</th>
                  {orderedParticipants.map((p, index) => (
                    <th
                      key={p.userId}
                      className="text-center min-w-24 cursor-move select-none"
                      draggable
                      onDragStart={() => handleDragStart(index)}
                      onDragOver={(e) => handleDragOver(e, index)}
                      onDragEnd={handleDragEnd}
                      style={{
                        opacity: draggedIndex === index ? 0.5 : 1,
                        transition: "opacity 0.2s",
                      }}
                    >
                      <div>{p.name}</div>
                      <div className="text-xs font-normal opacity-50">({p.currentHandicap} cards)</div>
                    </th>
                  ))}
                  <th className="w-32">Nerts</th>
                  <th className="w-24">Actions</th>
                </tr>
              </thead>
              <tbody>
                {/* New game entry row */}
                {showScoreEntry && (
                  <tr className="bg-primary bg-opacity-10">
                    <td className="font-bold">
                      {editingGameId
                        ? `#${session.games.find((g) => g._id === editingGameId)?.gameNumber || "?"}`
                        : `#${session.games.length + 1}`}
                    </td>
                    <td className="text-xs opacity-70">{editingGameId ? "Editing" : "Now"}</td>
                    {orderedParticipants.map((p, index) => (
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
                    <td className="text-center p-1">
                      <select
                        className="select select-sm select-border w-full max-w-32"
                        value={selectedWinnerId || ""}
                        onChange={(e) => {
                          setSelectedWinnerId(e.target.value || null);
                          setManuallySelectedWinner(true);
                        }}
                        disabled={isSubmitting}
                      >
                        <option value="">No winner</option>
                        {playersWithScores.map((playerId) => (
                          <option key={playerId} value={playerId}>
                            {session.participants.find((p) => p.userId === playerId)?.name}
                          </option>
                        ))}
                      </select>
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
                            setSelectedWinnerId(null);
                            setEditingGameId(null);
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
                {session.games.map((game) => {
                  const isEditing = editingGameId === game._id;
                  if (isEditing && showScoreEntry) return null; // Hide when editing this game

                  return (
                    <tr key={game._id}>
                      <td>#{game.gameNumber}</td>
                      <td className="text-xs opacity-70">
                        {new Date(game.date).toLocaleTimeString()}
                      </td>
                      {orderedParticipants.map((p) => {
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
                        {game.winnerName ? (
                          <span className="badge badge-sm badge-primary">{game.winnerName}</span>
                        ) : (
                          <span className="text-xs opacity-50">No winner</span>
                        )}
                      </td>
                      <td>
                        {session.isActive && !showScoreEntry && (
                          <button
                            className="btn btn-ghost btn-xs"
                            onClick={() => initializeEditGame(game._id)}
                            title="Edit game"
                          >
                            <Pencil className="w-3 h-3" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showScoreEntry && (
        <div className="not-prose mt-4 p-4 bg-base-200 rounded-lg">
          <p className="text-sm opacity-70">
            <strong>Keyboard shortcuts:</strong> Use <kbd className="kbd kbd-sm">←</kbd> and <kbd className="kbd kbd-sm">→</kbd> to navigate between cells,
            <kbd className="kbd kbd-sm">Enter</kbd> to save, <kbd className="kbd kbd-sm">Esc</kbd> to cancel.
            {editingGameId ? " Editing existing game." : " Recording new game."} Use the "Nerts" dropdown to select who reached Nerts (defaults to highest scorer).
          </p>
        </div>
      )}

      {/* Add Player Modal */}
      {showAddPlayer && (
        <dialog className="modal modal-open">
          <div className="modal-box">
            <h3 className="font-bold text-lg mb-4">Add Player to Session</h3>
            <div className="not-prose">
              {allUsers ? (
                <div className="space-y-2">
                  {allUsers
                    .filter((user) => !session.participants.some((p) => p.userId === user._id))
                    .map((user) => (
                      <button
                        key={user._id}
                        className="btn btn-outline w-full justify-start"
                        onClick={() => handleAddPlayer(user._id)}
                      >
                        <UserPlus className="w-4 h-4" />
                        {user.name}
                      </button>
                    ))}
                  {allUsers.filter((user) => !session.participants.some((p) => p.userId === user._id))
                    .length === 0 && (
                    <p className="text-center opacity-70 py-4">
                      No additional players available. All users are already in this session.
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-center opacity-70 py-4">Loading users...</p>
              )}
            </div>
            <div className="modal-action">
              <button className="btn btn-ghost" onClick={() => setShowAddPlayer(false)}>
                Cancel
              </button>
            </div>
          </div>
          <form method="dialog" className="modal-backdrop" onClick={() => setShowAddPlayer(false)}>
            <button>close</button>
          </form>
        </dialog>
      )}
    </div>
  );
}
