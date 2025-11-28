import { SignInButton } from "@clerk/clerk-react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { Authenticated, Unauthenticated } from "convex/react";
import { Trophy, PlayCircle, BarChart3, Settings } from "lucide-react";

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

      <Unauthenticated>
        <p>Sign in to view sessions, record games, and track your stats.</p>
        <div className="not-prose mt-4">
          <SignInButton mode="modal">
            <button className="btn btn-primary btn-lg">Get Started</button>
          </SignInButton>
        </div>
      </Unauthenticated>

      <Authenticated>
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
                  View your lifetime statistics and rankings across all ranked games
                </p>
              </div>
            </div>
          </Link>

          {/* League Settings Card */}
          <Link to="/settings">
            <div className="card card-border bg-base-200 hover:bg-base-300 transition-colors cursor-pointer">
              <div className="card-body items-center text-center">
                <Settings className="w-12 h-12 text-primary mb-2" />
                <h2 className="card-title mt-0">League Settings</h2>
                <p className="text-sm opacity-70">
                  Configure league rules and default settings for sessions
                </p>
              </div>
            </div>
          </Link>
        </div>
      </Authenticated>
    </div>
  );
}
