"use client";

import * as React from "react";

import { Button } from "@/components/atoms/button";
import { Card } from "@/components/atoms/card";
import type { TourId } from "@/lib/tours";
import { getTourUserKey, setTourUserKey } from "@/lib/tour-storage";

export function TutorialLauncher({
  onStartTour,
  onResetAll,
}: {
  onStartTour: (tourId: TourId | "end_to_end") => void;
  onResetAll: () => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [userKey, setUserKey] = React.useState("anon");

  React.useEffect(() => {
    setUserKey(getTourUserKey());
  }, []);

  return (
    <div className="fixed bottom-6 left-6 z-50">
      <div className="flex flex-col items-start gap-2">
        {open && (
          <Card className="w-[320px] p-3 shadow-xl border border-stone-200 bg-white">
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="text-sm font-semibold text-stone-900">Tutorials</div>
                <Button type="button" variant="ghost" size="sm" className="h-7 px-2" onClick={() => setOpen(false)}>
                  Close
                </Button>
              </div>

              <div className="space-y-1">
                <div className="text-xs font-medium text-stone-600">Tutorial email (local only)</div>
                <div className="flex items-center gap-2">
                  <input
                    value={userKey}
                    onChange={(e) => setUserKey(e.target.value)}
                    placeholder="you@email.com"
                    className="h-9 flex-1 rounded-md border border-stone-300 bg-white px-3 text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-purple-400"
                  />
                  <Button
                    type="button"
                    size="sm"
                    className="h-9"
                    onClick={() => {
                      setTourUserKey(userKey);
                      setUserKey(getTourUserKey());
                    }}
                  >
                    Save
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <Button type="button" variant="default" className="bg-purple-600 hover:bg-purple-700" onClick={() => onStartTour("end_to_end")}>Run end-to-end</Button>
                <Button type="button" variant="outline" onClick={onResetAll}>Reset</Button>
                <Button type="button" variant="outline" onClick={() => onStartTour("upload")}>Upload</Button>
                <Button type="button" variant="outline" onClick={() => onStartTour("disputes")}>Disputes</Button>
                <Button type="button" variant="outline" onClick={() => onStartTour("letter")}>Letter</Button>
                <Button type="button" variant="outline" onClick={() => onStartTour("snail_mail")}>Snail mail</Button>
              </div>

              <div className="text-[11px] text-stone-500">
                Tutorial progress is stored in your browser for this email key.
              </div>
            </div>
          </Card>
        )}

        <Button
          type="button"
          className="shadow-lg bg-purple-600 hover:bg-purple-700"
          onClick={() => setOpen((v) => !v)}
        >
          Help
        </Button>
      </div>
    </div>
  );
}
