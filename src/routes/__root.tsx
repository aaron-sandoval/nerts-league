import type { QueryClient } from "@tanstack/react-query";
import { QueryClientProvider } from "@tanstack/react-query";
import {
  Link,
  Outlet,
  createRootRouteWithContext,
} from "@tanstack/react-router";
import { ConvexProvider, ConvexReactClient } from "convex/react";
import { Menu, UserCircle, LogOut } from "lucide-react";
import { useState } from "react";
import { UserProvider, useCurrentUser } from "../lib/user-context";
import { UserSelection } from "../components/UserSelection";

export const Route = createRootRouteWithContext<{
  queryClient: QueryClient;
  convexClient: ConvexReactClient;
}>()({
  component: RootComponent,
});

function RootComponent() {
  const { queryClient, convexClient: convex } = Route.useRouteContext();

  return (
    <ConvexProvider client={convex}>
      <UserProvider>
        <QueryClientProvider client={queryClient}>
          <AppContent />
        </QueryClientProvider>
      </UserProvider>
    </ConvexProvider>
  );
}

function AppContent() {
  const { userId, setUserId } = useCurrentUser();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  const handleSwitchUser = () => {
    setUserId(null);
  };

  if (!userId) {
    return <UserSelection onUserSelected={setUserId} />;
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Mobile sidebar drawer */}
      <div className="drawer min-h-screen">
        <input
          id="drawer-toggle"
          type="checkbox"
          className="drawer-toggle"
          checked={isSidebarOpen}
          onChange={toggleSidebar}
        />
        <div className="drawer-content container mx-auto flex flex-col h-full">
          {/* Navbar */}
          <header className="navbar bg-base-100 shadow-sm border-b border-base-300">
            <div className="navbar-start">
              <label
                htmlFor="drawer-toggle"
                className="btn btn-square btn-ghost drawer-button lg:hidden mr-2"
              >
                <Menu className="w-5 h-5" />
              </label>
              <Link to="/" className="btn btn-ghost normal-case text-xl">
                Nerts League
              </Link>
            </div>
            <div className="navbar-center hidden lg:flex">
              <nav className="flex">
                <Link
                  to="/"
                  className="btn btn-ghost"
                  activeProps={{
                    className: "btn btn-ghost btn-active",
                  }}
                  onClick={() => setIsSidebarOpen(false)}
                >
                  Home
                </Link>
              </nav>
            </div>
            <div className="navbar-end">
              <div className="dropdown dropdown-end">
                <label tabIndex={0} className="btn btn-ghost btn-circle">
                  <UserCircle className="w-6 h-6" />
                </label>
                <ul
                  tabIndex={0}
                  className="dropdown-content z-[1] menu p-2 shadow bg-base-200 rounded-box w-52"
                >
                  <li>
                    <button onClick={handleSwitchUser}>
                      <LogOut className="w-4 h-4" />
                      Switch User
                    </button>
                  </li>
                </ul>
              </div>
            </div>
          </header>
          {/* Main content */}
          <main className="flex-1 p-4 prose prose-invert max-w-none">
            <Outlet />
          </main>
          <footer className="footer footer-center p-4 text-base-content">
            <p>© {new Date().getFullYear()} Nerts League</p>
          </footer>
        </div>
        {/* Sidebar content for mobile */}
        <div className="drawer-side z-10">
          <label
            htmlFor="drawer-toggle"
            aria-label="close sidebar"
            className="drawer-overlay"
          ></label>
          <div className="menu p-4 w-64 min-h-full bg-base-200 text-base-content flex flex-col">
            <div className="flex-1">
              <div className="menu-title mb-4">Menu</div>
              <ul className="space-y-2">
                <li>
                  <Link
                    to="/"
                    onClick={() => setIsSidebarOpen(false)}
                    activeProps={{
                      className: "active",
                    }}
                    className="flex items-center p-2"
                  >
                    Home
                  </Link>
                </li>
              </ul>
            </div>
            <div className="mt-auto py-4 border-t border-base-300">
              <button
                onClick={handleSwitchUser}
                className="btn btn-outline btn-block"
              >
                <LogOut className="w-4 h-4" />
                Switch User
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
