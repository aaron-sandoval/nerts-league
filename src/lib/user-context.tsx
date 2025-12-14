import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { Id } from "../../convex/_generated/dataModel";

interface UserContextType {
  userId: Id<"users"> | null;
  setUserId: (userId: Id<"users"> | null) => void;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export function UserProvider({ children }: { children: ReactNode }) {
  const [userId, setUserIdState] = useState<Id<"users"> | null>(() => {
    const stored = localStorage.getItem("currentUserId");
    return stored as Id<"users"> | null;
  });

  const setUserId = (newUserId: Id<"users"> | null) => {
    setUserIdState(newUserId);
    if (newUserId) {
      localStorage.setItem("currentUserId", newUserId);
    } else {
      localStorage.removeItem("currentUserId");
    }
  };

  return (
    <UserContext.Provider value={{ userId, setUserId }}>
      {children}
    </UserContext.Provider>
  );
}

export function useCurrentUser() {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error("useCurrentUser must be used within a UserProvider");
  }
  return context;
}
