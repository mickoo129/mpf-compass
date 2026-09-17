import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Locale } from "./i18n";
import type { Profile } from "./mpf/types";

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
      setProfile: (patch) => set({ profile: { ...get().profile, ...patch } }),
    }),
    { name: "mpf-compass" },
  ),
);
