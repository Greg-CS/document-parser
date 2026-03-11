"use client";

import React, { useState } from "react";
import { useAuth } from "@/components/providers/AuthProvider";

declare global {
  interface Window {
    ArrayAccountLogin?: {
      open: (config: {
        onSuccess: (data: { user_id: string; api_key: string }) => void;
        onError: (error: unknown) => void;
      }) => void;
    };
  }
}

interface ArrayLoginWithAuthProps {
  onSuccess?: () => void;
}

export function ArrayLoginWithAuth({ onSuccess }: ArrayLoginWithAuthProps) {
  const { login } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleArrayLogin = () => {
    if (!window.ArrayAccountLogin) {
      setError("Array Account Login not loaded. Please refresh the page.");
      return;
    }

    setIsLoading(true);
    setError(null);

    window.ArrayAccountLogin.open({
      onSuccess: async (data) => {
        try {
          // Login with Array credentials - this creates/updates user in DB
          await login(data.user_id, data.api_key);
          
          console.log("Successfully logged in with Array credentials");
          
          if (onSuccess) {
            onSuccess();
          }
        } catch (err) {
          const message = err instanceof Error ? err.message : "Login failed";
          setError(message);
          console.error("Login error:", err);
        } finally {
          setIsLoading(false);
        }
      },
      onError: (err) => {
        const message = err instanceof Error ? err.message : "Array login failed";
        setError(message);
        console.error("Array login error:", err);
        setIsLoading(false);
      },
    });
  };

  return (
    <div className="space-y-4">
      <button
        onClick={handleArrayLogin}
        disabled={isLoading}
        className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isLoading ? "Connecting..." : "Sign in with Array"}
      </button>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      <div className="text-center">
        <p className="text-xs text-slate-500">
          Sign in with your Array account to access credit reports
        </p>
      </div>
    </div>
  );
}
