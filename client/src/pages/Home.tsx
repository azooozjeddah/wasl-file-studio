import { Button } from "@/components/ui/button";
import PublicLayout from "@/components/PublicLayout";
import SmartFileAssistant from "@/components/SmartFileAssistant";
import ToolCard from "@/components/ToolCard";
import { categories, featuredToolDefinitions, toolDefinitions } from "@/lib/tools";
import { useLocale } from "@/contexts/LocaleContext";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, BriefcaseBusiness, Check, ChevronDown, FileImage, FileText, FileUp, LockKeyhole, QrCode, ShieldCheck, Sparkles, WandSparkles } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { useEffect } from "react";
import "./assistant-home.css";

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
  const visiblePopular = featuredToolDefinitions.filter(tool => visibleTools.some(item => item.slug === tool.slug));

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
    <section id="tools" className="tools-section container"><div className="section-heading"><div><span className="section-eyebrow">{t("كل الملفات، في مكان واحد", "ALL FILES, ONE PLACE")}</span><h2>{t("جميع أدوات الملفات", "All file tools")}</h2></div><p>{t("ابدأ بالمساعد أو انتقل مباشرةً إلى فئة واضحة. لا تظهر الأداة كجاهزة إلا عندما يكون لها مسار فعلي داخل المنصة.", "Start with the assistant or go directly to a clear category. A tool is shown ready only when it has a real path in the platform.")}</p></div>
      <div id="categories" className="home-category-cards">{categories.filter(category => ["pdf", "document", "spreadsheet", "image", "code", "utility"].includes(category.id)).map(category => <a href={`#${category.id}`} key={category.id}><category.icon size={21}/><span>{isArabic ? category.labelAr : category.labelEn}</span><small>{visibleTools.filter(tool => tool.category === category.id).length} {t("أدوات", "tools")}</small></a>)}</div>
      <div className="category-rail">{categories.map(cat => <a href={`#${cat.id}`} key={cat.id}><cat.icon size={17}/>{isArabic ? cat.labelAr : cat.labelEn}</a>)}</div>
      {categories.map(category => { const items = visibleTools.filter(tool => tool.category === category.id); if (!items.length) return null; return <div id={category.id} className="tool-category" key={category.id}><div className="tool-category-heading"><span className={`tool-icon tool-${category.id}`}><category.icon size={20}/></span><div><h3>{isArabic ? category.labelAr : category.labelEn}</h3><p>{t("اختر أداة ثم ارفع ملفك داخل الصفحة التالية", "Choose a tool, then upload inside the next page")}</p></div><span>{items.length} {t("أدوات", "tools")}</span></div><div className="tools-grid">{items.map((tool, index) => <ToolCard key={tool.slug} tool={tool} index={index}/>)}</div></div>;})}
    </section>
    <section className="featured-section"><div className="container"><div className="featured-head"><div><span className="section-eyebrow"><WandSparkles size={14}/>{t("الأكثر استخدامًا", "MOST USED")}</span><h2>{t("ابدأ من هنا", "Start here")}</h2></div><a href="#tools">{t("كل الأدوات", "All tools")}<ArrowLeft size={16} className={isArabic ? "rotate-180" : ""}/></a></div><div className="featured-grid">{visiblePopular.map((tool, index) => <ToolCard key={tool.slug} tool={tool} index={index}/>)}</div></div></section>
    <section className="container qr-home-spotlight"><div className="qr-home-copy"><span className="section-eyebrow"><QrCode size={14}/>{t("رموز QR", "QR CODES")}</span><h2>{t("أنشئ رمز QR يليق بمحتواك", "Create a QR code made for your content")}</h2><p>{t("اختر من قوالب وإطارات وتصاميم متحققة محليًا، عاين النتيجة فورًا ونزّلها كـ PNG أو SVG أو PDF عند توفرها.", "Choose local verified templates, frames, and styles, preview instantly, then download as PNG, SVG, or PDF where available.")}</p><Link href="/qr-generator"><Button className="qr-home-cta"><QrCode size={17}/>{t("افتح منشئ QR", "Open QR generator")}</Button></Link></div><div className="qr-home-preview" aria-label={t("معاينة منشئ QR", "QR generator preview")}><div className="qr-symbol"><QrCode size={128}/><span>وصّل</span></div><div className="qr-preview-meta"><b>{t("تم التحقق محليًا", "Verified locally")}</b><span><ShieldCheck size={14}/>{t("قابل للمسح", "Scannable")}</span><div><i/><i/><i/><i/></div></div></div></section>
    <section id="business" className="container business-section"><div className="business-icon"><BriefcaseBusiness size={28}/></div><div><span className="section-eyebrow">{t("حلول الأعمال", "BUSINESS SOLUTIONS")}</span><h2>{t("مسار أوضح للملفات المتكررة", "A clearer flow for recurring files")}</h2></div><p>{t("نظّم أعمالك حول أدوات الملفات الحالية: اختيار الأداة، المعالجة المحلية، ثم تنزيل النتيجة. لا ندّعي خدمة مؤسسية غير مفعلة، لكن نبني تجربة يمكن التوسع عليها بثقة.", "Organize recurring work around the tools available today: choose a tool, process locally, then download the result. We do not claim an inactive enterprise service, but the experience is structured to grow reliably.")}</p></section>
    <section id="pricing" className="container pricing-note"><span>{t("الأسعار", "PRICING")}</span><b>{t("الأدوات الأساسية متاحة الآن للاستخدام المحلي دون دفع مفعّل داخل المنصة.", "Core tools are currently available for local use with no payment enabled inside the platform.")}</b><a href="#assistant">{t("ابدأ بملف", "Start with a file")}<ArrowLeft size={15} className={isArabic ? "rotate-180" : ""}/></a></section>
    <section id="privacy" className="container privacy-section"><div className="privacy-emblem"><LockKeyhole size={28}/></div><div><span className="section-eyebrow">{t("الخصوصية أولًا", "PRIVACY FIRST")}</span><h2>{t("ملفاتك لا تغادر جهازك في الأدوات المحلية.", "Your files stay on your device with local tools.")}</h2></div><p>{t("نوضح في كل صفحة أداة أين تتم المعالجة وحدودها قبل أن تبدأ. لا نخزّن محتوى ملفاتك في أدوات المعالجة المحلية.", "Every tool explains its processing location and limits before you start. Local tools do not store your file content.")}</p><Link href="/privacy"><Button variant="outline">{t("مركز الخصوصية", "Privacy center")}</Button></Link></section>
    <section id="faq" className="container faq-section"><div><span className="section-eyebrow">FAQ</span><h2>{t("أسئلة واضحة، إجابات واضحة.", "Clear questions. Clear answers.")}</h2></div><div className="faq-list">{managedFaq.data?.length ? managedFaq.data.map((item, index) => <details key={item.id} open={index === 0}><summary>{item.question}</summary><p>{item.answer}</p></details>) : <DefaultFaq t={t}/>}</div></section>
  </main></PublicLayout>;
}

function ManagedAdSlot({ label }: { label: string }) { return <div className="container managed-ad-slot" role="complementary" aria-label="advertising slot"><span>مساحة إعلان مهيأة</span><b>{label}</b><small>لا يظهر محتوى إعلان أو شيفرة طرف ثالث حتى تتم إضافته من الإدارة مستقبلًا.</small></div>; }
function DefaultFaq({ t }: { t: (ar: string, en: string) => string }) { return <><details open><summary>{t("هل ترفعون ملفي إلى خادم؟", "Do you upload my file?")}</summary><p>{t("لا في الأدوات المعلّمة بمعالجة محلية؛ تعمل داخل متصفحك. نوضح أي معالجة مختلفة بوضوح قبل الاستخدام.", "Not for tools labeled Local: they run in your browser. We clearly label any different processing before use.")}</p></details><details><summary>{t("هل كل التحويلات متطابقة 100%؟", "Are all conversions 100% identical?")}</summary><p>{t("عمليات PDF والصور قوية محليًا. أما تحويل DOCX وPDF المعقد فيعمل بأفضل جهد محلي ولا نعد بتطابق التخطيط.", "PDF and image operations are strong locally. Complex DOCX/PDF conversion is best-effort locally, without a false layout-match promise.")}</p></details><details><summary>{t("هل أحتاج إلى حساب؟", "Do I need an account?")}</summary><p>{t("لا. الأدوات الأساسية متاحة من دون تسجيل دخول. الدخول مطلوب فقط لإدارة المنصة.", "No. Core tools do not require an account. Sign-in is reserved for platform administration.")}</p></details></>; }
