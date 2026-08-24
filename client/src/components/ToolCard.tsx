import { ArrowLeft, LockKeyhole, Sparkles } from "lucide-react";
import { Link } from "wouter";
import { toolIconFor, type ToolDefinition } from "@/lib/tools";
import { toolVisualTone } from "@/lib/tool-visuals";
import { useLocale } from "@/contexts/LocaleContext";

export default function ToolCard({ tool, index = 0, lifecycleStatus }: { tool: ToolDefinition; index?: number; lifecycleStatus?: "ready" | "beta" | "maintenance" | "disabled" }) {
  const { isArabic, t } = useLocale(); const Icon = toolIconFor(tool.slug, tool.icon); const visualTone = toolVisualTone(tool.slug, tool.category);
  const effectiveStatus = lifecycleStatus ?? (tool.experimental ? "beta" : tool.readiness === "improving" ? "beta" : "ready");
  const unavailable = effectiveStatus === "maintenance" || effectiveStatus === "disabled";
  const badge = unavailable ? <span className="tool-badge experimental">{effectiveStatus === "maintenance" ? t("قيد الصيانة", "Maintenance") : t("غير متاح", "Unavailable")}</span> : effectiveStatus === "beta" ? <span className="tool-badge improving">{t("تحت التحقق", "Beta")}</span> : <span className="tool-badge local"><LockKeyhole size={11}/>{t("جاهزة محليًا", "Ready locally")}</span>;
  const body = <><div className="tool-card-top"><span className={`tool-icon tool-icon-pro tool-tone-${visualTone} tool-${tool.slug}`} aria-hidden="true"><Icon size={21}/></span>{badge}</div><div><h3>{isArabic ? tool.labelAr : tool.labelEn}</h3><p>{isArabic ? tool.descriptionAr : tool.descriptionEn}</p><span className="tool-card-formats">{tool.formats.slice(0, 4).map((format) => <i key={format}>{format}</i>)}</span></div><span className="tool-card-go">{unavailable ? t("ستتوفر بعد التحقق", "Available after verification") : t("ابدأ الآن", "Start now")} {!unavailable && <><ArrowLeft size={15} className={isArabic ? "rotate-180" : ""}/></>}</span></>;
  return unavailable ? <div className="tool-card tool-card-unavailable" aria-disabled="true" style={{ "--delay": `${index * 35}ms` } as React.CSSProperties}>{body}</div> : <Link href={`/${tool.slug}`} className="tool-card" style={{ "--delay": `${index * 35}ms` } as React.CSSProperties}>{body}</Link>;
}
