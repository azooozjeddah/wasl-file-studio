import PublicLayout from "@/components/PublicLayout";
import { useLocale } from "@/contexts/LocaleContext";
import { trpc } from "@/lib/trpc";
import { findSiteCategory, siteToolCategories, toolsForSiteCategory } from "@/lib/site-categories";
import { toolDefinitions } from "@/lib/tools";
import { ArrowLeft, Sparkles } from "lucide-react";
import { Link } from "wouter";
import "./tool-categories.css";
import "./category-polish.css";

export default function ToolsIndexPage() {
  const { isArabic, t } = useLocale();
  const catalog = trpc.catalog.list.useQuery();
  const activeSlugs = new Set((catalog.data ? catalog.data : toolDefinitions).map((tool: { slug: string }) => tool.slug));
  const categories = siteToolCategories.filter((category) => toolsForSiteCategory(category.id, toolDefinitions).some((tool) => activeSlugs.has(tool.slug)));

  return <PublicLayout><main className="category-index-page"><section className="category-index-hero"><div className="container"><span className="category-kicker"><Sparkles size={14}/>{t("مكتبة وصّل", "WASL LIBRARY")}</span><h1>{t("كل أداة في مكان واضح.", "Every tool in a clear place.")}</h1><p>{t("اختر تصنيفًا واحدًا، ثم افتح الأداة المناسبة. لا نكرر المكتبة كاملة في الصفحة الرئيسية.", "Choose one category, then open the tool you need. The full library is not repeated on the homepage.")}</p></div></section><section className="container category-directory" aria-label={t("تصنيفات الأدوات", "Tool categories")}><div className="category-directory-grid">{categories.map((category) => { const Icon = category.icon; return <Link href={`/tools/${category.slug}`} className={`category-directory-card tone-${category.tone}`} key={category.id}><span className="category-directory-icon"><Icon size={25}/></span><div><h2>{isArabic ? category.labelAr : category.labelEn}</h2><p>{isArabic ? category.descriptionAr : category.descriptionEn}</p></div><span className="category-directory-go" aria-hidden="true"><ArrowLeft size={17} className={isArabic ? "rotate-180" : ""}/></span></Link>; })}</div></section></main></PublicLayout>;
}
