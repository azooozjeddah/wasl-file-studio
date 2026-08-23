import { Button } from "@/components/ui/button";
import PublicLayout from "@/components/PublicLayout";
import SmartFileAssistant from "@/components/SmartFileAssistant";
import ToolCard from "@/components/ToolCard";
import { categories, featuredToolDefinitions, toolDefinitions } from "@/lib/tools";
import { useLocale } from "@/contexts/LocaleContext";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, Check, ChevronDown, FileImage, FileText, FileUp, LockKeyhole, Sparkles, WandSparkles } from "lucide-react";
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
    <section className="hero-section assistant-led-hero"><div className="hero-grid"/><div className="assistant-orbit assistant-orbit-one"/><div className="assistant-orbit assistant-orbit-two"/>
      <div className="container relative z-10 py-10 md:py-20">
        <div className="assistant-hero-layout">
          <div className="assistant-hero-copy">
            <div className="hero-kicker"><Sparkles size={15}/>{t("مساعد الملفات الذكي", "Smart File Assistant")}</div>
            <h1>{t("ارفع ملفك،", "Upload your file,")}<span>{t(" ووَصَل يعرف ماذا يحتاج.", " and Wasl knows what it needs.")}</span></h1>
            <p className="hero-copy">{t("ابدأ بالملف بدلًا من البحث بين الأدوات. يتعرف وَصَل على نوعه وخصائصه محليًا، ثم يضع أمامك الخطوة المناسبة فقط.", "Start with the file instead of searching through tools. Wasl recognizes its type and local properties, then shows only the right next step.")}</p>
            <div className="hero-trust"><span><Check size={15}/>{t("لا تسجيل مطلوب", "No sign-up")}</span><span><Check size={15}/>{t("تحليل محلي", "Local analysis")}</span><span><Check size={15}/>{t("اقتراحات واضحة", "Clear suggestions")}</span></div>
            {homeContent.data?.[0] && <p className="managed-home-notice">{homeContent.data[0].title}{homeContent.data[0].body ? ` — ${homeContent.data[0].body}` : ""}</p>}
            <div className="assistant-scenario-strip" aria-label={t("أنواع الملفات المدعومة في المساعد", "Supported file types in the assistant")}>
              <span><FileText size={15}/><b>PDF</b><small>{t("توقيع وتحويل", "Sign & convert")}</small></span>
              <span><FileText size={15}/><b>Word</b><small>{t("تحويل بصري", "Visual export")}</small></span>
              <span><FileImage size={15}/><b>{t("صورة", "Image")}</b><small>{t("ضغط وتعديل", "Compress & edit")}</small></span>
              <span><FileUp size={15}/><b>Excel</b><small>{t("أوراق وتحويل", "Sheets & export")}</small></span>
            </div>
          </div>
          <div className="assistant-hero-panel"><SmartFileAssistant tools={visibleTools}/></div>
        </div>
        <div className="assistant-hero-foot"><a href="#tools">{t("تفضّل اختيار الأداة بنفسك؟", "Prefer choosing a tool yourself?")} <b>{t("استعرض المكتبة", "Browse the library")}</b><ArrowLeft size={15} className={isArabic ? "rotate-180" : ""}/></a><span>{t("المساعد لا يرفع ملفك ولا يختار إجراءً بالنيابة عنك.", "The assistant never uploads your file or chooses an action for you.")}</span></div>
      </div><div className="hero-stat-card"><span>{t("ملفك أولًا", "Your file first")}</span><b>{t("خطوة أوضح كل مرة", "A clearer next step")}</b><div className="stat-wave"/></div>
    </section>
    {topAds.data?.map(slot => <ManagedAdSlot key={slot.id} label={slot.label}/>)}
    <section id="tools" className="tools-section container"><div className="section-heading"><div><span className="section-eyebrow">{t("المكتبة", "THE LIBRARY")}</span><h2>{t("اختر ما تحتاجه الآن", "Pick what you need now")}</h2></div><p>{t("ابدأ بنوع ملفك، ثم افتح أداة محددة لرفع الملف ومعالجته. الأدوات غير المستقرة تحمل حالة واضحة ولا تبدأ المعالجة تلقائيًا.", "Start with your file type, then open a specific tool to upload and process it. Unstable tools show a clear status and never start automatically.")}</p></div>
      <div id="categories" className="home-category-cards"><a href="#pdf"><FileText size={20}/><span>PDF</span><small>{t("دمج، تنظيم، تنقيح", "Merge, organize, redact")}</small></a><a href="#image"><FileImage size={20}/><span>{t("الصور", "Images")}</span><small>{t("تحويل، ضغط، تمويه", "Convert, compress, blur")}</small></a><a href="#document"><FileText size={20}/><span>{t("المستندات", "Documents")}</span><small>{t("Word، نص، تحويل", "Word, text, conversion")}</small></a></div>
      <div className="category-rail">{categories.map(cat => <a href={`#${cat.id}`} key={cat.id}><cat.icon size={17}/>{isArabic ? cat.labelAr : cat.labelEn}</a>)}</div>
      {categories.map(category => { const items = visibleTools.filter(tool => tool.category === category.id); if (!items.length) return null; return <div id={category.id} className="tool-category" key={category.id}><div className="tool-category-heading"><span className={`tool-icon tool-${category.id}`}><category.icon size={20}/></span><div><h3>{isArabic ? category.labelAr : category.labelEn}</h3><p>{t("اختر أداة ثم ارفع ملفك داخل الصفحة التالية", "Choose a tool, then upload inside the next page")}</p></div><span>{items.length} {t("أدوات", "tools")}</span></div><div className="tools-grid">{items.map((tool, index) => <ToolCard key={tool.slug} tool={tool} index={index}/>)}</div></div>;})}
    </section>
    <section className="featured-section"><div className="container"><div className="featured-head"><div><span className="section-eyebrow"><WandSparkles size={14}/>{t("الأكثر استخدامًا", "MOST USED")}</span><h2>{t("ابدأ من هنا", "Start here")}</h2></div><a href="#tools">{t("كل الأدوات", "All tools")}<ArrowLeft size={16} className={isArabic ? "rotate-180" : ""}/></a></div><div className="featured-grid">{visiblePopular.map((tool, index) => <ToolCard key={tool.slug} tool={tool} index={index}/>)}</div></div></section>
    <section id="privacy" className="container privacy-section"><div className="privacy-emblem"><LockKeyhole size={28}/></div><div><span className="section-eyebrow">{t("الخصوصية أولًا", "PRIVACY FIRST")}</span><h2>{t("ملفاتك لا تغادر جهازك في الأدوات المحلية.", "Your files stay on your device with local tools.")}</h2></div><p>{t("نوضح في كل صفحة أداة أين تتم المعالجة وحدودها قبل أن تبدأ. لا نخزّن محتوى ملفاتك في أدوات المعالجة المحلية.", "Every tool explains its processing location and limits before you start. Local tools do not store your file content.")}</p><Link href="/privacy"><Button variant="outline">{t("مركز الخصوصية", "Privacy center")}</Button></Link></section>
    <section id="faq" className="container faq-section"><div><span className="section-eyebrow">FAQ</span><h2>{t("أسئلة واضحة، إجابات واضحة.", "Clear questions. Clear answers.")}</h2></div><div className="faq-list">{managedFaq.data?.length ? managedFaq.data.map((item, index) => <details key={item.id} open={index === 0}><summary>{item.question}</summary><p>{item.answer}</p></details>) : <DefaultFaq t={t}/>}</div></section>
  </main></PublicLayout>;
}

function ManagedAdSlot({ label }: { label: string }) { return <div className="container managed-ad-slot" role="complementary" aria-label="advertising slot"><span>مساحة إعلان مهيأة</span><b>{label}</b><small>لا يظهر محتوى إعلان أو شيفرة طرف ثالث حتى تتم إضافته من الإدارة مستقبلًا.</small></div>; }
function DefaultFaq({ t }: { t: (ar: string, en: string) => string }) { return <><details open><summary>{t("هل ترفعون ملفي إلى خادم؟", "Do you upload my file?")}</summary><p>{t("لا في الأدوات المعلّمة بمعالجة محلية؛ تعمل داخل متصفحك. نوضح أي معالجة مختلفة بوضوح قبل الاستخدام.", "Not for tools labeled Local: they run in your browser. We clearly label any different processing before use.")}</p></details><details><summary>{t("هل كل التحويلات متطابقة 100%؟", "Are all conversions 100% identical?")}</summary><p>{t("عمليات PDF والصور قوية محليًا. أما تحويل DOCX وPDF المعقد فيعمل بأفضل جهد محلي ولا نعد بتطابق التخطيط.", "PDF and image operations are strong locally. Complex DOCX/PDF conversion is best-effort locally, without a false layout-match promise.")}</p></details><details><summary>{t("هل أحتاج إلى حساب؟", "Do I need an account?")}</summary><p>{t("لا. الأدوات الأساسية متاحة من دون تسجيل دخول. الدخول مطلوب فقط لإدارة المنصة.", "No. Core tools do not require an account. Sign-in is reserved for platform administration.")}</p></details></>; }
