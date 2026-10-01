/**
 * Page meta for link previews (WhatsApp, Facebook, Telegram read og:*).
 * Child routes return these from `head`; TanStack keeps the deepest match.
 */
export const SITE_URL = "https://mpf-compass.netlify.app";
export const SITE_NAME = "積金羅盤";

export function seo({ title, description, path = "/" }: { title: string; description: string; path?: string }) {
  const full = title === SITE_NAME ? title : `${title} · ${SITE_NAME}`;
  return [
    { title: full },
    { name: "description", content: description },
    { property: "og:type", content: "website" },
    { property: "og:site_name", content: SITE_NAME },
    { property: "og:title", content: title },
    { property: "og:description", content: description },
    { property: "og:url", content: `${SITE_URL}${path}` },
    { property: "og:image", content: `${SITE_URL}/og.jpg` },
    { property: "og:image:width", content: "1200" },
    { property: "og:image:height", content: "630" },
    { property: "og:locale", content: "zh_HK" },
    { name: "twitter:card", content: "summary_large_image" },
    { name: "twitter:title", content: title },
    { name: "twitter:description", content: description },
  ];
}
