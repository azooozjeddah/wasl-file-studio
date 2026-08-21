import { ArrowLeft, LockKeyhole, Sparkles } from "lucide-react";
import { Link } from "wouter";
import type { ToolDefinition } from "@/lib/tools";
import { useLocale } from "@/contexts/LocaleContext";

export default function ToolCard({ tool, index = 0 }: { tool: ToolDefinition; index?: number }) {
  const { isArabic, t } = useLocale(); const Icon = tool.icon;
  return <Link href={`/${tool.slug}`} className="tool-card" style={{ "--delay": `${index * 35}ms` } as React.CSSProperties}><div className="tool-card-top"><span className={`tool-icon tool-${tool.category}`}><Icon size={21}/></span>{tool.experimental ? <span className="tool-badge">{t("متقدم", "Advanced")}</span> : <span className="tool-badge local"><LockKeyhole size={11}/>{t("محلي", "Local")}</span>}</div><div><h3>{isArabic ? tool.labelAr : tool.labelEn}</h3><p>{isArabic ? tool.descriptionAr : tool.descriptionEn}</p></div><span className="tool-card-go">{t("افتح الأداة", "Open tool")} <ArrowLeft size={15} className={isArabic ? "rotate-180" : ""}/></span></Link>;
}
