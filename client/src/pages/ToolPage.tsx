import PublicLayout from "@/components/PublicLayout";
import { Button } from "@/components/ui/button";
import DxfWorkspace from "@/components/DxfWorkspace";
import ExcelWorkspace from "@/components/ExcelWorkspace";
import ToolWorkspace from "@/components/ToolWorkspace";
import { useLocale } from "@/contexts/LocaleContext";
import { findTool, toolIconFor } from "@/lib/tools";
import { toolVisualTone } from "@/lib/tool-visuals";
import { trpc } from "@/lib/trpc";
import { AlertTriangle, CheckCircle2, FileSearch, LockKeyhole } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useEffect } from "react";
import NotFound from "./NotFound";

export default function ToolPage() {
  const [location] = useLocation();
  const tool = findTool(location.slice(1));
  const { isArabic, t } = useLocale();
  const catalog = trpc.catalog.list.useQuery();
  const availability = trpc.catalog.availability.useQuery({ slug: tool?.slug || "unknown" }, { enabled: Boolean(tool) });
  const ads = trpc.catalog.publicAdSlots.useQuery({ placement: "tool_top" });
  const record = catalog.data?.find(item => item.slug === tool?.slug);
  const catalogHasEntries = Boolean(catalog.data?.length);
  const lifecycleStatus = availability.data?.lifecycleStatus ?? record?.lifecycleStatus;
  const inMaintenance = lifecycleStatus === "maintenance";
  const disabled = Boolean(availability.data && (!availability.data.isActive || availability.data.isAllowed === false || lifecycleStatus === "disabled" || inMaintenance));
  const name = record ? (isArabic ? record.nameAr : record.nameEn) : availability.data ? (isArabic ? availability.data.nameAr : availability.data.nameEn) : tool ? (isArabic ? tool.labelAr : tool.labelEn) : "";
  const description = record ? (isArabic ? record.descriptionAr : record.descriptionEn) || (isArabic ? tool?.descriptionAr : tool?.descriptionEn) || "" : tool ? (isArabic ? tool.descriptionAr : tool.descriptionEn) : "";
  const formats = record?.supportedFormats || tool?.formats || [];

  useEffect(() => {
    if (!tool) return;
    const title = (isArabic ? record?.seoTitleAr : record?.seoTitleEn) || `${name} | وَصل للملفات`;
    const metaDescription = (isArabic ? record?.seoDescriptionAr : record?.seoDescriptionEn) || description;
    document.title = title;
    let meta = document.querySelector('meta[name="description"]');
    if (!meta) { meta = document.createElement("meta"); meta.setAttribute("name", "description"); document.head.appendChild(meta); }
    meta.setAttribute("content", metaDescription);
    document.querySelector('link[rel="canonical"]')?.setAttribute("href", `${window.location.origin}${location}`);
  }, [tool, record, isArabic, location, name, description]);

  if (!tool) return <NotFound/>;
  if (availability.isLoading) return <PublicLayout><main className="tool-page"><div className="container"><section className="mx-auto my-16 max-w-xl rounded-3xl border bg-card p-8 text-center shadow-sm"><span className="section-eyebrow">{t("جارٍ التحقق", "CHECKING STATUS")}</span><h1 className="mt-3 text-2xl font-bold">{name}</h1><p className="mt-3 leading-7 text-muted-foreground">{t("جارٍ التحقق من حالة الأداة قبل فتح مساحة المعالجة.", "Checking this tool's status before opening the workspace.")}</p></section></div></main></PublicLayout>;
  if (!disabled && catalogHasEntries && !record && !availability.data) return <NotFound/>;
  if (disabled) return <PublicLayout><main className="tool-page"><div className="container"><section className="mx-auto my-16 max-w-xl rounded-3xl border bg-card p-8 text-center shadow-sm"><LockKeyhole className="mx-auto mb-4 text-violet-600" size={30}/><span className="section-eyebrow">{inMaintenance ? "قيد الصيانة" : "غير متاحة"}</span><h1 className="mt-3 text-2xl font-bold">{inMaintenance ? "هذه الأداة قيد الصيانة حاليًا" : "هذه الأداة غير متاحة حاليًا"}</h1><p className="mt-3 leading-7 text-muted-foreground">{availability.data?.isAllowed === false ? "هذه الأداة غير مسموحة لحسابك حاليًا. تواصل مع مدير وَصل إذا احتجتها." : inMaintenance ? "أوقفنا المعالجة مؤقتًا حتى يكتمل اختبار المحرك والنتائج. لم تتم معالجة أي ملف." : `تم إيقاف ${name} مؤقتًا للصيانة أو الإدارة. لم تتم معالجة أي ملف، ويمكنك العودة إلى قائمة الأدوات واختيار أداة أخرى.`}</p><Button className="mt-6" asChild><Link href="/#tools">العودة إلى جميع الأدوات</Link></Button></section></div></main></PublicLayout>;

  const Icon = toolIconFor(tool.slug, tool.icon);
  const visualTone = toolVisualTone(tool.slug, tool.category);
  if (lifecycleStatus === "beta") return <PublicLayout><main className="tool-page"><div className="container"><section className="mx-auto my-16 max-w-xl rounded-3xl border bg-card p-8 text-center shadow-sm"><AlertTriangle className="mx-auto mb-4 text-amber-600" size={30}/><span className="section-eyebrow">{t("قريبًا", "COMING SOON")}</span><h1 className="mt-3 text-2xl font-bold">{name}</h1><p className="mt-3 leading-7 text-muted-foreground">{t("هذه الأداة مؤجلة حتى تكتمل مراجعة مسار محلي موثوق. لم نفتح مساحة رفع أو معالجة حتى لا تبدو الأداة جاهزة قبل التحقق منها.", "This tool is deferred until a reliable local path is verified. Upload and processing are intentionally unavailable so it is not presented as ready.")}</p><Button className="mt-6" asChild><Link href="/#tools">{t("العودة إلى جميع الأدوات", "Back to all tools")}</Link></Button></section></div></main></PublicLayout>;
  const localAnswer = tool.local ? t("تعمل هذه الأداة محليًا داخل متصفحك ولا تُرفع ملفاتها من أجل التحويل.", "This tool runs locally in your browser and does not upload files for conversion.") : t("يعرض الموقع بوضوح طريقة المعالجة قبل بدء الاستخدام.", "The site clearly explains processing mode before use.");
  const faq = { "@context": "https://schema.org", "@type": "FAQPage", mainEntity: [{ "@type": "Question", name: t(`كيف تعمل أداة ${name}؟`, `How does ${name} work?`), acceptedAnswer: { "@type": "Answer", text: t("اختر الملفات، عدّل الإعدادات المتاحة، ثم نزّل النتيجة التي ينشئها المتصفح.", "Choose files, adjust available settings, then download the result generated by the browser.") } }, { "@type": "Question", name: t("هل الملف آمن؟", "Is the file safe?"), acceptedAnswer: { "@type": "Answer", text: localAnswer } }, { "@type": "Question", name: t("ما الصيغ المدعومة؟", "Which formats are supported?"), acceptedAnswer: { "@type": "Answer", text: formats.join(", ") } }] };

  return <PublicLayout><main className="tool-page"><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faq) }}/><div className="container"><div className="tool-breadcrumb"><Link href="/">{t("الرئيسية", "Home")}</Link><span>/</span><Link href="/#tools">{t("الأدوات", "Tools")}</Link><span>/</span><b>{name}</b></div><section className="tool-hero"><span className={`tool-icon tool-icon-pro tool-tone-${visualTone}`}><Icon size={22}/></span><div><span className="section-eyebrow">{`${tool.category.toUpperCase()} · ${tool.local ? t("محلي", "LOCAL") : t("قريبًا", "SOON")}`}</span><h1>{name}</h1><p>{description}</p></div></section>{ads.data?.map(slot => <div className="managed-ad-slot tool-ad-slot" key={slot.id}><span>مساحة إعلان مهيأة</span><b>{slot.label}</b><small>لا يُدرج محتوى إعلاني أو تتبع طرف ثالث في هذه المرحلة.</small></div>)}{tool.slug === "dxf-to-pdf" ? <DxfWorkspace/> : tool.category === "spreadsheet" ? <ExcelWorkspace tool={tool}/> : <ToolWorkspace tool={tool}/>}<section className="tool-explainer"><div><FileSearch size={20}/><h2>{t("كيف تعمل الأداة؟", "How this tool works")}</h2><p>{t("اختر الملف، اضبط الإعدادات، ثم ابدأ المعالجة. النتيجة تُجهز داخل المتصفح لتتمكن من تنزيلها فورًا.", "Choose your file, configure the settings, then process. Your result is prepared inside the browser for immediate download.")}</p></div><div><LockKeyhole size={20}/><h2>{t("هل الملف آمن؟", "Is the file safe?")}</h2><p>{localAnswer}</p></div><div><CheckCircle2 size={20}/><h2>{t("الصيغ المدعومة", "Supported formats")}</h2><p>{formats.join(" · ")}</p></div></section></div></main></PublicLayout>;
}
