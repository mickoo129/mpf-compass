// MKPA 列印保護（由 mkpa-tools/_standard/snippets.html 第 6b 段改寫）：
// iPhone 主畫面 app 模式、WhatsApp／IG／Facebook／微信等 app 內置瀏覽器唔支援 window.print()，
// 撳 .mk-print-btn 時改為提示用 Safari／Chrome 開，並提供「複製連結」。
const IN_APP = /FBAN|FBAV|FB_IAB|Instagram|Line\/|WhatsApp|MicroMessenger|WeChat|Messenger|Threads|Snapchat|TikTok|BytedanceWebview/i;

export function printBlocked(): boolean {
  if (typeof window === "undefined") return false;
  const ua = navigator.userAgent || "";
  const standalone =
    (navigator as Navigator & { standalone?: boolean }).standalone === true ||
    (window.matchMedia?.("(display-mode: standalone)").matches && /iPhone|iPad|iPod/i.test(ua));
  return IN_APP.test(ua) || standalone;
}

export function showPrintHelp(): void {
  document.querySelector(".mk-printhelp")?.remove();
  const d = document.createElement("div");
  d.className = "mk-printhelp";
  d.setAttribute("role", "dialog");
  d.setAttribute("aria-label", "列印提示");
  d.innerHTML =
    '<p><b>呢個畫面唔支援列印</b>由主畫面 icon 或者 WhatsApp、IG 等 app 開，手機唔俾列印。請撳「複製連結」，貼去 Safari 或 Chrome 開，再撳「列印 / 存 PDF」。</p><div><button type="button" class="mk-printhelp-copy">複製連結</button><button type="button" class="mk-printhelp-close">知道</button></div>';
  document.body.appendChild(d);
  d.querySelector<HTMLButtonElement>(".mk-printhelp-close")!.onclick = () => d.remove();
  const copyBtn = d.querySelector<HTMLButtonElement>(".mk-printhelp-copy")!;
  copyBtn.onclick = () => {
    const u = location.href;
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(u).then(
        () => (copyBtn.textContent = "已複製"),
        () => window.prompt("複製呢條連結：", u),
      );
    } else window.prompt("複製呢條連結：", u);
  };
}

/** 喺 capture 階段攔截 .mk-print-btn，唔支援列印時顯示提示。回傳移除 listener 嘅函數。 */
export function installPrintGuard(): () => void {
  const onClick = (e: MouseEvent) => {
    const t = (e.target as Element | null)?.closest?.(".mk-print-btn");
    if (!t || !printBlocked()) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    showPrintHelp();
  };
  document.addEventListener("click", onClick, true);
  return () => document.removeEventListener("click", onClick, true);
}
