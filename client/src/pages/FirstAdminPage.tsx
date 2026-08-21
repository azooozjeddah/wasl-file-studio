import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { ShieldCheck, TerminalSquare } from "lucide-react";
import { useState } from "react";

export default function FirstAdminPage() {
  const [name, setName] = useState("مطور وَصل"); const status = trpc.devSetup.status.useQuery(undefined, { retry: false });
  const setup = trpc.devSetup.createFirstAdmin.useMutation({ onSuccess: () => { window.location.assign("/admin"); } }); const login = trpc.devSetup.developmentLogin.useMutation({ onSuccess: () => { window.location.assign("/admin"); } });
  if (status.isLoading) return <main className="first-admin-page"><p>جارٍ فحص بيئة التطوير…</p></main>;
  const available = status.data?.canSetup; const canLogin = status.data?.canLogin;
  return <main className="first-admin-page" dir="rtl"><section className="first-admin-card"><span className="first-admin-icon"><ShieldCheck size={28}/></span><p className="first-admin-kicker"><TerminalSquare size={14}/>إعداد تطوير محلي</p><h1>{available ? "إنشاء مدير تطوير" : canLogin ? "دخول مدير التطوير" : "إعداد التطوير غير متاح"}</h1><p>{available ? "سيُنشأ حساب مدير محلي واحد لهذه البيئة التطويرية فقط. لا يعمل هذا المسار في الإنتاج، ولا يغير حسابات OAuth الموجودة." : canLogin ? "يوجد مدير تطوير محلي بالفعل. يمكنك بدء جلسة تطوير للوصول إلى لوحة التحكم." : "هذا المسار مغلق خارج وضع التطوير."}</p>{available && <label>اسم المدير التجريبي<Input value={name} maxLength={80} onChange={event => setName(event.target.value)}/></label>}<Button disabled={(available ? setup.isPending : login.isPending) || !status.data?.developmentMode || (!available && !canLogin)} onClick={() => available ? setup.mutate({ name }) : login.mutate()}>{available ? "إنشاء المدير والدخول" : "دخول مدير التطوير"}</Button>{(setup.error || login.error || status.error) && <p className="first-admin-error">{setup.error?.message || login.error?.message || status.error?.message}</p>}<small>هذا المسار مقيد بوضع التطوير ولا ينشئ كلمة مرور أو حساب إنتاجي أو وسيلة دفع.</small></section></main>;
}
