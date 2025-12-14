import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { UserPlus, Users } from "lucide-react";

interface UserSelectionProps {
  onUserSelected: (userId: Id<"users">) => void;
}

export function UserSelection({ onUserSelected }: UserSelectionProps) {
  const users = useQuery(api.users.listUsers);
  const createUser = useMutation(api.users.createUser);

  const [showNewUserForm, setShowNewUserForm] = useState(false);
  const [name, setName] = useState("");
  const [gamertag, setGamertag] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleSelectUser = (userId: Id<"users">) => {
    onUserSelected(userId);
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim() || !gamertag.trim()) {
      setError("Name and gamertag are required");
      return;
    }

    try {
      const userId = await createUser({ name: name.trim(), gamertag: gamertag.trim() });
      onUserSelected(userId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create user");
    }
  };

  if (showNewUserForm) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <div className="card card-border bg-base-200 w-full max-w-md">
          <div className="card-body">
            <div className="flex items-center gap-2 mb-4">
              <UserPlus className="w-6 h-6 text-primary" />
              <h2 className="card-title mt-0">Create New User</h2>
            </div>

            <form onSubmit={handleCreateUser} className="not-prose space-y-4">
              <div className="form-control w-full">
                <label className="label">
                  <span className="label-text">Name</span>
                </label>
                <input
                  type="text"
                  placeholder="Enter your name"
                  className="input input-bordered w-full"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoFocus
                />
              </div>

              <div className="form-control w-full">
                <label className="label">
                  <span className="label-text">Gamertag</span>
                </label>
                <input
                  type="text"
                  placeholder="Choose a unique gamertag"
                  className="input input-bordered w-full"
                  value={gamertag}
                  onChange={(e) => setGamertag(e.target.value)}
                />
              </div>

              {error && (
                <div className="alert alert-error">
                  <span>{error}</span>
                </div>
              )}

              <div className="flex gap-2">
                <button type="submit" className="btn btn-primary flex-1">
                  Create User
                </button>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => setShowNewUserForm(false)}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4">
      <div className="card card-border bg-base-200 w-full max-w-md">
        <div className="card-body">
          <div className="flex items-center gap-2 mb-4">
            <Users className="w-6 h-6 text-primary" />
            <h2 className="card-title mt-0">Select User</h2>
          </div>

          <p className="text-sm opacity-70 mb-4">
            Choose your profile or create a new one
          </p>

          {users === undefined ? (
            <div className="flex justify-center p-8">
              <span className="loading loading-spinner loading-lg"></span>
            </div>
          ) : users.length === 0 ? (
            <div className="text-center p-4">
              <p className="text-sm opacity-70 mb-4">No users yet</p>
              <button
                className="btn btn-primary"
                onClick={() => setShowNewUserForm(true)}
              >
                <UserPlus className="w-4 h-4" />
                Create First User
              </button>
            </div>
          ) : (
            <div className="not-prose space-y-4">
              <div className="menu bg-base-100 rounded-box max-h-96 overflow-y-auto">
                {users.map((user) => (
                  <li key={user._id}>
                    <button
                      onClick={() => handleSelectUser(user._id)}
                      className="flex flex-col items-start"
                    >
                      <span className="font-semibold">{user.name}</span>
                      <span className="text-xs opacity-70">@{user.gamertag}</span>
                    </button>
                  </li>
                ))}
              </div>

              <button
                className="btn btn-outline btn-block"
                onClick={() => setShowNewUserForm(true)}
              >
                <UserPlus className="w-4 h-4" />
                Create New User
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
