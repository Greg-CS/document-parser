"use client";

import React, { createContext, useContext, useState, useCallback, useEffect } from "react";

interface User {
  id: string;
  email: string;
  arrayUserId: string;
  arrayApiKey: string;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (arrayUserId: string, arrayApiKey: string, email?: string) => Promise<User>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load user from localStorage on mount
  useEffect(() => {
    const storedUser = localStorage.getItem("auth_user");
    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser));
      } catch (error) {
        console.error("Failed to parse stored user:", error);
        localStorage.removeItem("auth_user");
      }
    }
    setIsLoading(false);
  }, []);

  const login = useCallback(async (arrayUserId: string, arrayApiKey: string, email?: string) => {
    try {
      // Create or update user in database
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          arrayUserId,
          arrayApiKey,
          email: email || `${arrayUserId}@array.user`,
        }),
      });

      if (!response.ok) {
        throw new Error("Login failed");
      }

      const { user: dbUser } = await response.json();

      const userData: User = {
        id: dbUser.id,
        email: dbUser.email,
        arrayUserId: dbUser.arrayUserId,
        arrayApiKey: dbUser.arrayApiKey,
      };

      setUser(userData);
      localStorage.setItem("auth_user", JSON.stringify(userData));
      
      return userData;
    } catch (error) {
      console.error("Login error:", error);
      throw error;
    }
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    localStorage.removeItem("auth_user");
  }, []);

  const value: AuthContextType = {
    user,
    isAuthenticated: !!user,
    isLoading,
    login,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
