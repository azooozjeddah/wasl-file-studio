import PublicLayout from "@/components/PublicLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { KeyRound, LockKeyhole, ShieldCheck } from "lucide-react";
import { FormEvent, useState } from "react";
import { Link } from "wouter";
import { toast } from "sonner";

export default function AccountSecurityPage() {
  const { user, loading } = useAuth(); const [currentPassword, setCurrentPassword] = useState(""); const [nextPassword, setNextPassword] = useState("");
  const change = trpc.waslAuth.changePassword.useMutation({ onSuccess: () => { setCurrentPassword(""); setNextPassword(""); toast.success("تم تغيير كلمة المرور بنجاح."); }, onError: error => toast.error(error.message) });
  const submit = (event: FormEvent) => { event.preventDefault(); change.mutate({ currentPassword, nextPassword }); };
  if (loading) return null;
  if (!user) return <PublicLayout><main className="container py-16" dir="rtl"><section className="mx-auto max-w-xl rounded-3xl border bg-card p-8 text-center shadow-sm"><LockKeyhole className="mx-auto text-violet-600"/><h1 className="mt-4 text-2xl font-black">تحتاج إلى تسجيل الدخول</h1><p className="mt-2 text-muted-foreground">سجل الدخول بحساب وَصل لإدارة أمان حسابك.</p><Button className="mt-6" asChild><Link href="/login">تسجيل الدخول</Link></Button></section></main></PublicLayout>;
  return <PublicLayout><main className="container py-10 md:py-14" dir="rtl"><section className="mx-auto max-w-2xl"><header className="mb-6 flex gap-4"><span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-violet-100 text-violet-700 dark:bg-violet-500/15"><ShieldCheck size={25}/></span><div><h1 className="text-3xl font-black">أمان الحساب</h1><p className="mt-2 text-muted-foreground">غيّر كلمة مرور حساب وَصل. اختر 10 أحرف على الأقل ولا تعيد استخدام كلمة مرور سابقة.</p></div></header><form onSubmit={submit} className="rounded-3xl border bg-card p-6 shadow-sm md:p-8"><div className="grid gap-5"><label className="grid gap-2"><span className="font-medium">كلمة المرور الحالية</span><Input type="password" autoComplete="current-password" value={currentPassword} onChange={event => setCurrentPassword(event.target.value)} required/></label><label className="grid gap-2"><span className="font-medium">كلمة المرور الجديدة</span><Input type="password" autoComplete="new-password" value={nextPassword} onChange={event => setNextPassword(event.target.value)} minLength={10} required/><small className="text-muted-foreground">10 أحرف على الأقل.</small></label></div><Button className="mt-6" disabled={change.isPending}>{change.isPending ? "جارٍ الحفظ…" : "تغيير كلمة المرور"}<KeyRound size={16}/></Button></form></section></main></PublicLayout>;
}
