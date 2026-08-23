import PublicLayout from "@/components/PublicLayout";
import SmartFileAssistant from "@/components/SmartFileAssistant";
import { siteToolCategories, toolsForSiteCategory } from "@/lib/site-categories";
import { toolDefinitions } from "@/lib/tools";
import { useLocale } from "@/contexts/LocaleContext";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, Check, FileImage, FileText, FileUp, QrCode, Sparkles } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { useEffect } from "react";
import ToolCard from "@/components/ToolCard";
import "./assistant-home.css";
import "./qr-compact.css";
import "./category-polish.css";

export default function Home() {
  const { isArabic, t } = useLocale();
  const [, navigate] = useLocation();
  const { user, loading } = useAuth();
  const catalog = trpc.catalog.list.useQuery();
  const managedFaq = trpc.catalog.publicFaq.useQuery({ locale: isArabic ? "ar" : "en" });
  const homeContent = trpc.catalog.publicContent.useQuery({ contentKey: "home_notice", locale: isArabic ? "ar" : "en" });
  const topAds = trpc.catalog.publicAdSlots.useQuery({ placement: "home_top" });

  useEffect(() => { if (!loading && user) navigate("/dashboard"); }, [loading, navigate, user]);
  if (user) return null;

  const builtInSlugs = ["qr-generator", "qr-reader", "sign-pdf", "file-hash"];
  const activeSlugs = new Set((catalog.data?.length ? catalog.data : toolDefinitions).map((tool: { slug: string }) => tool.slug).concat(builtInSlugs));
  const visibleTools = toolDefinitions.filter(tool => activeSlugs.has(tool.slug));
  const visibleCategories = siteToolCategories.filter((category) => toolsForSiteCategory(category.id, visibleTools).length > 0);
  const featuredSlugs = ["compress-pdf", "word-to-pdf", "sign-pdf", "ocr"];
  const featuredTools = featuredSlugs.map((slug) => visibleTools.find((tool) => tool.slug === slug)).filter(Boolean) as typeof visibleTools;
  const qrTool = visibleTools.find((tool) => tool.slug === "qr-generator");

  return <PublicLayout><main>
    <section id="assistant" className="hero-section assistant-led-hero"><div className="hero-grid"/><div className="assistant-orbit assistant-orbit-one"/><div className="assistant-orbit assistant-orbit-two"/>
      <div className="container relative z-10 py-10 md:py-20">
        <div className="assistant-hero-layout">
          <div className="assistant-hero-copy">
            <div className="hero-kicker"><Sparkles size={15}/>{t("المساعد الذكي", "Smart Assistant")}</div>
            <h1>{t("ارفع ملفك،", "Upload your file,")}<span>{t(" وصّل يعرف ماذا يحتاج.", " and Wasl knows what it needs.")}</span></h1>
            <p className="hero-copy">{t("حلّل ملفك محليًا، ثم انتقل مباشرةً إلى أداة جاهزة مناسبة له. لا نطلب منك البحث بين عشرات الخيارات أو رفع الملف مرتين.", "Analyze your file locally, then move directly into a ready tool that fits it. No searching through dozens of choices or uploading twice.")}</p>
            <div className="hero-trust"><span><Check size={15}/>{t("لا تسجيل مطلوب", "No sign-up")}</span><span><Check size={15}/>{t("تحليل محلي", "Local analysis")}</span><span><Check size={15}/>{t("اقتراحات واضحة", "Clear suggestions")}</span></div>
            {homeContent.data?.[0] && <p className="managed-home-notice">{homeContent.data[0].title}{homeContent.data[0].body ? ` — ${homeContent.data[0].body}` : ""}</p>}
            <div className="assistant-scenario-strip" aria-label={t("أنواع الملفات المدعومة في المساعد", "Supported file types in the assistant")}>
              <span><FileText size={15}/><b>PDF</b><small>{t("توقيع، ضغط، تنظيم", "Sign, compress, organize")}</small></span>
              <span><FileText size={15}/><b>Word</b><small>{t("تحويل إلى PDF", "Export to PDF")}</small></span>
              <span><FileImage size={15}/><b>{t("الصور", "Images")}</b><small>{t("ضغط، قياس، تحويل", "Compress, resize, convert")}</small></span>
              <span><FileUp size={15}/><b>Excel</b><small>{t("أوراق وتحويل", "Sheets & export")}</small></span>
            </div>
          </div>
          <div className="assistant-hero-panel"><SmartFileAssistant tools={visibleTools}/></div>
        </div>
        <div className="assistant-hero-foot"><a href="#tools">{t("تفضّل اختيار الأداة بنفسك؟", "Prefer choosing a tool yourself?")} <b>{t("استعرض المكتبة", "Browse the library")}</b><ArrowLeft size={15} className={isArabic ? "rotate-180" : ""}/></a><span>{t("المساعد لا يرفع ملفك ولا يختار إجراءً بالنيابة عنك.", "The assistant never uploads your file or chooses an action for you.")}</span></div>
      </div><div className="hero-stat-card"><span>{t("ملفك أولًا", "Your file first")}</span><b>{t("خطوة أوضح كل مرة", "A clearer next step")}</b><div className="stat-wave"/></div>
    </section>
    {topAds.data?.map(slot => <ManagedAdSlot key={slot.id} label={slot.label}/>)}
    <section className="container home-featured-section" aria-labelledby="featured-tools-title">
      <div className="section-heading home-featured-heading"><div><span className="section-eyebrow">{t("وصول سريع", "QUICK ACCESS")}</span><h2 id="featured-tools-title">{t("ابدأ بأدوات تحتاجها غالبًا", "Start with the tools you use most")}</h2></div><p>{t("اختر أداة شائعة مباشرة، أو ابدأ بالملف في المساعد ليقترح الخطوة الأنسب لك.", "Open a common tool directly, or start with your file and let the assistant recommend the right next step.")}</p></div>
      <div className="home-featured-layout">
        <div className="home-featured-grid">{featuredTools.map((tool, index) => <ToolCard tool={tool} index={index} key={tool.slug}/>)}</div>
        {qrTool && <aside className="qr-home-spotlight" aria-label={t("وصول سريع إلى منشئ QR", "Quick access to QR generator")}><div className="qr-spotlight-top"><span><QrCode size={28}/></span><i>{t("معاينة قابلة للمسح", "SCANNABLE PREVIEW")}</i></div><div><small>{t("رموز QR", "QR CODES")}</small><h3>{t("أنشئ رمز QR يليق بمحتواك", "Create a QR code that fits your content")}</h3><p>{t("صمّم رمزك بقوالب وإطارات احترافية، ثم عاينه قبل التنزيل.", "Style your code with professional templates and frames, then preview it before download.")}</p></div><div className="qr-spotlight-preview" aria-hidden="true"><div className="qr-preview-code"><QrCode size={84}/><b>QR</b></div><div className="qr-preview-controls"><span>{t("معاينة مباشرة", "Live preview")}</span><i>{Array.from({ length: 5 }).map((_, index) => <b key={index}/>)}</i><small>{t("قوالب · ألوان · إطارات", "Templates · Colors · Frames")}</small></div></div><Link href={`/${qrTool.slug}`} className="qr-spotlight-link">{t("افتح منشئ QR", "Open QR generator")}<ArrowLeft size={16} className={isArabic ? "rotate-180" : ""}/></Link></aside>}
      </div>
    </section>
    <section id="tools" className="tools-section container"><div className="section-heading"><div><span className="section-eyebrow">{t("اختر تصنيفًا", "CHOOSE A CATEGORY")}</span><h2>{t("أدواتك مرتبة بوضوح", "Your tools, clearly organized")}</h2></div><p>{t("تظهر الصفحة الرئيسية التصنيفات فقط. افتح التصنيف للوصول إلى كل أدواته دون تكرار أو تمرير طويل.", "The homepage shows categories only. Open one to reach all of its tools without duplication or a long scroll.")}</p></div><div id="categories" className="home-category-cards home-category-cards-short">{visibleCategories.map(category => { const Icon = category.icon; return <Link href={`/tools/${category.slug}`} key={category.id} className={`home-category-card tone-${category.tone}`}><span><Icon size={22}/></span><div><b>{isArabic ? category.labelAr : category.labelEn}</b><small>{isArabic ? category.descriptionAr : category.descriptionEn}</small></div><ArrowLeft size={16} className={isArabic ? "rotate-180" : ""}/></Link>;})}</div><Link href="/tools" className="home-tools-directory-link">{t("استعرض كل التصنيفات", "Browse all categories")}<ArrowLeft size={16} className={isArabic ? "rotate-180" : ""}/></Link></section>
    <section id="pricing" className="container pricing-note"><span>{t("الأسعار", "PRICING")}</span><b>{t("الأدوات الأساسية متاحة الآن للاستخدام المحلي دون دفع مفعّل داخل المنصة.", "Core tools are currently available for local use with no payment enabled inside the platform.")}</b><a href="#assistant">{t("ابدأ بملف", "Start with a file")}<ArrowLeft size={15} className={isArabic ? "rotate-180" : ""}/></a></section>
    <section id="faq" className="container faq-section faq-section-compact"><div><span className="section-eyebrow">FAQ</span><h2>{t("أسئلة واضحة، إجابات واضحة.", "Clear questions. Clear answers.")}</h2></div><div className="faq-list">{managedFaq.data?.length ? managedFaq.data.slice(0, 4).map((item, index) => <details key={item.id} open={index === 0}><summary>{item.question}</summary><p>{item.answer}</p></details>) : <DefaultFaq t={t}/>}</div></section>
  </main></PublicLayout>;
}

function ManagedAdSlot({ label }: { label: string }) { return <div className="container managed-ad-slot" role="complementary" aria-label="advertising slot"><span>مساحة إعلان مهيأة</span><b>{label}</b><small>لا يظهر محتوى إعلان أو شيفرة طرف ثالث حتى تتم إضافته من الإدارة مستقبلًا.</small></div>; }
function DefaultFaq({ t }: { t: (ar: string, en: string) => string }) { return <><details open><summary>{t("هل ترفعون ملفي إلى خادم؟", "Do you upload my file?")}</summary><p>{t("لا في الأدوات المعلّمة بمعالجة محلية؛ تعمل داخل متصفحك. نوضح أي معالجة مختلفة بوضوح قبل الاستخدام.", "Not for tools labeled Local: they run in your browser. We clearly label any different processing before use.")}</p></details><details><summary>{t("هل كل التحويلات متطابقة 100%؟", "Are all conversions 100% identical?")}</summary><p>{t("عمليات PDF والصور قوية محليًا. أما تحويل DOCX وPDF المعقد فيعمل بأفضل جهد محلي ولا نعد بتطابق التخطيط.", "PDF and image operations are strong locally. Complex DOCX/PDF conversion is best-effort locally, without a false layout-match promise.")}</p></details><details><summary>{t("هل أحتاج إلى حساب؟", "Do I need an account?")}</summary><p>{t("لا. الأدوات الأساسية متاحة من دون تسجيل دخول. الدخول مطلوب فقط لإدارة المنصة.", "No. Core tools do not require an account. Sign-in is reserved for platform administration.")}</p></details></>; }
