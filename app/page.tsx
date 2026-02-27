"use client";

import { useState } from "react";
import { useAtomValue, useSetAtom } from "jotai";

import Dashboard from "@/components/organisms/Dashboard";
import { DevResponseSwitcher } from "@/components/molecules/DevResponseSwitcher";
import { Button } from "@/components/atoms/button";
import { Input } from "@/components/atoms/input";
import { Label } from "@/components/atoms/label";
import { cn } from "@/lib/utils";
import { getArrayMergePullURL } from "@/lib/array/array";
import { callArrayMergePull } from "@/lib/array/arrayclient";
import {
  creditReportRawAtom,
  creditReportLoadingAtom,
  creditReportErrorAtom,
  creditReportSourceAtom,
  hasArrayDataAtom,
} from "@/lib/store/credit-report-atoms";

export default function Home() {
  const hasArrayData = useAtomValue(hasArrayDataAtom);
  const creditLoading = useAtomValue(creditReportLoadingAtom);
  const creditError = useAtomValue(creditReportErrorAtom);

  const setCreditReportRaw = useSetAtom(creditReportRawAtom);
  const setCreditReportLoading = useSetAtom(creditReportLoadingAtom);
  const setCreditReportError = useSetAtom(creditReportErrorAtom);
  const setCreditReportSource = useSetAtom(creditReportSourceAtom);

  const [userName, setUserName] = useState("");
  const [password, setPassword] = useState("");
  const [responseMsg, setResponseMsg] = useState<string>("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreditReportLoading(true);
    setCreditReportError(null);
    setResponseMsg("Fetching credit report...");

    try {
      const url = getArrayMergePullURL(userName, password);
      const result = await callArrayMergePull(url);

      if (!result) {
        setCreditReportError("Empty response from Array API");
        setResponseMsg("Error: Empty response from Array API");
        return;
      }

      const parsed = JSON.parse(result) as Record<string, unknown>;
      setCreditReportRaw(parsed);
      setCreditReportSource("array");
      setResponseMsg("Report loaded!");
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      setCreditReportError(msg);
      setResponseMsg("Error: " + msg);
    } finally {
      setCreditReportLoading(false);
    }
  };

  const handleClearReport = () => {
    setCreditReportRaw(null);
    setCreditReportSource(null);
    setCreditReportError(null);
    setResponseMsg("");
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black flex items-center justify-center">
      <div className="mx-auto w-full max-w-6xl px-6 py-10">
        {!hasArrayData ? (
          <div className="mx-auto w-full max-w-lg rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="space-y-1">
              <h1 className="text-xl font-semibold text-slate-900">Connect to Array</h1>
              <p className="text-sm text-slate-500">Sign in to fetch your merged credit report.</p>
            </div>

            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="array-username">Username</Label>
                <Input
                  id="array-username"
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  autoComplete="username"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="array-password">Password</Label>
                <Input
                  id="array-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                />
              </div>

              <Button type="submit" className="w-full" disabled={creditLoading}>
                {creditLoading ? "Fetching report..." : "Fetch Credit Report"}
              </Button>

              {(creditError || responseMsg) && (
                <div
                  className={cn(
                    "rounded-lg border px-3 py-2 text-sm",
                    creditError
                      ? "border-red-200 bg-red-50 text-red-700"
                      : "border-green-200 bg-green-50 text-green-700"
                  )}
                >
                  {creditError ? creditError : responseMsg}
                </div>
              )}
            </form>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-end">
              <Button type="button" variant="outline" onClick={handleClearReport}>
                Disconnect
              </Button>
            </div>
            <Dashboard disableFileImport />
          </div>
        )}
      </div>
      <DevResponseSwitcher />
    </div>
  );
}
