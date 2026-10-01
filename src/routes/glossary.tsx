import { createFileRoute } from "@tanstack/react-router";
import { PageTitle } from "@/components/layout/app-shell";
import { Card } from "@/components/ui/card";
import { GLOSSARY, type TermKey } from "@/lib/glossary";
import { useAppStore } from "@/lib/store";

export const Route = createFileRoute("/glossary")({
  head: () => ({
    meta: [
      { title: "強積金詞彙 · 積金羅盤" },
      { name: "description", content: "開支比率、風險級別、預設投資策略、年化同累積回報等強積金用語，用白話解釋。" },
    ],
  }),
  component: GlossaryPage,
});

function GlossaryPage() {
  const zh = useAppStore((s) => s.locale) === "zh";
  const keys = Object.keys(GLOSSARY) as TermKey[];
  return (
    <div>
      <PageTitle
        kicker={zh ? "詞彙" : "Glossary"}
        title={zh ? "強積金用語，白話解釋" : "MPF terms in plain words"}
        subtitle={zh ? "網站入面見到「?」，撳落去都會見到呢度嘅解釋。" : "Tap any “?” on the site to see these."}
      />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {keys.map((k) => (
          <Card key={k} id={k} className="scroll-mt-20">
            <h2 className="mb-1 font-display text-lg">{zh ? GLOSSARY[k].zh : GLOSSARY[k].en}</h2>
            <p className="text-sm text-muted">{zh ? GLOSSARY[k].bodyZh : GLOSSARY[k].bodyEn}</p>
          </Card>
        ))}
      </div>
    </div>
  );
}
