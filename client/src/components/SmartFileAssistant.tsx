import { useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import { FileCheck2, FileSearch, FileUp, Sparkles, X } from "lucide-react";
import { formatBytes } from "@/lib/file-utils";
import { isSingleFileReadyAssistantTool, matchesToolInput, prepareFileForTool } from "@/lib/file-handoff";
import type { ToolDefinition } from "@/lib/tools";
import { useLocale } from "@/contexts/LocaleContext";

function labelFor(file: File, isArabic: boolean) {
  const ext = file.name.includes(".") ? file.name.split(".").pop()?.toUpperCase() : "";
  if (file.type === "application/pdf" || ext === "PDF") return isArabic ? "ملف PDF" : "PDF file";
  if (file.type.startsWith("image/")) return isArabic ? "صورة" : "Image";
  if (["DOC", "DOCX"].includes(ext || "")) return isArabic ? "مستند Word" : "Word document";
  if (["XLS", "XLSX", "CSV"].includes(ext || "")) return isArabic ? "ملف Excel أو جدول" : "Spreadsheet";
  if (["PPT", "PPTX"].includes(ext || "")) return isArabic ? "عرض PowerPoint" : "PowerPoint presentation";
  if (file.type.startsWith("text/")) return isArabic ? "ملف نصي" : "Text file";
  return ext ? `${ext} ${isArabic ? "ملف" : "file"}` : isArabic ? "ملف" : "File";
}

function preferredSlug(file: File, tools: ToolDefinition[]) {
  const wanted = file.type === "application/pdf" ? "sign-pdf" : file.type.startsWith("image/") ? "compress-image" : file.name.endsWith(".xlsx") ? "xlsx-to-pdf" : file.name.endsWith(".csv") ? "csv-to-xlsx" : file.type.startsWith("text/") ? "txt-to-pdf" : undefined;
  return wanted && tools.some(tool => tool.slug === wanted) ? wanted : tools[0]?.slug;
}

export default function SmartFileAssistant({ tools }: { tools: ToolDefinition[] }) {
  const { isArabic, t } = useLocale(); const [, navigate] = useLocation(); const inputRef = useRef<HTMLInputElement>(null); const [file, setFile] = useState<File>();
  const recommendations = useMemo(() => file ? tools.filter(isSingleFileReadyAssistantTool).filter(tool => matchesToolInput(file, tool)) : [], [file, tools]);
  const recommended = file ? preferredSlug(file, recommendations) : undefined;
  const openTool = (tool: ToolDefinition) => { if (!file) return; prepareFileForTool(file, tool.slug); navigate(`/${tool.slug}`); };
  return <section className="mx-auto mt-7 max-w-4xl rounded-3xl border border-primary/15 bg-background/85 p-4 shadow-xl shadow-primary/5 backdrop-blur md:p-5" aria-label={t("مساعد الملفات الذكي", "Smart File Assistant")}>
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-2xl bg-primary/10 text-primary"><Sparkles size={20}/></span><div><h2 className="text-base font-bold">{t("ارفع ملفك ودعنا نحدد لك الأدوات المناسبة", "Upload a file and let us find the right tools")}</h2><p className="text-xs text-muted-foreground">{t("يُحلل الملف داخل جهازك ولا يُرفع إلى خادم.", "Your file is analyzed on-device and never uploaded.")}</p></div></div><button type="button" onClick={() => inputRef.current?.click()} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground"><FileUp size={17}/>{file ? t("اختيار ملف آخر", "Choose another file") : t("رفع ملف", "Upload file")}</button></div>
    <input ref={inputRef} className="sr-only" type="file" onChange={event => { setFile(event.target.files?.[0]); event.target.value = ""; }}/>
    {!file ? <button type="button" onClick={() => inputRef.current?.click()} className="mt-4 flex min-h-24 w-full items-center justify-center gap-3 rounded-2xl border border-dashed border-primary/30 bg-primary/[0.03] px-4 text-sm text-muted-foreground"><FileSearch size={22} className="text-primary"/>{t("اختر PDF أو صورة أو مستندًا أو جدولًا لعرض الأدوات الجاهزة المناسبة.", "Choose a PDF, image, document, or spreadsheet to see ready tools.")}</button> : <div className="mt-4 rounded-2xl bg-muted/55 p-4"><div className="flex flex-wrap justify-between gap-3"><div className="flex min-w-0 items-center gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-background text-primary"><FileCheck2 size={20}/></span><div className="min-w-0"><p className="font-bold text-primary">⭐ {t("تم التعرف على", "Recognized as")} {labelFor(file, isArabic)}</p><p className="truncate text-sm font-medium">{file.name}</p><p className="text-xs text-muted-foreground">{formatBytes(file.size)} · {file.type || t("نوع غير معلن", "Undeclared type")}</p></div></div><button type="button" onClick={() => setFile(undefined)} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-muted-foreground"><X size={14}/>{t("إزالة", "Remove")}</button></div>
      {recommendations.length ? <><h3 className="mt-4 font-bold">{t("يمكنك تنفيذ العمليات التالية:", "You can use these tools:")}</h3><div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{recommendations.map(tool => <button type="button" key={tool.slug} onClick={() => openTool(tool)} className={`rounded-xl border p-3 text-start transition hover:border-primary hover:bg-primary/[0.04] ${tool.slug === recommended ? "border-primary bg-primary/[0.06]" : "border-border bg-background"}`}><div className="flex items-center gap-2"><tool.icon size={17} className="text-primary"/><b className="text-sm">{isArabic ? tool.labelAr : tool.labelEn}</b></div><small className="mt-1 block text-xs text-muted-foreground">{tool.slug === recommended ? t("⭐ ننصحك بهذه الأداة", "⭐ Recommended for this file") : t("سيُمرر ملفك مباشرة", "Your file will move here")}</small></button>)}</div></> : <p className="mt-4 rounded-xl border border-amber-300/50 bg-amber-50/60 p-3 text-sm">{t("تم التعرف على الملف، لكن لا توجد أداة جاهزة وموثوقة لهذا النوع حاليًا.", "The file was recognized, but no ready reliable tool is available for this type.")}</p>}</div>}
  </section>;
}
