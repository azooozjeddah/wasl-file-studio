import { useAuth } from "@/_core/hooks/useAuth";
import OfficeEncryptionWorkspace from "@/components/OfficeEncryptionWorkspace";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { internalOfficeTools, type OfficeOperation } from "@/lib/internal-office-tools";
import { FileLock2, LockKeyhole, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { Link } from "wouter";

export default function AdminOfficeEncryptionPage() {
  const { user, loading } = useAuth();
  const [selectedSlug, setSelectedSlug] = useState<OfficeOperation>("protect-word");
  const selectedTool = internalOfficeTools.find(tool => tool.slug === selectedSlug) || internalOfficeTools[0];

  if (loading) return null;
  if (!user || user.role !== "admin") {
    return <div className="admin-denied w-full min-w-0"><LockKeyhole size={29}/><h1 className="max-w-full break-words">هذه المنطقة مخصصة لمدير وَصل</h1><p>تحتاج إلى تسجيل الدخول بحساب مدير للوصول إلى أدوات Office الداخلية.</p><Button className="max-w-full" asChild><Link href="/login"><ShieldCheck size={15}/>تسجيل دخول المدير</Link></Button></div>;
  }

  return <DashboardLayout><main className="admin-page" dir="rtl"><header className="admin-titlebar"><div><span className="admin-kicker"><FileLock2 size={14}/>وَصل · Office الداخلي</span><h1>حماية Office بكلمة مرور</h1><p>هذه الأدوات داخلية للمدير فقط، ولا تدخل في مكتبة الأدوات أو الكتالوج العام.</p></div><div className="admin-actions"><Button variant="outline" asChild><Link href="/admin"><ShieldCheck size={15}/>العودة للإدارة</Link></Button></div></header><section className="admin-stack"><div className="admin-panel"><div className="panel-head"><div><h2>اختر العملية</h2><p>Word وExcel وPowerPoint بتشفير Password-to-Open، بحد ملف خام قدره 10 MB.</p></div></div><div className="tool-admin-grid">{internalOfficeTools.map(tool => { const Icon = tool.icon; return <button className={`tool-admin-row ${selectedSlug === tool.slug ? "selected" : ""}`} key={tool.slug} onClick={() => setSelectedSlug(tool.slug)}><span className="tool-icon tool-document"><Icon size={18}/></span><span><b>{tool.labelAr}</b><small>{tool.formats.join(" · ")} · خدمة داخلية</small></span></button>; })}</div></div><OfficeEncryptionWorkspace tool={selectedTool}/></section></main></DashboardLayout>;
}
