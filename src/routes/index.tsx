import { Link, createFileRoute } from "@tanstack/react-router";
import { Trophy, PlayCircle, BarChart3 } from "lucide-react";

export const Route = createFileRoute("/")({
  component: HomePage,
});

function HomePage() {
  return (
    <div className="text-center">
      <div className="not-prose flex justify-center mb-4">
        <Trophy className="w-16 h-16 text-primary" />
      </div>
      <h1>Nerts League</h1>
      <p>Welcome to the Nerts League! Track sessions, record games, and view stats.</p>

      <div className="not-prose grid gap-6 md:grid-cols-2 lg:grid-cols-3 mt-8 max-w-4xl mx-auto">
        {/* Sessions Card */}
        <Link to="/sessions">
          <div className="card card-border bg-base-200 hover:bg-base-300 transition-colors cursor-pointer">
            <div className="card-body items-center text-center">
              <PlayCircle className="w-12 h-12 text-primary mb-2" />
              <h2 className="card-title mt-0">Sessions</h2>
              <p className="text-sm opacity-70">
                Create and manage Nerts sessions, record games, and track scores
              </p>
            </div>
          </div>
        </Link>

        {/* Career Stats Card */}
        <Link to="/career-stats">
          <div className="card card-border bg-base-200 hover:bg-base-300 transition-colors cursor-pointer">
            <div className="card-body items-center text-center">
              <BarChart3 className="w-12 h-12 text-primary mb-2" />
              <h2 className="card-title mt-0">Career Stats</h2>
              <p className="text-sm opacity-70">
                View lifetime statistics and rankings across all ranked games
              </p>
            </div>
          </div>
        </Link>
      </div>
    </div>
  );
}
