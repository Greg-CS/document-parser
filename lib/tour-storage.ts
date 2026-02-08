export type TourStatus = "idle" | "running" | "completed" | "dismissed";

export type TourProgress = {
  tourId: string;
  tourVersion: number;
  status: TourStatus;
  stepIndex: number;
  updatedAt: number;
};

const USER_KEY_STORAGE = "cr_tour:userKey";

export function getTourUserKey(): string {
  if (typeof window === "undefined") return "anon";
  try {
    const raw = window.localStorage.getItem(USER_KEY_STORAGE);
    const value = (raw ?? "").trim().toLowerCase();
    return value || "anon";
  } catch {
    return "anon";
  }
}

export function setTourUserKey(userKey: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(USER_KEY_STORAGE, userKey.trim().toLowerCase());
  } catch {
    // ignore
  }
}

function tourStorageKey(params: { userKey: string; tourId: string; tourVersion: number }) {
  return `cr_tour:${params.userKey}:${params.tourId}:v${params.tourVersion}`;
}

export function loadTourProgress(params: { userKey: string; tourId: string; tourVersion: number }): TourProgress | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(tourStorageKey(params));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as TourProgress;
    if (!parsed || parsed.tourId !== params.tourId || parsed.tourVersion !== params.tourVersion) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveTourProgress(progress: TourProgress, userKey: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      tourStorageKey({ userKey, tourId: progress.tourId, tourVersion: progress.tourVersion }),
      JSON.stringify(progress)
    );
  } catch {
    // ignore
  }
}

export function clearTourProgress(params: { userKey: string; tourId: string; tourVersion: number }) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(tourStorageKey(params));
  } catch {
    // ignore
  }
}

export function hasSeenAnyTour(userKey: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(`cr_tour:${userKey}:seen_any`) === "1";
  } catch {
    return false;
  }
}

export function markSeenAnyTour(userKey: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(`cr_tour:${userKey}:seen_any`, "1");
  } catch {
    // ignore
  }
}

export function clearSeenAnyTour(userKey: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(`cr_tour:${userKey}:seen_any`);
  } catch {
    // ignore
  }
}
