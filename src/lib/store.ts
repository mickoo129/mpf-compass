import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Locale } from "./i18n";
import type { GoalId, Profile, SwitchHorizon } from "./mpf/types";

const defaultProfile: Profile = {
  age: 35,
  retireAge: 65,
  balance: 400000,
  monthly: 3000,
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
  setLocale: (locale: Locale) => void;
  toggleCompare: (id: string) => void;
  clearCompare: () => void;
  setProfile: (patch: Partial<Profile>) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      locale: "zh",
      compareIds: [],
      profile: defaultProfile,
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
    }),
    {
      name: "mpf-compass",
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<AppState>;
        return {
          ...current,
          ...p,
          profile: {
            ...current.profile,
            ...p.profile,
            goal: normalizeGoal(p.profile?.goal ?? current.profile.goal),
            switchHorizon: normalizeHorizon(p.profile?.switchHorizon ?? current.profile.switchHorizon),
          },
        };
      },
    },
  ),
);
