import { Button } from "@/components/ui/button";
import { useLocale } from "@/contexts/LocaleContext";
import { DXF_BINARY_OR_3D_GUIDANCE, DXF_LARGE_FILE_WARNING, DWG_TO_DXF_GUIDANCE, convertDxfToPdf, dxfPreflightError, type DxfPdfConversion } from "@/lib/dxf-engine";
import { downloadBlob, formatBytes } from "@/lib/file-utils";
import { AlertCircle, CheckCircle2, Download, FileCode2, FileWarning, Layers3, Loader2, ShieldCheck, UploadCloud } from "lucide-react";
import { ChangeEvent, DragEvent, useMemo, useRef, useState } from "react";

export default function DxfWorkspace() {
  const { isArabic, t } = useLocale();
  const inputRef = useRef<HTMLInputElement>(null); const [file, setFile] = useState<File>(); const [progress, setProgress] = useState(0); const [processing, setProcessing] = useState(false); const [error, setError] = useState<string>(); const [conversion, setConversion] = useState<DxfPdfConversion>(); const [dragging, setDragging] = useState(false);
  const large = Boolean(file && file.size > 20 * 1024 * 1024); const previewMarkup = useMemo(() => conversion?.svg, [conversion]);
  const choose = async (next?: File) => {
    setError(undefined); setConversion(undefined); setProgress(0); if (!next) return;
    if (/\.dwg$/i.test(next.name)) { setFile(undefined); setError(DWG_TO_DXF_GUIDANCE); return; }
    if (!/\.dxf$/i.test(next.name)) { setFile(undefined); setError(t("اختر ملف DXF بامتداد .dxf فقط.", "Choose a .dxf file only.")); return; }
    const preflight = dxfPreflightError(await next.text());
    if (preflight) { setFile(undefined); setError(preflight); return; }
    setFile(next);
  };
  const onInput = (event: ChangeEvent<HTMLInputElement>) => { choose(event.target.files?.[0]); event.target.value = ""; };
  const onDrop = (event: DragEvent<HTMLDivElement>) => { event.preventDefault(); setDragging(false); choose(event.dataTransfer.files?.[0]); };
  const process = async () => {
    if (!file) return; setProcessing(true); setError(undefined); setConversion(undefined); setProgress(3);
    try { const result = await convertDxfToPdf(file, fraction => setProgress(Math.max(3, Math.round(fraction * 100)))); setConversion(result); }
    catch (reason) { setError(reason instanceof Error ? reason.message : t("تعذر تحويل DXF محليًا.", "Could not convert DXF locally.")); }
    finally { setProcessing(false); }
  };
  return <section className="tool-workspace dxf-workspace">
    <div className="tool-workspace-head"><div><span className="local-pill"><ShieldCheck size={12}/>{t("محلي بالكامل", "FULLY LOCAL")}</span><h2>{t("محول DXF إلى PDF", "DXF to PDF converter")}</h2><p>{t("يدعم DXF ASCII ثنائي الأبعاد فقط. يبقى الملف داخل متصفحك، وينتج PDF متّجهي قابل للتنزيل.", "Supports 2D ASCII DXF only. Your file stays in the browser and exports as a downloadable vector PDF.")}</p></div><div className="format-chips"><span>DXF</span><span>PDF</span></div></div>
    <div className="privacy-inline"><ShieldCheck size={17}/><span>{t("لا يُرفع ملف DXF إلى الخادم. التحليل والرسم وتصدير PDF تحدث داخل جهازك فقط.", "DXF is never uploaded. Parsing, rendering, and PDF export stay on your device.")}</span></div>
    <div className="workspace-grid"><div className="workspace-main">
      <div className="dxf-notice"><CheckCircle2 size={17}/><span>{t("يدعم: DXF ASCII ثنائي الأبعاد، الخطوط والدوائر والأقواس وPolyline والنصوص والكتل الأساسية، وHATCH الصلب ذي الحدود الخطية المغلقة.", "Supported: 2D ASCII DXF, lines, circles, arcs, polylines, text, basic blocks, and SOLID HATCH with closed line boundaries.")}</span></div>
      <div className="dxf-notice warning"><FileWarning size={17}/><span>{t("غير مدعوم: DWG وDXF الثنائي وCAD ثلاثي الأبعاد. سيُرفض الملف ويتعطل زر التحويل مع توجيه واضح. HATCH المنقوش أو ذو حدود منحنية قد لا يُرسم ويظهر في تنبيهات التوافق.", "Not supported: DWG, binary DXF, and 3D CAD. The file is rejected and conversion stays disabled. Patterned or curved-boundary HATCH may be skipped with a compatibility notice.")}</span></div>
      <div onDrop={onDrop} onDragOver={event => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} className={`drop-zone ${dragging ? "is-dragging" : ""} ${file ? "has-files" : ""}`}>
        {file ? <div className="file-queue"><div className="queued-file"><span className="file-type-icon"><FileCode2 size={18}/></span><div className="min-w-0"><b>{file.name}</b><small>{formatBytes(file.size)} · ASCII DXF</small></div><button className="dxf-clear-file" onClick={() => choose(undefined)}>{t("إزالة", "Remove")}</button></div><button className="add-more" onClick={() => inputRef.current?.click()}>{t("تغيير الملف", "Change file")}</button><input ref={inputRef} onChange={onInput} type="file" accept=".dxf,application/dxf,text/plain"/></div> : <label className="drop-zone-empty"><input ref={inputRef} onChange={onInput} type="file" accept=".dxf,application/dxf,text/plain"/><span className="drop-icon"><UploadCloud size={29}/></span><strong>{t("اسحب ملف DXF هنا", "Drop an ASCII DXF file here")}</strong><span>{t("أو اختره من جهازك", "or choose it from your device")}</span><em>{t("DXF ASCII ثنائي الأبعاد فقط · DWG غير مدعوم", "2D ASCII DXF only · DWG is not supported")}</em></label>}
      </div>
      {large && <div className="dxf-notice warning"><FileWarning size={17}/><span>{DXF_LARGE_FILE_WARNING}</span></div>}
      <div className="dxf-notice"><AlertCircle size={17}/><span>{t("تُعرض HATCH الصلبة ذات حدود خطية مغلقة كمسارات متجهية. أما التعبئات المنقوشة أو ذات حدود منحنية والعناصر المتقدمة التي لا تُرسم فستظهر في تنبيه واضح بعد التحويل.", "SOLID HATCH with closed line boundaries is exported as vector paths. Patterned or curved-boundary hatches and advanced entities that cannot render are listed clearly after conversion.")}</span></div>
      {previewMarkup && <div className="dxf-preview"><div><span>{t("معاينة محلية", "Local preview")}</span><b>{t("رسم متّجهي", "Vector drawing")}</b></div><div className="dxf-svg" dangerouslySetInnerHTML={{ __html: previewMarkup }}/></div>}
    </div><aside className="workspace-side"><div className="dxf-stat-grid"><div><FileCode2 size={16}/><span>{t("الصيغة", "Format")}</span><b>ASCII DXF</b></div><div><Layers3 size={16}/><span>{t("الناتج", "Output")}</span><b>PDF</b></div></div><Button disabled={!file || processing} onClick={process} className="process-button">{processing ? <><Loader2 className="animate-spin" size={17}/>{t("نحوّل الرسم…", "Converting drawing…")}</> : <><FileCode2 size={17}/>{t("تحويل إلى PDF", "Convert to PDF")}</>}</Button>{processing && <div className="process-progress"><div><span>{t("التقدم", "Progress")}</span><b>{progress}%</b></div><div className="progress-track"><i style={{ width: `${progress}%` }}/></div><small>{t("تعتمد السرعة على عدد الكائنات وذاكرة جهازك. لا يغادر الملف متصفحك.", "Speed depends on drawing complexity and device memory. The file never leaves your browser.")}</small></div>}{error && <div className="workspace-error"><AlertCircle size={17}/><span>{error}</span></div>}</aside></div>
    {conversion && <div className="results-panel"><div className="results-header"><div><span className="result-success"><CheckCircle2 size={17}/>{t("اكتمل PDF المتّجهي", "Vector PDF is ready")}</span><p>{t(`رُسم ${conversion.entityCount} كائنًا من ${conversion.layerCount} طبقة محليًا.`, `${conversion.entityCount} entities across ${conversion.layerCount} layers were rendered locally.`)}</p></div><Button onClick={() => downloadBlob(conversion.result.blob, conversion.result.name)}><Download size={15}/>{t("تحميل PDF", "Download PDF")}</Button></div>{conversion.warnings.length > 0 && <div className="dxf-warnings"><b>{t("تنبيهات التوافق", "Compatibility notices")}</b><ul>{conversion.warnings.map(warning => <li key={warning}>{warning}</li>)}</ul></div>}<div className="dxf-layer-list"><span>{t("الطبقات المكتشفة", "Detected layers")}</span><b>{conversion.layers.length ? conversion.layers.join(" · ") : t("طبقة افتراضية", "Default layer")}</b></div></div>}
  </section>;
}
