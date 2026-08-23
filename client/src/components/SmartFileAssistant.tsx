import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import { CheckCircle2, ChevronLeft, FileCheck2, FileImage, FileSearch, FileSpreadsheet, FileText, FileUp, ShieldCheck, Sparkles, X } from "lucide-react";
import { formatBytes } from "@/lib/file-utils";
import { isSingleFileReadyAssistantTool, matchesToolInput, prepareFileForTool } from "@/lib/file-handoff";
import type { ToolDefinition } from "@/lib/tools";
import { useLocale } from "@/contexts/LocaleContext";

type FileInsight = { labelAr: string; labelEn: string; value: string; icon: "pages" | "image" | "sheet" | "document" };

function extensionOf(file: File) { return file.name.includes(".") ? file.name.split(".").pop()?.toUpperCase() || "" : ""; }
function labelFor(file: File, isArabic: boolean) {
  const ext = extensionOf(file);
  if (file.type === "application/pdf" || ext === "PDF") return isArabic ? "ملف PDF" : "PDF file";
  if (file.type.startsWith("image/")) return isArabic ? "صورة" : "Image";
  if (["DOC", "DOCX"].includes(ext)) return isArabic ? "مستند Word" : "Word document";
  if (["XLS", "XLSX", "CSV"].includes(ext)) return isArabic ? "ملف Excel أو جدول" : "Spreadsheet";
  if (["PPT", "PPTX"].includes(ext)) return isArabic ? "عرض PowerPoint" : "PowerPoint presentation";
  if (file.type.startsWith("text/")) return isArabic ? "ملف نصي" : "Text file";
  return ext ? `${ext} ${isArabic ? "ملف" : "file"}` : isArabic ? "ملف" : "File";
}

function preferredSlug(file: File, tools: ToolDefinition[]) {
  const ext = extensionOf(file).toLowerCase();
  const wanted = file.type === "application/pdf" ? "sign-pdf" : file.type.startsWith("image/") ? "compress-image" : ext === "docx" ? "word-to-pdf" : ext === "xlsx" ? "xlsx-to-pdf" : ext === "csv" ? "csv-to-xlsx" : file.type.startsWith("text/") ? "txt-to-pdf" : undefined;
  return wanted && tools.some(tool => tool.slug === wanted) ? wanted : tools[0]?.slug;
}

function recommendationReason(tool: ToolDefinition, file: File, isArabic: boolean) {
  const ext = extensionOf(file).toLowerCase();
  const ar: Record<string, string> = {
    "sign-pdf": "أضف توقيعًا مرئيًا إلى صفحات PDF داخل جهازك.", "compress-pdf": "خفّض حجم ملف PDF المتوافق محليًا.", "split-pdf": "أنشئ صفحات أو نطاقات مستقلة من ملفك.", "pdf-to-jpg": "حوّل صفحات PDF إلى صور قابلة للاستخدام.", "pdf-to-png": "صدّر صفحات PDF بصيغة PNG واضحة.", "word-to-pdf": "اعرض مستند Word محليًا ثم أنشئ PDF بصريًا.", "compress-image": "خفّض حجم الصورة مع التحكم في الجودة.", "resize-image": "اضبط أبعاد الصورة مع الحفاظ على نسبتها.", "convert-image": "غيّر صيغة الصورة محليًا.", "xlsx-to-pdf": "صدّر أوراق Excel المختارة إلى PDF جدولي.", "xlsx-to-csv": "حوّل أوراق Excel إلى CSV محليًا.", "csv-to-xlsx": "أنشئ مصنف Excel من ملف CSV.", "txt-to-pdf": "حوّل النص إلى PDF منسق محليًا.", "txt-to-docx": "أنشئ ملف Word قابلًا للتحرير من النص."
  };
  const en: Record<string, string> = {
    "sign-pdf": "Add a visual signature to your PDF on this device.", "compress-pdf": "Reduce a compatible PDF locally.", "split-pdf": "Create separate pages or ranges from this PDF.", "pdf-to-jpg": "Turn PDF pages into usable images.", "pdf-to-png": "Export PDF pages as crisp PNG images.", "word-to-pdf": "Render this Word document locally into a visual PDF.", "compress-image": "Reduce image size with quality control.", "resize-image": "Adjust image dimensions while keeping its ratio.", "convert-image": "Convert this image locally.", "xlsx-to-pdf": "Export selected Excel sheets to a tabular PDF.", "xlsx-to-csv": "Export Excel sheets as local CSV files.", "csv-to-xlsx": "Create an Excel workbook from this CSV.", "txt-to-pdf": "Turn text into a formatted PDF locally.", "txt-to-docx": "Create an editable Word file from text."
  };
  const known = (isArabic ? ar : en)[tool.slug];
  if (known) return known;
  const kind = ext || file.type || (isArabic ? "هذا النوع" : "this file type");
  return isArabic ? `هذه الأداة الجاهزة تقبل ${kind} محليًا.` : `This ready tool accepts ${kind} locally.`;
}

async function inspectFileLocally(file: File, isArabic: boolean): Promise<FileInsight | undefined> {
  const ext = extensionOf(file).toLowerCase();
  if (file.type === "application/pdf" || ext === "pdf") {
    const pdfjs: any = await import("pdfjs-dist/legacy/build/pdf.mjs");
    pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/legacy/build/pdf.worker.mjs", import.meta.url).toString();
    const document = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
    const pageCount = document.numPages; document.destroy?.();
    return { labelAr: "الصفحات", labelEn: "Pages", value: String(pageCount), icon: "pages" };
  }
  if (file.type.startsWith("image/")) {
    const url = URL.createObjectURL(file);
    try {
      const dimensions = await new Promise<{ width: number; height: number }>((resolve, reject) => { const image = new Image(); image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight }); image.onerror = reject; image.src = url; });
      return { labelAr: "الأبعاد", labelEn: "Dimensions", value: `${dimensions.width} × ${dimensions.height}`, icon: "image" };
    } finally { URL.revokeObjectURL(url); }
  }
  if (["xlsx", "xls", "csv"].includes(ext)) {
    const XLSX = await import("xlsx");
    const source = ext === "csv" ? XLSX.read(await file.text(), { type: "string" }) : XLSX.read(await file.arrayBuffer(), { type: "array" });
    return { labelAr: "الأوراق", labelEn: "Sheets", value: String(source.SheetNames.length), icon: "sheet" };
  }
  if (["doc", "docx"].includes(ext)) return { labelAr: "المسار", labelEn: "Path", value: isArabic ? "عرض محلي" : "Local render", icon: "document" };
  return undefined;
}

function InsightIcon({ type }: { type: FileInsight["icon"] }) { return type === "image" ? <FileImage size={16}/> : type === "sheet" ? <FileSpreadsheet size={16}/> : type === "document" ? <FileText size={16}/> : <FileCheck2 size={16}/>; }

export default function SmartFileAssistant({ tools }: { tools: ToolDefinition[] }) {
  const { isArabic, t } = useLocale(); const [, navigate] = useLocation(); const inputRef = useRef<HTMLInputElement>(null); const [file, setFile] = useState<File>(); const [insight, setInsight] = useState<FileInsight>(); const [isInspecting, setIsInspecting] = useState(false);
  const recommendations = useMemo(() => file ? tools.filter(isSingleFileReadyAssistantTool).filter(tool => matchesToolInput(file, tool)) : [], [file, tools]);
  const recommended = file ? preferredSlug(file, recommendations) : undefined;
  const isPdf = file?.type === "application/pdf" || extensionOf(file || new File([], "")).toLowerCase() === "pdf";
  useEffect(() => { let live = true; if (!file) { setInsight(undefined); setIsInspecting(false); return; } setInsight(undefined); setIsInspecting(true); inspectFileLocally(file, isArabic).then(value => { if (live) setInsight(value); }).catch(() => { if (live) setInsight(undefined); }).finally(() => { if (live) setIsInspecting(false); }); return () => { live = false; }; }, [file, isArabic]);
  const openTool = (tool: ToolDefinition) => { if (!file) return; prepareFileForTool(file, tool.slug); navigate(`/${tool.slug}`); };
  const selectFile = () => inputRef.current?.click();
  return <section className="smart-file-assistant" aria-label={t("مساعد الملفات الذكي", "Smart File Assistant")}>
    <div className="assistant-topline"><span><Sparkles size={15}/>{t("مساعد وَصَل", "Wasl Assistant")}</span><span><ShieldCheck size={15}/>{t("خاص داخل جهازك", "Private on your device")}</span></div>
    <div className="assistant-heading"><div><h2>{t("ما الذي يحتاجه ملفك؟", "What does your file need?")}</h2><p>{t("ارفعه مرة واحدة، وسنظهر لك الأدوات الجاهزة المناسبة فقط.", "Upload it once and see only the ready tools that fit.")}</p></div><button type="button" onClick={selectFile} className="assistant-change-file"><FileUp size={17}/>{file ? t("ملف آخر", "Another file") : t("رفع ملف", "Upload")}</button></div>
    <input ref={inputRef} className="sr-only" type="file" onChange={event => { setFile(event.target.files?.[0]); event.target.value = ""; }}/>
    {!file ? <button type="button" onClick={selectFile} className="assistant-dropzone"><span className="assistant-drop-icon"><FileSearch size={27}/></span><span><b>{t("اسحب ملفك هنا أو اختره من جهازك", "Drop your file here or choose it")}</b><small>{t("PDF، Word، الصور، Excel، CSV أو نص", "PDF, Word, images, Excel, CSV or text")}</small></span><ChevronLeft size={20} className={isArabic ? "rotate-180" : ""}/></button> : <div className="assistant-analysis">
      <div className="assistant-file-summary"><span className="assistant-file-type"><FileCheck2 size={22}/></span><div className="min-w-0 flex-1"><div className="assistant-recognized"><CheckCircle2 size={14}/>{t("تم التعرف عليه محليًا", "Recognized locally")}</div><b className="truncate">{file.name}</b><p>{labelFor(file, isArabic)} <span>•</span> {formatBytes(file.size)}</p></div><button type="button" onClick={() => setFile(undefined)} className="assistant-remove-file" aria-label={t("إزالة الملف", "Remove file")}><X size={17}/></button></div>
      <div className="assistant-insights"><div><FileText size={16}/><span><small>{t("النوع", "Type")}</small><b>{labelFor(file, isArabic)}</b></span></div><div><FileUp size={16}/><span><small>{t("الحجم", "Size")}</small><b>{formatBytes(file.size)}</b></span></div>{isInspecting ? <div className="assistant-insight-loading"><Sparkles size={16}/><span>{t("نقرأ خصائص محلية…", "Reading local properties…")}</span></div> : insight ? <div><InsightIcon type={insight.icon}/><span><small>{isArabic ? insight.labelAr : insight.labelEn}</small><b>{insight.value}</b></span></div> : null}</div>
      <div className="assistant-local-note"><ShieldCheck size={16}/><span><b>{t("يبقى ملفك في متصفحك.", "Your file stays in your browser.")}</b> {t("لا نرفع محتواه إلى خادم من أجل هذه التوصيات.", "Its content is not uploaded for these recommendations.")}</span></div>
      {recommendations.length ? <><div className="assistant-recommendations-heading"><div><span>{t("الخطوة المناسبة الآن", "The right next step")}</span><h3>{t("أدوات جاهزة لهذا الملف", "Ready tools for this file")}</h3></div><small>{t("اختر أداة وسيُمرر ملفك تلقائيًا.", "Choose a tool and your file will move there automatically.")}</small></div><div className="assistant-recommendation-grid">{recommendations.map(tool => <button type="button" key={tool.slug} onClick={() => openTool(tool)} className={`assistant-tool-recommendation ${tool.slug === recommended ? "is-recommended" : ""}`}><div className="assistant-tool-icon"><tool.icon size={19}/></div><div><span>{tool.slug === recommended ? t("نوصي بها", "Recommended") : t("أداة جاهزة", "Ready tool")}</span><b>{isArabic ? tool.labelAr : tool.labelEn}</b><p>{recommendationReason(tool, file, isArabic)}</p></div><ChevronLeft size={17} className={isArabic ? "rotate-180" : ""}/></button>)}</div>{isPdf && <p className="assistant-secondary-flow">{t("لديك ملف PDF آخر؟ الدمج والمقارنة يصبحان متاحين عند إضافة ملف ثانٍ داخل أداتهما.", "Have another PDF? Merge and compare become available when you add the second file in their tool.")}</p>}</> : <p className="assistant-empty-result">{t("تعرفنا على الملف، لكن لا توجد أداة جاهزة وموثوقة لهذا النوع حاليًا.", "The file was recognized, but no ready reliable tool is available for this type yet.")}</p>}</div>}
  </section>;
}
