"use client";

import * as React from "react";
import { createPortal } from "react-dom";

import { Button } from "@/components/atoms/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/atoms/card";

type TourSectionId = "import" | "overview" | "analyze" | "letter" | "mail";

type TourPlacement = "top" | "bottom" | "left" | "right" | "center";

type TourStep = {
  target: string;
  title: string;
  content: string;
  placement?: TourPlacement;
  disableBeacon?: boolean;
};

type PersistedTourState = {
  v: 1;
  stepIndex: number;
};

const STORAGE_KEY = "app_tour_v1";

function loadPersisted(): PersistedTourState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedTourState;
    if (!parsed || parsed.v !== 1 || typeof parsed.stepIndex !== "number") return null;
    return parsed;
  } catch {
    return null;
  }
}

function persist(stepIndex: number) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ v: 1, stepIndex } satisfies PersistedTourState));
  } catch {
    // ignore
  }
}

function clearPersisted() {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

const SECTIONS: Array<{ id: TourSectionId; title: string; steps: TourStep[] }> = [
  {
    id: "import",
    title: "Import your credit reports",
    steps: [
      {
        target: '[data-tour="import-dropzone"]',
        title: "Upload reports",
        content:
          "Start by importing your credit report files (PDF/JSON/CSV/HTML). This powers the credit repair analysis and dispute workflow.",
        placement: "bottom",
        disableBeacon: true,
      },
      {
        target: '[data-tour="import-add-files"]',
        title: "Add files",
        content:
          "Use this button to browse and add more reports. You can upload multiple bureaus and the dashboard will process them.",
        placement: "top",
        disableBeacon: true,
      },
      {
        target: '[data-tour="import-saved-imports"]',
        title: "Saved imports",
        content:
          "Previously uploaded reports are available here. Selecting one loads the stored parsed data.",
        placement: "top",
        disableBeacon: true,
      },
    ],
  },
  {
    id: "overview",
    title: "Understand your credit profile",
    steps: [
      {
        target: '[data-tour="tab-overview"]',
        title: "Overview tab",
        content:
          "The Overview tab shows your credit scores, key metrics, and a summary of positive factors and areas for improvement.",
        placement: "bottom",
        disableBeacon: true,
      },
      {
        target: '[data-tour="score-summary"]',
        title: "Credit scores",
        content:
          "See your credit scores from each bureau at a glance. The gauge shows where you stand and how close you are to the next tier.",
        placement: "bottom",
        disableBeacon: true,
      },
      {
        target: '[data-tour="tab-personal"]',
        title: "Personal information",
        content:
          "Review your personal details as reported by each bureau. Mismatches are highlighted so you can dispute inaccuracies.",
        placement: "bottom",
        disableBeacon: true,
      },
      {
        target: '[data-tour="tab-accounts"]',
        title: "Accounts tab",
        content:
          "View all your credit accounts, payment history, and identify items that may need attention or could be disputed.",
        placement: "bottom",
        disableBeacon: true,
      },
    ],
  },
  {
    id: "analyze",
    title: "Find dispute items (credit repair)",
    steps: [
      {
        target: '[data-tour="tab-disputes"]',
        title: "Disputes tab",
        content:
          "Open Disputes to see negative items detected from the bureau data. This is where the app applies credit repair logic to surface what you can dispute.",
        placement: "bottom",
        disableBeacon: true,
      },
      {
        target: '[data-tour="dispute-items-pane"]',
        title: "Review and select",
        content:
          "Filter/search, open details, and select the items you want to dispute for this round.",
        placement: "right",
        disableBeacon: true,
      },
      {
        target: '[data-tour="send-to-letter"]',
        title: "Send to letter",
        content:
          "Once you select dispute items, send them to the letter builder.",
        placement: "top",
        disableBeacon: true,
      },
    ],
  },
  {
    id: "letter",
    title: "Generate the dispute letter",
    steps: [
      {
        target: '[data-tour="letter-builder"]',
        title: "Letter builder",
        content:
          "This section composes your dispute letter using templates and AI assistance. It uses the imported report as context for accuracy.",
        placement: "top",
        disableBeacon: true,
      },
      {
        target: '[data-tour="letter-generate"]',
        title: "Generate",
        content:
          "Generate the letter text (AI first, with a template fallback). Make sure you’ve selected dispute items first.",
        placement: "left",
        disableBeacon: true,
      },
      {
        target: '[data-tour="letter-from"]',
        title: "Your return address",
        content:
          "Enter your name and return address. This is required for sending physical mail.",
        placement: "right",
        disableBeacon: true,
      },
      {
        target: '[data-tour="letter-recipients"]',
        title: "Recipients",
        content:
          "Add the credit bureau / creditor mailing address(es). You can send the same letter to multiple recipients.",
        placement: "top",
        disableBeacon: true,
      },
    ],
  },
  {
    id: "mail",
    title: "Send via snail mail",
    steps: [
      {
        target: '[data-tour="letter-submit"]',
        title: "Submit to mail service",
        content:
          "Submit sends your letter to the mail provider (LetterStream) for printing and mailing. Configure the LetterStream API env vars on the server.",
        placement: "top",
        disableBeacon: true,
      },
    ],
  },
];

type TourStepData = {
  sectionId: TourSectionId;
  sectionTitle: string;
  sectionIndex: number;
  totalSections: number;
  stepInSection: number;
  totalInSection: number;
};

type FlattenedTourStep = TourStep & { data?: TourStepData };

function getTourStepData(step: FlattenedTourStep): TourStepData | null {
  const raw = step.data as unknown;
  if (!raw || typeof raw !== "object") return null;
  const rec = raw as Record<string, unknown>;
  const sectionId = rec.sectionId;
  if (
    sectionId !== "import" &&
    sectionId !== "overview" &&
    sectionId !== "analyze" &&
    sectionId !== "letter" &&
    sectionId !== "mail"
  ) {
    return null;
  }
  return rec as unknown as TourStepData;
}

const FLAT_STEPS: FlattenedTourStep[] = SECTIONS.flatMap((section, sectionIndex) => {
  const totalSections = SECTIONS.length;
  return section.steps.map((s, i) => ({
    ...s,
    data: {
      sectionId: section.id,
      sectionTitle: section.title,
      sectionIndex,
      totalSections,
      stepInSection: i + 1,
      totalInSection: section.steps.length,
    },
  }));
});

const SECTION_START_INDEX: Record<TourSectionId, number> = SECTIONS.reduce(
  (acc, s) => {
    acc[s.id] = FLAT_STEPS.findIndex((st) => getTourStepData(st)?.sectionId === s.id);
    return acc;
  },
  {} as Record<TourSectionId, number>
);

type TourContextValue = {
  start: () => void;
  resume: () => void;
  startSection: (id: TourSectionId) => void;
  reset: () => void;
  hasSavedProgress: boolean;
};

const TourContext = React.createContext<TourContextValue | null>(null);

export function useAppTour() {
  const ctx = React.useContext(TourContext);
  if (!ctx) throw new Error("useAppTour must be used within AppTourRoot");
  return ctx;
}

export function AppTourRoot({ children }: { children: React.ReactNode }) {
  const [run, setRun] = React.useState(false);
  const [stepIndex, setStepIndex] = React.useState(0);
  const [hasSavedProgress, setHasSavedProgress] = React.useState(false);

  React.useEffect(() => {
    const saved = loadPersisted();
    if (!saved) return;
    setStepIndex(saved.stepIndex);
    setHasSavedProgress(true);
  }, []);

  const start = React.useCallback(() => {
    clearPersisted();
    setHasSavedProgress(false);
    setStepIndex(0);
    setRun(true);
  }, []);

  const resume = React.useCallback(() => {
    const saved = loadPersisted();
    if (saved) {
      setStepIndex(saved.stepIndex);
      setHasSavedProgress(true);
    }
    setRun(true);
  }, []);

  const startSection = React.useCallback((id: TourSectionId) => {
    clearPersisted();
    setHasSavedProgress(false);
    setStepIndex(Math.max(0, SECTION_START_INDEX[id] ?? 0));
    setRun(true);
  }, []);

  const reset = React.useCallback(() => {
    clearPersisted();
    setRun(false);
    setStepIndex(0);
    setHasSavedProgress(false);
  }, []);

  const stopAndClear = React.useCallback(() => {
    setRun(false);
    clearPersisted();
    setHasSavedProgress(false);
    setStepIndex(0);
  }, []);

  const goToIndex = React.useCallback((nextIndex: number) => {
    const clamped = Math.max(0, Math.min(nextIndex, FLAT_STEPS.length - 1));
    setStepIndex(clamped);
    persist(clamped);
    setHasSavedProgress(true);
  }, []);

  const next = React.useCallback(() => {
    if (stepIndex >= FLAT_STEPS.length - 1) {
      stopAndClear();
      return;
    }
    goToIndex(stepIndex + 1);
  }, [goToIndex, stepIndex, stopAndClear]);

  const prev = React.useCallback(() => {
    goToIndex(stepIndex - 1);
  }, [goToIndex, stepIndex]);

  const ctxValue = React.useMemo<TourContextValue>(
    () => ({ start, resume, startSection, reset, hasSavedProgress }),
    [start, resume, startSection, reset, hasSavedProgress]
  );

  const activeStep = run ? FLAT_STEPS[stepIndex] : null;

  return (
    <TourContext.Provider value={ctxValue}>
      {children}
      {activeStep
        ? createPortal(
            <TourLayer
              step={activeStep}
              stepIndex={stepIndex}
              totalSteps={FLAT_STEPS.length}
              onNext={next}
              onPrev={prev}
              onSkip={stopAndClear}
              onTargetNotFound={next}
            />,
            document.body
          )
        : null}
    </TourContext.Provider>
  );
}

function TourLayer({
  step,
  stepIndex,
  totalSteps,
  onNext,
  onPrev,
  onSkip,
  onTargetNotFound,
}: {
  step: FlattenedTourStep;
  stepIndex: number;
  totalSteps: number;
  onNext: () => void;
  onPrev: () => void;
  onSkip: () => void;
  onTargetNotFound: () => void;
}) {
  const [rect, setRect] = React.useState<DOMRect | null>(null);
  const stepData = getTourStepData(step);

  const updateRect = React.useCallback(() => {
    const el = typeof document !== "undefined" ? document.querySelector(step.target) : null;
    if (!el) {
      setRect(null);
      return;
    }
    const r = (el as HTMLElement).getBoundingClientRect();
    setRect(r);
  }, [step.target]);

  React.useEffect(() => {
    const el = typeof document !== "undefined" ? document.querySelector(step.target) : null;
    if (!el) {
      onTargetNotFound();
      return;
    }
    updateRect();
    (el as HTMLElement).scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
  }, [onTargetNotFound, step.target, updateRect]);

  React.useEffect(() => {
    const handler = () => updateRect();
    window.addEventListener("resize", handler);
    window.addEventListener("scroll", handler, true);
    return () => {
      window.removeEventListener("resize", handler);
      window.removeEventListener("scroll", handler, true);
    };
  }, [updateRect]);

  const padding = 10;
  const placement: TourPlacement = step.placement ?? "bottom";

  const tooltipStyle: React.CSSProperties = React.useMemo(() => {
    if (!rect || placement === "center") {
      return {
        position: "fixed",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        zIndex: 10001,
        maxWidth: 380,
        width: "min(380px, calc(100vw - 32px))",
      };
    }

    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const gap = 12;

    if (placement === "top") {
      return {
        position: "fixed",
        top: rect.top - gap,
        left: centerX,
        transform: "translate(-50%, -100%)",
        zIndex: 10001,
        maxWidth: 380,
        width: "min(380px, calc(100vw - 32px))",
      };
    }

    if (placement === "bottom") {
      return {
        position: "fixed",
        top: rect.bottom + gap,
        left: centerX,
        transform: "translate(-50%, 0)",
        zIndex: 10001,
        maxWidth: 380,
        width: "min(380px, calc(100vw - 32px))",
      };
    }

    if (placement === "left") {
      return {
        position: "fixed",
        top: centerY,
        left: rect.left - gap,
        transform: "translate(-100%, -50%)",
        zIndex: 10001,
        maxWidth: 380,
        width: "min(380px, calc(100vw - 32px))",
      };
    }

    return {
      position: "fixed",
      top: centerY,
      left: rect.right + gap,
      transform: "translate(0, -50%)",
      zIndex: 10001,
      maxWidth: 380,
      width: "min(380px, calc(100vw - 32px))",
    };
  }, [placement, rect]);

  const spotlightStyle: React.CSSProperties | null = React.useMemo(() => {
    if (!rect) return null;
    return {
      position: "fixed",
      top: Math.max(0, rect.top - padding),
      left: Math.max(0, rect.left - padding),
      width: rect.width + padding * 2,
      height: rect.height + padding * 2,
      borderRadius: 12,
      boxShadow: "0 0 0 9999px rgba(0,0,0,0.55)",
      zIndex: 10000,
      pointerEvents: "none",
    };
  }, [rect]);

  const progressPercent = Math.round(((stepIndex + 1) / totalSteps) * 100);

  return (
    <div>
      <div className="fixed inset-0" style={{ zIndex: 9999 }} />
      {spotlightStyle ? <div style={spotlightStyle} /> : <div className="fixed inset-0 bg-black/55" style={{ zIndex: 10000 }} />}

      <div style={tooltipStyle}>
        <Card className="shadow-2xl border-0 overflow-hidden">
          {/* Progress bar */}
          <div className="h-1 bg-slate-100">
            <div 
              className="h-full bg-purple-600 transition-all duration-300" 
              style={{ width: `${progressPercent}%` }} 
            />
          </div>
          
          <CardHeader className="py-4 pb-2">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center text-purple-700 font-semibold text-sm">
                  {stepIndex + 1}
                </div>
                <CardTitle className="text-base">{step.title}</CardTitle>
              </div>
              <Button type="button" variant="ghost" size="sm" className="text-slate-400 hover:text-slate-600" onClick={onSkip}>
                Skip tour
              </Button>
            </div>
            {stepData ? (
              <div className="text-xs text-slate-500 mt-2 flex items-center gap-2">
                <span className="font-medium text-purple-600">{stepData.sectionTitle}</span>
                <span className="text-slate-300">•</span>
                <span>Step {stepData.stepInSection} of {stepData.totalInSection}</span>
              </div>
            ) : null}
          </CardHeader>
          <CardContent className="text-sm text-slate-600 leading-relaxed pt-0">
            {step.content}
          </CardContent>
          <CardFooter className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100">
            <Button 
              type="button" 
              variant="ghost" 
              size="sm"
              className="text-slate-500"
              onClick={onPrev} 
              disabled={stepIndex <= 0}
            >
              ← Back
            </Button>
            <div className="text-xs text-slate-400">
              {stepIndex + 1} / {totalSteps}
            </div>
            <Button 
              type="button" 
              size="sm"
              className="bg-purple-600 hover:bg-purple-700"
              onClick={onNext}
            >
              {stepIndex >= totalSteps - 1 ? "Finish" : "Next →"}
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
