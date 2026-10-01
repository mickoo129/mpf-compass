import { Share, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useAppStore } from "@/lib/store";

const DISMISS_KEY = "mpf-compass:install-dismissed";
const VISITS_KEY = "mpf-compass:visits";

type InstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

function readNumber(key: string): number {
  try {
    return Number(localStorage.getItem(key) || 0);
  } catch {
    return 0;
  }
}
function write(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* private mode */
  }
}

/**
 * Small "加到主畫面" card for phones. Shown from the second visit, never when
 * already opened from the home screen, and hidden for 30 days once closed.
 * Android Chrome gets a one-tap install; iPhone gets the Share → 加至主畫面 steps.
 */
export function InstallHint() {
  const zh = useAppStore((s) => s.locale) === "zh";
  const [mode, setMode] = useState<"android" | "ios" | null>(null);
  const [prompt, setPrompt] = useState<InstallPromptEvent | null>(null);

  useEffect(() => {
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true;
    if (standalone) return;
    const phone = window.matchMedia("(pointer: coarse)").matches && window.innerWidth < 900;
    if (!phone) return;
    if (Date.now() - readNumber(DISMISS_KEY) < 30 * 86_400_000) return;
    const visits = readNumber(VISITS_KEY) + 1;
    write(VISITS_KEY, String(visits));
    if (visits < 2) return;

    const ua = navigator.userAgent;
    const ios = /iPhone|iPad|iPod/.test(ua) && /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua);
    if (ios) {
      setMode("ios");
      return;
    }
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setPrompt(e as InstallPromptEvent);
      setMode("android");
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  if (!mode) return null;
  const close = () => {
    write(DISMISS_KEY, String(Date.now()));
    setMode(null);
  };

  return (
    <div className="fixed inset-x-3 bottom-3 z-50 rounded-xl bg-card p-3 text-fg shadow-[var(--shadow-border)] ring-1 ring-border sm:hidden">
      <button type="button" onClick={close} className="absolute top-2 right-2 rounded p-1 text-subtle" aria-label={zh ? "關閉" : "Close"}>
        <X className="size-4" />
      </button>
      <div className="flex items-center gap-3 pr-6">
        <img src="/icons/icon-192.png" alt="" className="size-10 shrink-0 rounded-lg" />
        <div className="min-w-0 text-sm">
          <p className="font-medium">{zh ? "加到主畫面，下次一撳就開" : "Add to your home screen"}</p>
          {mode === "ios" ? (
            <p className="text-xs text-muted">
              {zh ? "撳 Safari 下面嘅" : "Tap"} <Share className="inline size-3.5 align-text-bottom" />{" "}
              {zh ? "分享，再揀「加至主畫面」。" : "Share, then “Add to Home Screen”."}
            </p>
          ) : (
            <p className="text-xs text-muted">{zh ? "好似 App 咁用，唔使再打網址。" : "Opens like an app."}</p>
          )}
        </div>
        {mode === "android" && prompt ? (
          <Button
            size="sm"
            className="shrink-0"
            onClick={async () => {
              await prompt.prompt();
              await prompt.userChoice.catch(() => undefined);
              close();
            }}
          >
            {zh ? "加入" : "Install"}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
