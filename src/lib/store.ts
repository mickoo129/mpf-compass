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
  /** When the compare list last changed (ms). Old lists are dropped so the next client doesn't see them. */
  compareAt: number | null;
  profile: Profile;
  lastMix: SavedMix | null;
  /** 健康檢查最後嘅輸入（計劃、基金、比例或金額）。只留喺今次瀏覽，唔存落機。 */
  lastCheckup: CheckupState | null;
  /** 由健康檢查撳去比較時，記低點解揀嗰幾隻同點樣返去。 */
  compareNote: CompareNote | null;
  setLastCheckup: (c: CheckupState | null) => void;
  setCompareNote: (n: CompareNote | null) => void;
  setLocale: (locale: Locale) => void;
  toggleCompare: (id: string) => void;
  clearCompare: () => void;
  /** Replace the compare list in one go (健康檢查 → 比較). */
  setCompare: (ids: string[]) => void;
  setProfile: (patch: Partial<Profile>) => void;
  saveMix: (mix: SavedMix) => void;
  /** Start afresh for the next client: age, balance, scheme, compare list and saved mix. */
  resetSession: () => void;
}

const COMPARE_TTL_MS = 3 * 60 * 60 * 1000;

export type CheckupState = { s?: string; h?: string; m?: "a" };
const CHECKUP_KEY = "mpf-compass-checkup";

/** 今次瀏覽最後嘅健康檢查（記憶體優先，重新載入就讀 sessionStorage）。 */
export function readLastCheckup(): CheckupState | null {
  const mem = useAppStore.getState().lastCheckup;
  if (mem) return mem;
  try {
    const raw = sessionStorage.getItem(CHECKUP_KEY);
    const v = raw ? (JSON.parse(raw) as CheckupState) : null;
    return v && typeof v === "object" ? { s: v.s, h: v.h, m: v.m === "a" ? "a" : undefined } : null;
  } catch {
    return null;
  }
}
export type CompareNote = { ids: string[]; whyZh: string; whyEn: string; back: CheckupState };

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      locale: "zh",
      compareIds: [],
      compareAt: null,
      profile: defaultProfile,
      lastMix: null,
      lastCheckup: null,
      compareNote: null,
      setLastCheckup: (c) => {
        // 同時寫入 sessionStorage：重新載入頁面都仲喺度，閂咗個分頁就冇
        try {
          if (c) sessionStorage.setItem(CHECKUP_KEY, JSON.stringify(c));
          else sessionStorage.removeItem(CHECKUP_KEY);
        } catch {
          /* 私隱模式等情況寫唔到，照用記憶體 */
        }
        set({ lastCheckup: c });
      },
      setCompareNote: (n) => set({ compareNote: n }),
      setLocale: (locale) => set({ locale }),
      toggleCompare: (id) => {
        const cur = get().compareIds;
        if (cur.includes(id)) {
          set({ compareIds: cur.filter((x) => x !== id), compareAt: Date.now() });
          return;
        }
        if (cur.length >= 4) return;
        set({ compareIds: [...cur, id], compareAt: Date.now() });
      },
      clearCompare: () => set({ compareIds: [], compareAt: null }),
      setCompare: (ids) => set({ compareIds: [...new Set(ids)].slice(0, 4), compareAt: Date.now() }),
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
      resetSession: () => {
        try {
          sessionStorage.removeItem(CHECKUP_KEY);
        } catch {
          /* ignore */
        }
        set({ profile: defaultProfile, compareIds: [], compareAt: null, lastMix: null, lastCheckup: null, compareNote: null });
      },
    }),
    {
      name: "mpf-compass",
      // The saved mix stays on this device so a member can come back in a month and compare.
      // Personal figures (age, balance) are deliberately not kept.
      partialize: (s) => ({ locale: s.locale, compareIds: s.compareIds, compareAt: s.compareAt, lastMix: s.lastMix }),
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<AppState>;
        // 比較清單超過 3 個鐘冇郁過就當係上一位客人嘅，唔再帶返出嚟
        const fresh = typeof p.compareAt === "number" && Date.now() - p.compareAt < COMPARE_TTL_MS;
        return {
          ...current,
          locale: p.locale === "en" || p.locale === "zh" ? p.locale : current.locale,
          compareIds: fresh && Array.isArray(p.compareIds) ? p.compareIds.slice(0, 4) : [],
          compareAt: fresh ? (p.compareAt as number) : null,
          lastMix:
            p.lastMix && typeof p.lastMix.at === "string" && Array.isArray(p.lastMix.holdings) ? p.lastMix : current.lastMix,
        };
      },
    },
  ),
);
