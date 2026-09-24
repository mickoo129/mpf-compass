import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Locale } from "./i18n";
import type { GoalId, Profile, SavedMix, SwitchHorizon } from "./mpf/types";

const defaultProfile: Profile = {
  age: 35,
  retireAge: 65,
  balance: 0,
  monthly: 0,
  account: "personal",
  schemeEn: null,
  goal: "balanced",
  risk: "moderate",
  mixSize: "auto",
  reviewEvery: "auto",
  switchHorizon: "6m",
};

function normalizeGoal(g: unknown): GoalId {
  if (g === "growth" || g === "balanced" || g === "preserve" || g === "lowfee" || g === "dis") return g;
  return "balanced";
}

function normalizeHorizon(h: unknown): SwitchHorizon {
  if (h === "1m" || h === "3m" || h === "6m" || h === "1y") return h;
  if (h === "2m") return "3m";
  return "6m";
}

interface AppState {
  locale: Locale;
  compareIds: string[];
  profile: Profile;
  lastMix: SavedMix | null;
  setLocale: (locale: Locale) => void;
  toggleCompare: (id: string) => void;
  clearCompare: () => void;
  setProfile: (patch: Partial<Profile>) => void;
  saveMix: (mix: SavedMix) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      locale: "zh",
      compareIds: [],
      profile: defaultProfile,
      lastMix: null,
      setLocale: (locale) => set({ locale }),
      toggleCompare: (id) => {
        const cur = get().compareIds;
        if (cur.includes(id)) {
          set({ compareIds: cur.filter((x) => x !== id) });
          return;
        }
        if (cur.length >= 4) return;
        set({ compareIds: [...cur, id] });
      },
      clearCompare: () => set({ compareIds: [] }),
      setProfile: (patch) => {
        const profile = {
          ...get().profile,
          ...patch,
          goal: normalizeGoal(patch.goal ?? get().profile.goal),
          switchHorizon: normalizeHorizon(patch.switchHorizon ?? get().profile.switchHorizon),
        };
        set({ profile });
      },
      saveMix: (mix) => set({ lastMix: mix }),
    }),
    {
      name: "mpf-compass",
      partialize: (s) => ({ locale: s.locale, compareIds: s.compareIds }),
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<AppState>;
        return {
          ...current,
          locale: p.locale === "en" || p.locale === "zh" ? p.locale : current.locale,
          compareIds: Array.isArray(p.compareIds) ? p.compareIds.slice(0, 4) : current.compareIds,
        };
      },
    },
  ),
);
