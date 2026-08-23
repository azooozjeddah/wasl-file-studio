import PublicLayout from "@/components/PublicLayout";
import ToolCard from "@/components/ToolCard";
import { useLocale } from "@/contexts/LocaleContext";
import { trpc } from "@/lib/trpc";
import { findSiteCategory, toolsForSiteCategory } from "@/lib/site-categories";
import { toolDefinitions } from "@/lib/tools";
import { ArrowLeft, Check, Sparkles } from "lucide-react";
import { Link, useRoute } from "wouter";
import "./tool-categories.css";
import "./category-polish.css";

export default function ToolCategoryPage() {
  const { isArabic, t } = useLocale();
  const [, params] = useRoute("/tools/:categorySlug");
  const category = findSiteCategory(params?.categorySlug || "");
  const catalog = trpc.catalog.list.useQuery();
  if (!category) return <PublicLayout><main className="category-empty container"><h1>{t("هذا التصنيف غير متاح", "This category is unavailable")}</h1><Link href="/tools">{t("العودة إلى الأدوات", "Back to tools")}</Link></main></PublicLayout>;
  const activeSlugs = new Set((catalog.data ? catalog.data : toolDefinitions).map((tool: { slug: string }) => tool.slug));
  const tools = toolsForSiteCategory(category.id, toolDefinitions).filter((tool) => activeSlugs.has(tool.slug));
  const Icon = category.icon;
  return <PublicLayout><main className="category-page"><section className={`category-page-hero tone-${category.tone}`}><div className="container"><Link href="/tools" className="category-back"><ArrowLeft size={16} className={isArabic ? "rotate-180" : ""}/>{t("كل التصنيفات", "All categories")}</Link><div className="category-page-title"><span><Icon size={29}/></span><div><p>{t("تصنيف الأدوات", "TOOL CATEGORY")}</p><h1>{isArabic ? category.labelAr : category.labelEn}</h1><b>{isArabic ? category.descriptionAr : category.descriptionEn}</b></div></div><div className="category-page-meta"><span><Check size={15}/>{tools.length} {t("أدوات ضمن هذا التصنيف", "tools in this category")}</span><span><Check size={15}/>{t("كل أداة تظهر مرة واحدة فقط", "Every tool appears only once")}</span></div></div></section><section className="container category-tools"><div className="category-tools-head"><div><span className="section-eyebrow"><Sparkles size={14}/>{t("ابدأ الآن", "START NOW")}</span><h2>{t("اختر الأداة المناسبة", "Choose the right tool")}</h2></div><p>{t("توضح البطاقة صيغ الإدخال وحالة الجاهزية قبل فتح الأداة.", "Each card shows input formats and readiness before you open it.")}</p></div><div className="tools-grid category-tools-grid">{tools.map((tool, index) => <ToolCard key={tool.slug} tool={tool} index={index}/>)}</div></section></main></PublicLayout>;
}
