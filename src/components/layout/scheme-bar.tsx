import { Link } from "@tanstack/react-router";
import { uniqueSchemes } from "@/lib/mpf/catalog";
import { useAppStore } from "@/lib/store";

export function SchemeBar() {
  const locale = useAppStore((s) => s.locale);
  const zh = locale === "zh";
  const schemeEn = useAppStore((s) => s.profile.schemeEn);
  const setProfile = useAppStore((s) => s.setProfile);
  const schemes = uniqueSchemes();
  const current = schemes.find((s) => s.en === schemeEn);

  return (
    <div className="border-b border-white/10 bg-[#08243f]">
      <div className="mx-auto flex max-w-6xl items-center gap-2 px-4 py-2">
        <label className="shrink-0 text-[11px] text-canvas-muted">{zh ? "你的計劃" : "Your scheme"}</label>
        <select
          className="min-w-0 flex-1 truncate rounded-md bg-white/10 px-2 py-1 text-xs text-white"
          value={schemeEn ?? ""}
          onChange={(e) => setProfile({ schemeEn: e.target.value || null })}
        >
          <option value="">{zh ? "尚未選擇（顯示全港）" : "Not set (all HK)"}</option>
          {schemes.map((s) => (
            <option key={s.en} value={s.en}>
              {zh ? s.zh : s.en}
            </option>
          ))}
        </select>
        {current ? (
          <div className="hidden shrink-0 items-center gap-3 sm:flex">
            <Link to="/funds" search={{ scheme: current.en }} className="text-[11px] text-accent hover:underline">
              {zh ? "基金" : "Funds"}
            </Link>
            <Link to="/compare" className="text-[11px] text-accent hover:underline">
              {zh ? "比較" : "Compare"}
            </Link>
            <Link to="/recommend" className="text-[11px] text-accent hover:underline">
              {zh ? "智選" : "Recommend"}
            </Link>
          </div>
        ) : null}
      </div>
    </div>
  );
}
