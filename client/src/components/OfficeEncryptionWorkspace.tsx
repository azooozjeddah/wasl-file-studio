import { AlertCircle, CheckCircle2, Download, FileLock2, Loader2, LockKeyhole, ShieldCheck, UploadCloud } from "lucide-react";
import { ChangeEvent, DragEvent, useRef, useState } from "react";
import { toast } from "sonner";
import type { ToolDefinition } from "@/lib/tools";
import { downloadBlob, formatBytes } from "@/lib/file-utils";
import { trpc } from "@/lib/trpc";

const MAX_BYTES = 10 * 1024 * 1024;
const familyFor = (slug: string) => slug.endsWith("word") ? "word" : slug.endsWith("excel") ? "excel" : "powerpoint";
const extensionFor = (family: string) => family === "word" ? "docx" : family === "excel" ? "xlsx" : "pptx";
const mimeFor = (family: string) => family === "word" ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document" : family === "excel" ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" : "application/vnd.openxmlformats-officedocument.presentationml.presentation";

async function base64Of(file: File) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = "";
  for (let index = 0; index < bytes.length; index += 1) binary += String.fromCharCode(bytes[index]);
  return btoa(binary);
}

function bytesFromBase64(value: string) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

export default function OfficeEncryptionWorkspace({ tool }: { tool: ToolDefinition }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File>();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string>();
  const [completed, setCompleted] = useState<{ name: string; blob: Blob; encrypted: boolean }>();
  const mutation = trpc.officeEncryption.process.useMutation();
  const auth = trpc.auth.me.useQuery();
  const protect = tool.slug.startsWith("protect-");
  const family = familyFor(tool.slug);
  const extension = extensionFor(family);
  const accept = `.${extension},${mimeFor(family)}`;

  const selectFile = (next?: File) => {
    setError(undefined); setCompleted(undefined);
    if (!next) return;
    if (next.size === 0) return setError("الملف فارغ ولا يمكن معالجته.");
    if (next.size > MAX_BYTES) return setError("الحد الأقصى لهذه الأداة هو 10 MB.");
    if (!next.name.toLowerCase().endsWith(`.${extension}`)) return setError(`اختر ملف .${extension.toUpperCase()} فقط.`);
    const expectedMime = mimeFor(family);
    if (next.type && next.type !== expectedMime && next.type !== "application/octet-stream") return setError("نوع الملف لا يطابق صيغة Office المطلوبة.");
    setFile(next);
  };

  const onInput = (event: ChangeEvent<HTMLInputElement>) => { selectFile(event.target.files?.[0]); event.target.value = ""; };
  const onDrop = (event: DragEvent<HTMLDivElement>) => { event.preventDefault(); selectFile(event.dataTransfer.files?.[0]); };
  const process = async () => {
    if (!file) return setError("اختر ملفًا أولًا.");
    if (password.length < 8) return setError("يجب أن تتكون كلمة المرور من 8 أحرف على الأقل.");
    if (protect && password !== confirmPassword) return setError("تأكيد كلمة المرور لا يطابق كلمة المرور.");
    setError(undefined); setCompleted(undefined);
    try {
      const result = await mutation.mutateAsync({ operation: tool.slug as "protect-word" | "unlock-word" | "protect-excel" | "unlock-excel" | "protect-powerpoint" | "unlock-powerpoint", fileName: file.name, contentType: file.type || mimeFor(family), inputBase64: await base64Of(file), password });
      const blob = new Blob([bytesFromBase64(result.outputBase64)], { type: result.contentType });
      setCompleted({ name: result.fileName, blob, encrypted: result.encrypted });
      setPassword(""); setConfirmPassword("");
      toast.success(protect ? "تم إنشاء ملف Office محمي." : "تم فك حماية ملف Office.");
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : "تعذر معالجة ملف Office.";
      setError(message);
      toast.error("تعذرت المعالجة", { description: message });
    }
  };

  if (auth.isLoading) return <section className="tool-workspace" aria-label={tool.labelAr}><div className="workspace-error"><Loader2 className="animate-spin" size={17}/><span>جارٍ التحقق من جلسة الحساب قبل فتح خدمة Office.</span></div></section>;
  if (!auth.data) return <section className="tool-workspace" aria-label={tool.labelAr}><div className="workspace-error"><LockKeyhole size={17}/><span>سجّل الدخول أولًا لاستخدام خدمة Office الداخلية المؤقتة.</span><a className="button" href="/login">تسجيل الدخول</a></div></section>;
  if (auth.data.role !== "admin") return <section className="tool-workspace" aria-label={tool.labelAr}><div className="workspace-error"><LockKeyhole size={17}/><span>هذه خدمة اختبار داخلية متاحة للمدير فقط. لا تُعرض للمستخدمين العامين.</span></div></section>;
  return <section className="tool-workspace" aria-label={tool.labelAr}>
    <div className="tool-workspace-head"><div><span className="local-pill"><FileLock2 size={12}/>معالجة خادمية مؤقتة</span><h2>{tool.labelAr}</h2><p>{tool.descriptionAr}</p></div><div className="format-chips"><span>{extension.toUpperCase()}</span><span>10 MB</span></div></div>
    <div className="privacy-inline"><ShieldCheck size={17}/><span>يُعالج الملف وكلمة المرور في ذاكرة الخادم لوقت الطلب فقط. لا نخزن الملف أو كلمة المرور أو محتوى المستند في قاعدة البيانات أو السجلات أو التخزين الدائم.</span></div>
    <div className="workspace-grid"><div className="workspace-main"><div onDrop={onDrop} onDragOver={event => event.preventDefault()} className={`drop-zone ${file ? "has-files" : ""}`}>{file ? <div className="file-queue"><div className="queued-file"><span className="file-type-icon"><FileLock2 size={18}/></span><div className="min-w-0"><b>{file.name}</b><small>{formatBytes(file.size)}</small></div><button onClick={() => { setFile(undefined); setCompleted(undefined); }} aria-label="إزالة الملف">×</button></div><button className="add-more" onClick={() => inputRef.current?.click()}><UploadCloud size={16}/>استبدال الملف</button><input ref={inputRef} onChange={onInput} type="file" accept={accept}/></div> : <label className="drop-zone-empty"><input ref={inputRef} onChange={onInput} type="file" accept={accept}/><span className="drop-icon"><UploadCloud size={29}/></span><strong>اسحب ملف {extension.toUpperCase()} هنا</strong><span>أو اختره من جهازك</span><em>ملف واحد حتى 10 MB</em></label>}</div></div>
      <aside className="workspace-side"><div className="workspace-settings"><div className="settings-header"><span>كلمة المرور</span><small>{protect ? "كلمة مرور فتح جديدة" : "كلمة مرور الملف الحالية"}</small></div><label className="setting-field"><span>{protect ? "كلمة المرور الجديدة" : "كلمة مرور الفتح"}</span><input type="password" autoComplete="new-password" value={password} onChange={event => setPassword(event.target.value)} placeholder="8 أحرف على الأقل"/></label>{protect && <label className="setting-field"><span>تأكيد كلمة المرور</span><input type="password" autoComplete="new-password" value={confirmPassword} onChange={event => setConfirmPassword(event.target.value)} placeholder="أعد كتابة كلمة المرور"/></label>}<small>لا تستخدم هذه الأداة إلا للملفات التي تملك حق حمايتها أو فك حمايتها.</small></div><button className="process-button" disabled={!file || mutation.isPending} onClick={() => void process()}>{mutation.isPending ? <><Loader2 className="animate-spin" size={17}/>نعالج الملف…</> : <><LockKeyhole size={17}/>{protect ? "حماية الملف" : "فك حماية الملف"}</>}</button>{error && <div className="workspace-error"><AlertCircle size={17}/><span>{error}</span></div>}</aside></div>
    {completed && <div className="results-panel"><div className="results-header"><div><span className="result-success"><CheckCircle2 size={17}/>اكتملت النتيجة</span><p>{completed.encrypted ? "تم إنشاء ملف Office مشفر بكلمة مرور فتح." : "تم إنشاء نسخة غير مشفرة بعد التحقق من كلمة المرور."}</p></div></div><div className="results-list"><div className="result-file"><span className="file-type-icon"><FileLock2 size={18}/></span><div><b>{completed.name}</b><small>{formatBytes(completed.blob.size)}</small></div><button className="button" onClick={() => downloadBlob(completed.blob, completed.name)}><Download size={14}/>تنزيل</button></div></div></div>}
  </section>;
}
