"use client";

import * as React from "react";
import { useAtomValue, useSetAtom } from "jotai";
import {
  creditReportRawAtom,
  creditReportSourceAtom,
} from "@/lib/store/credit-report-atoms";
import { Button } from "@/components/atoms/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/atoms/dialog";
import { Database, Trash2, Download, Save } from "lucide-react";
import { Badge } from "@/components/atoms/badge";

interface SavedResponse {
  id: string;
  filename: string;
  uploadedAt: string;
  parsedData: Record<string, unknown>;
}

export function DevResponseSwitcher() {
  const [open, setOpen] = React.useState(false);
  const [savedResponses, setSavedResponses] = React.useState<SavedResponse[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [saveLabel, setSaveLabel] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  const currentResponse = useAtomValue(creditReportRawAtom);
  const setCreditReportRaw = useSetAtom(creditReportRawAtom);
  const setCreditReportSource = useSetAtom(creditReportSourceAtom);

  const fetchSavedResponses = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/dev/array-responses");
      if (res.ok) {
        const data = await res.json();
        setSavedResponses(data.items || []);
      }
    } catch (error) {
      console.error("Failed to fetch saved responses:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch saved responses when modal opens
  React.useEffect(() => {
    if (open) {
      fetchSavedResponses();
    }
  }, [open, fetchSavedResponses]);

  // Only render in development
  if (process.env.NODE_ENV !== "development") {
    return null;
  }

  const handleSave = async () => {
    if (!saveLabel.trim() || !currentResponse) return;

    setSaving(true);
    try {
      const res = await fetch("/api/dev/array-responses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: saveLabel.trim(),
          data: currentResponse,
        }),
      });

      if (res.ok) {
        setSaveLabel("");
        await fetchSavedResponses();
      } else {
        const error = await res.json();
        console.error("Failed to save:", error);
      }
    } catch (error) {
      console.error("Failed to save response:", error);
    } finally {
      setSaving(false);
    }
  };

  const handleLoad = (response: SavedResponse) => {
    setCreditReportRaw(response.parsedData);
    setCreditReportSource("array");
    setOpen(false);
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/dev/array-responses?id=${id}`, {
        method: "DELETE",
      });

      if (res.ok) {
        await fetchSavedResponses();
      } else {
        const error = await res.json();
        console.error("Failed to delete:", error);
      }
    } catch (error) {
      console.error("Failed to delete response:", error);
    }
  };

  const getBorrowerName = (data: Record<string, unknown>) => {
    try {
      const cr = data["CREDIT_RESPONSE"];
      if (cr && typeof cr === "object") {
        const borrower = (cr as Record<string, unknown>)["BORROWER"];
        if (borrower && typeof borrower === "object") {
          const b = borrower as Record<string, unknown>;
          const firstName = b["@_FirstName"] || b["FirstName"];
          const lastName = b["@_LastName"] || b["LastName"];
          if (firstName || lastName) {
            return `${firstName || ""} ${lastName || ""}`.trim();
          }
        }
      }
    } catch {
      // ignore
    }
    return null;
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="fixed bottom-6 right-6 z-50 shadow-lg bg-purple-600 text-white hover:bg-purple-700 border-purple-700"
        >
          <Database className="w-4 h-4 mr-2" />
          Dev Responses
          {savedResponses.length > 0 && (
            <Badge className="ml-2 bg-purple-800 text-white">
              {savedResponses.length}
            </Badge>
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Saved Array Responses (Dev)</DialogTitle>
          <DialogDescription>
            Save and load Array API responses for testing when away from IP-whitelisted network
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Save Current Section */}
          <div className="rounded-lg border border-purple-200 bg-purple-50 p-4">
            <h3 className="text-sm font-semibold text-purple-900 mb-3 flex items-center gap-2">
              <Save className="w-4 h-4" />
              Save Current Response
            </h3>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Enter label (e.g., Test User 1)"
                value={saveLabel}
                onChange={(e) => setSaveLabel(e.target.value)}
                className="flex-1 px-3 py-2 rounded-md border border-purple-300 text-sm"
                disabled={!currentResponse}
              />
              <Button
                onClick={handleSave}
                disabled={!saveLabel.trim() || !currentResponse || saving}
                size="sm"
                className="bg-purple-600 hover:bg-purple-700"
              >
                {saving ? "Saving..." : "Save"}
              </Button>
            </div>
            {!currentResponse && (
              <p className="text-xs text-purple-600 mt-2">
                No Array response loaded. Login via /array-login first.
              </p>
            )}
          </div>

          {/* Saved Responses List */}
          <div>
            <h3 className="text-sm font-semibold text-slate-900 mb-3">
              Saved Responses ({savedResponses.length})
            </h3>
            {loading ? (
              <div className="text-center py-8 text-slate-500">Loading...</div>
            ) : savedResponses.length === 0 ? (
              <div className="text-center py-8 text-slate-500 border border-slate-200 rounded-lg bg-slate-50">
                No saved responses yet. Save one above to get started.
              </div>
            ) : (
              <div className="space-y-2">
                {savedResponses.map((response) => {
                  const borrowerName = getBorrowerName(response.parsedData);
                  const date = new Date(response.uploadedAt).toLocaleString();

                  return (
                    <div
                      key={response.id}
                      className="flex items-center justify-between p-3 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm text-slate-900 truncate">
                          {response.filename}
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5">
                          {borrowerName && (
                            <span className="mr-3">👤 {borrowerName}</span>
                          )}
                          <span>📅 {date}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 ml-4">
                        <Button
                          onClick={() => handleLoad(response)}
                          size="sm"
                          variant="outline"
                          className="text-purple-600 border-purple-300 hover:bg-purple-50"
                        >
                          <Download className="w-3 h-3 mr-1" />
                          Load
                        </Button>
                        <Button
                          onClick={() => handleDelete(response.id)}
                          size="sm"
                          variant="ghost"
                          className="text-red-600 hover:bg-red-50"
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
