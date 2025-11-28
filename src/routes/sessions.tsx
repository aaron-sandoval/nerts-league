import { convexQuery } from "@convex-dev/react-query";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Authenticated, useMutation } from "convex/react";
import { Plus, PlayCircle, Trophy } from "lucide-react";
import { api } from "../../convex/_generated/api";
import { useState } from "react";

const sessionsQueryOptions = convexQuery(api.sessions.listSessions, { includeEnded: false });
const usersQueryOptions = convexQuery(api.users.listUsers, {});

export const Route = createFileRoute("/sessions")({
  loader: async ({ context: { queryClient } }) => {
    if ((window as any).Clerk?.session) {
      await queryClient.ensureQueryData(sessionsQueryOptions);
      await queryClient.ensureQueryData(usersQueryOptions);
    }
  },
  component: SessionsPage,
});

function SessionsPage() {
  const { data: sessions } = useSuspenseQuery(sessionsQueryOptions);
  const { data: users } = useSuspenseQuery(usersQueryOptions);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const createSession = useMutation(api.sessions.createSession);

  const [sessionName, setSessionName] = useState("");
  const [isRanked, setIsRanked] = useState(true);
  const [isPublic, setIsPublic] = useState(false);
  const [selectedPlayers, setSelectedPlayers] = useState<string[]>([]);
  const [isCreating, setIsCreating] = useState(false);

  const handleCreateSession = async () => {
    if (selectedPlayers.length === 0) {
      alert("Please select at least one player");
      return;
    }

    setIsCreating(true);
    try {
      const sessionId = await createSession({
        name: sessionName || undefined,
        isRanked,
        isPublic: isRanked ? undefined : isPublic, // Ranked sessions are always public
        participantIds: selectedPlayers as any,
      });

      // Reset form
      setSessionName("");
      setSelectedPlayers([]);
      setShowCreateModal(false);

      alert("Session created successfully!");
    } catch (error) {
      console.error("Failed to create session:", error);
      alert("Failed to create session. Please try again.");
    } finally {
      setIsCreating(false);
    }
  };

  const togglePlayerSelection = (userId: string) => {
    setSelectedPlayers((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1>Sessions</h1>
        <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
          <Plus className="w-5 h-5" /> New Session
        </button>
      </div>

      {/* Active Sessions */}
      {sessions.filter((s) => s.isActive).length > 0 && (
        <div className="mb-8">
          <h2 className="mt-0">Active Sessions</h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 not-prose">
            {sessions
              .filter((s) => s.isActive)
              .map((session) => (
                <div key={session._id} className="card card-border bg-base-200">
                  <div className="card-body">
                    <h3 className="card-title">
                      {session.name || `Session ${session._id.slice(-6)}`}
                    </h3>
                    <div className="space-y-2 text-sm">
                      <p>
                        <span className="opacity-70">Type:</span>{" "}
                        <span className={session.isRanked ? "text-primary" : ""}>
                          {session.isRanked ? "Ranked" : "Unranked"}
                        </span>
                      </p>
                      <p>
                        <span className="opacity-70">Players:</span> {session.participantCount}
                      </p>
                      <p>
                        <span className="opacity-70">Created:</span>{" "}
                        {new Date(session.date).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="card-actions justify-end mt-4">
                      <Link to="/session/$sessionId" params={{ sessionId: session._id }}>
                        <button className="btn btn-primary btn-sm">
                          <PlayCircle className="w-4 h-4" /> Enter Session
                        </button>
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Past Sessions */}
      {sessions.filter((s) => !s.isActive).length > 0 && (
        <div>
          <h2>Past Sessions</h2>
          <div className="overflow-x-auto not-prose">
            <table className="table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Type</th>
                  <th>Players</th>
                  <th>Date</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {sessions
                  .filter((s) => !s.isActive)
                  .map((session) => (
                    <tr key={session._id}>
                      <td>{session.name || `Session ${session._id.slice(-6)}`}</td>
                      <td>{session.isRanked ? "Ranked" : "Unranked"}</td>
                      <td>{session.participantCount}</td>
                      <td>{new Date(session.date).toLocaleDateString()}</td>
                      <td>
                        <Link to="/session/$sessionId" params={{ sessionId: session._id }}>
                          <button className="btn btn-ghost btn-sm">View</button>
                        </Link>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {sessions.length === 0 && (
        <div className="not-prose p-8 bg-base-200 rounded-lg text-center">
          <Trophy className="w-16 h-16 mx-auto mb-4 opacity-50" />
          <p className="opacity-70">No sessions yet. Create your first session to get started!</p>
        </div>
      )}

      {/* Create Session Modal */}
      {showCreateModal && (
        <dialog open className="modal">
          <div className="modal-box max-w-2xl">
            <h3 className="font-bold text-lg mb-4">Create New Session</h3>

            <div className="space-y-4">
              {/* Session Name */}
              <div>
                <label className="label">
                  <span className="label-text">Session Name (optional)</span>
                </label>
                <input
                  type="text"
                  className="input input-border w-full"
                  placeholder="e.g., Friday Night Nerts"
                  value={sessionName}
                  onChange={(e) => setSessionName(e.target.value)}
                />
              </div>

              {/* Session Type */}
              <div>
                <label className="label">
                  <span className="label-text">Session Type</span>
                </label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="sessionType"
                      className="radio radio-primary"
                      checked={isRanked}
                      onChange={() => setIsRanked(true)}
                    />
                    <span>Ranked (affects stats & Nerts pile sizes)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="sessionType"
                      className="radio"
                      checked={!isRanked}
                      onChange={() => setIsRanked(false)}
                    />
                    <span>Unranked (practice)</span>
                  </label>
                </div>
              </div>

              {/* Privacy (only for unranked) */}
              {!isRanked && (
                <div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      className="checkbox checkbox-primary"
                      checked={isPublic}
                      onChange={(e) => setIsPublic(e.target.checked)}
                    />
                    <span>Make this session public (visible to all players)</span>
                  </label>
                </div>
              )}

              {/* Player Selection */}
              <div>
                <label className="label">
                  <span className="label-text">Select Players</span>
                </label>
                <div className="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto p-2 bg-base-200 rounded-lg">
                  {users.map((user) => (
                    <label
                      key={user._id}
                      className="flex items-center gap-2 cursor-pointer p-2 hover:bg-base-300 rounded"
                    >
                      <input
                        type="checkbox"
                        className="checkbox checkbox-sm checkbox-primary"
                        checked={selectedPlayers.includes(user._id)}
                        onChange={() => togglePlayerSelection(user._id)}
                      />
                      <span>{user.name || "Unknown"}</span>
                    </label>
                  ))}
                </div>
                <p className="text-sm opacity-70 mt-2">
                  {selectedPlayers.length} player(s) selected
                </p>
              </div>
            </div>

            <div className="modal-action">
              <button
                className="btn"
                onClick={() => {
                  setShowCreateModal(false);
                  setSessionName("");
                  setSelectedPlayers([]);
                }}
                disabled={isCreating}
              >
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={handleCreateSession}
                disabled={isCreating || selectedPlayers.length === 0}
              >
                {isCreating ? "Creating..." : "Create Session"}
              </button>
            </div>
          </div>
          <form method="dialog" className="modal-backdrop">
            <button onClick={() => setShowCreateModal(false)}>close</button>
          </form>
        </dialog>
      )}
    </div>
  );
}
