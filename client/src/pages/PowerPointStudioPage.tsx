import PublicLayout from "@/components/PublicLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLocale } from "@/contexts/LocaleContext";
import { downloadBlob, formatBytes } from "@/lib/file-utils";
import { jsPDF } from "jspdf";
import { Download, FileText, Presentation, ShieldCheck, Upload, X } from "lucide-react";
import { useRef, useState } from "react";

type ConversionResult = { blob: Blob; slideCount: number; pageWidth: number; pageHeight: number };

async function renderPptxAsPdf(file: File, onProgress: (value: number, label: string) => void): Promise<ConversionResult> {
  const [{ PptxViewer, RECOMMENDED_ZIP_LIMITS }, html2canvas] = await Promise.all([import("@aiden0z/pptx-renderer"), import("html2canvas").then(module => module.default)]);
  onProgress(8, "تحضير العرض محليًا…");
  const source = await file.arrayBuffer();
  const rendererHost = document.createElement("div");
  rendererHost.style.cssText = "position:fixed;left:-20000px;top:0;width:1px;height:1px;overflow:hidden;pointer-events:none;";
  document.body.appendChild(rendererHost);
  const viewer = await PptxViewer.open(source, rendererHost, { renderMode: "slide", zipLimits: RECOMMENDED_ZIP_LIMITS, pdfjs: false });
  const pageWidth = Math.round(viewer.slideWidth || 1280); const pageHeight = Math.round(viewer.slideHeight || 720);
  const documentPdf = new jsPDF({ unit: "px", format: [pageWidth, pageHeight], compress: true });
  try {
    for (let index = 0; index < viewer.slideCount; index++) {
      onProgress(12 + Math.round((index / Math.max(1, viewer.slideCount)) * 78), `عرض الشريحة ${index + 1} من ${viewer.slideCount}…`);
      const stage = document.createElement("div");
      stage.style.cssText = `width:${pageWidth}px;min-height:${pageHeight}px;background:#fff;overflow:hidden;`;
      rendererHost.appendChild(stage);
      const handle = viewer.renderSlideToContainer(index, stage, 1);
      if (!handle) throw new Error("تعذر عرض هذه الشريحة محليًا.");
      await handle.ready;
      const canvas = await html2canvas(stage, { backgroundColor: "#ffffff", scale: 2, useCORS: false, logging: false });
      if (index > 0) documentPdf.addPage([pageWidth, pageHeight]);
      documentPdf.addImage(canvas.toDataURL("image/jpeg", .95), "JPEG", 0, 0, pageWidth, pageHeight, undefined, "FAST");
      handle.dispose(); stage.remove();
    }
    onProgress(96, "تجهيز PDF للتنزيل…");
    return { blob: documentPdf.output("blob"), slideCount: viewer.slideCount, pageWidth, pageHeight };
  } finally { viewer.destroy(); rendererHost.remove(); }
}

export default function PowerPointStudioPage() {
  const { t } = useLocale(); const input = useRef<HTMLInputElement>(null); const [file, setFile] = useState<File | null>(null); const [progress, setProgress] = useState(0); const [stage, setStage] = useState(""); const [result, setResult] = useState<ConversionResult | null>(null); const [error, setError] = useState(""); const busy = progress > 0 && progress < 100;
  const choose = (selected?: File) => { if (!selected) return; const valid = selected.name.toLowerCase().endsWith(".pptx") || selected.type === "application/vnd.openxmlformats-officedocument.presentationml.presentation"; if (!valid) { setError(t("اختر ملف PPTX فقط. لا ندّعي دعم PPT القديم أو ODP في هذا المسار المحلي.", "Choose a PPTX file only. This local path does not claim support for legacy PPT or ODP.")); return; } setFile(selected); setError(""); setResult(null); setProgress(0); setStage(""); };
  const convert = async () => { if (!file || busy) return; setError(""); setResult(null); setProgress(1); try { const next = await renderPptxAsPdf(file, (value, label) => { setProgress(value); setStage(label); }); setResult(next); setProgress(100); setStage(t("اكتمل التحويل محليًا.", "Local conversion complete.")); } catch (reason) { setProgress(0); setStage(""); setError(reason instanceof Error ? reason.message : t("تعذر تحويل هذا العرض محليًا.", "This presentation could not be converted locally.")); } };
  return <PublicLayout><main className="container py-10 md:py-14"><header className="mb-8 flex gap-4"><span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300"><Presentation size={25}/></span><div><p className="text-xs font-bold tracking-[.16em] text-violet-600">LOCAL · VISUAL PDF</p><h1 className="mt-1 text-3xl font-black tracking-tight">{t("PowerPoint إلى PDF", "PowerPoint to PDF")}</h1><p className="mt-2 max-w-2xl text-muted-foreground">{t("يعرض الشرائح محليًا ثم يحفظها في PDF بصري غير قابل للتحرير. لا يُرسل العرض إلى خادم.", "Renders slides locally, then saves them as a non-editable visual PDF. The presentation is never uploaded.")}</p></div></header><section className="mb-6 rounded-2xl border border-amber-200 bg-amber-50/60 p-4 text-sm leading-7 text-amber-950 dark:border-amber-500/25 dark:bg-amber-500/10 dark:text-amber-100"><b>{t("حدود صادقة:", "Truthful limits:")}</b> {t("يدعم هذا المسار PPTX الحديث. يُحفظ الناتج بصريًا للحفاظ على مظهر الشرائح، وليس PDF قابلًا لتحرير عناصر PowerPoint. لا نعرض PDF إلى PowerPoint أو ضغط PPTX لأنهما لا يبلغان جودة موثوقة محليًا حاليًا.", "This path supports modern PPTX. The result is visual to preserve slide appearance, not an editable PowerPoint-object PDF. PDF-to-PowerPoint and PPTX compression are not offered because they do not meet a reliable local quality threshold today.")}</section><div className="grid gap-6 lg:grid-cols-[1fr_.8fr]"><section className="rounded-3xl border bg-card p-6 shadow-sm"><Input ref={input} className="hidden" type="file" accept=".pptx,application/vnd.openxmlformats-officedocument.presentationml.presentation" onChange={event => choose(event.target.files?.[0])}/>{file ? <div className="rounded-2xl border bg-muted/35 p-5"><div className="flex items-start gap-3"><Presentation className="mt-1 text-violet-600"/><div className="min-w-0 flex-1"><b className="block truncate">{file.name}</b><p className="mt-1 text-sm text-muted-foreground">{formatBytes(file.size)} · PPTX</p></div><Button size="icon" variant="outline" disabled={busy} onClick={() => { setFile(null); setResult(null); setProgress(0); setStage(""); if (input.current) input.current.value = ""; }}><X size={16}/></Button></div></div> : <button type="button" className="grid min-h-56 w-full place-items-center rounded-2xl border-2 border-dashed bg-muted/35 p-6 text-center transition hover:border-violet-400 hover:bg-violet-50/50" onClick={() => input.current?.click()}><span><Upload className="mx-auto mb-3 text-violet-600"/><b className="block">{t("اختر ملف PowerPoint", "Choose a PowerPoint file")}</b><small className="mt-2 block text-muted-foreground">PPTX · {t("معالجة محلية", "local processing")}</small></span></button>}<div className="mt-5 flex flex-wrap gap-3"><Button disabled={!file || busy} onClick={convert}><FileText size={16}/>{busy ? t("جارٍ التحويل…", "Converting…") : t("تحويل إلى PDF", "Convert to PDF")}</Button>{file && <Button variant="outline" disabled={busy} onClick={() => input.current?.click()}>{t("اختيار ملف آخر", "Choose another file")}</Button>}</div>{progress > 0 && <div className="mt-5"><div className="mb-2 flex justify-between text-sm"><span>{stage}</span><b>{progress}%</b></div><div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-violet-600 transition-all" style={{ width: `${progress}%` }}/></div></div>}{error && <p className="mt-4 text-sm leading-6 text-destructive">{error}</p>}</section><aside className="rounded-3xl border bg-card p-6 shadow-sm"><ShieldCheck className="mb-3 text-emerald-600" size={24}/><h2 className="font-bold">{t("المعالجة داخل المتصفح", "Browser-only processing")}</h2><p className="mt-2 text-sm leading-7 text-muted-foreground">{t("لا تُرفع شرائحك أو صورها. لسلامة الذاكرة، ابدأ بالعروض المعتادة وتجنب الملفات الضخمة جدًا أو المحمية بكلمة مرور.", "Slides and embedded images are not uploaded. For memory safety, start with normal decks and avoid very large or password-protected files.")}</p>{result && <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-950"><b>{t("النتيجة جاهزة", "Result ready")}</b><p className="mt-1 text-sm">{result.slideCount} {t("شرائح", "slides")}</p><Button className="mt-4 w-full" onClick={() => downloadBlob(result.blob, `${file?.name.replace(/\.pptx$/i, "") || "presentation"}.pdf`)}><Download size={16}/>{t("تنزيل PDF", "Download PDF")}</Button></div>}</aside></div></main></PublicLayout>;
}
