import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, Eye, EyeOff, LockKeyhole, Mail, ShieldCheck, UserRound } from "lucide-react";
import { FormEvent, useState } from "react";
import { Link, useLocation } from "wouter";
import { toast } from "sonner";

type Mode = "login" | "register" | "setup";

export default function LoginPage() {
  const [, navigate] = useLocation();
  const status = trpc.waslAuth.status.useQuery(undefined, { retry: false });
  const [mode, setMode] = useState<Mode>("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const utils = trpc.useUtils();
  const finish = async (user: { role: "admin" | "user" }) => {
    await utils.waslAuth.me.invalidate();
    navigate(user.role === "admin" ? "/admin" : "/");
  };
  const login = trpc.waslAuth.login.useMutation({ onSuccess: finish, onError: error => toast.error(error.message) });
  const register = trpc.waslAuth.register.useMutation({ onSuccess: finish, onError: error => toast.error(error.message) });
  const bootstrap = trpc.waslAuth.bootstrapAdmin.useMutation({ onSuccess: finish, onError: error => toast.error(error.message) });
  const pending = login.isPending || register.isPending || bootstrap.isPending;
  const setupAvailable = Boolean(status.data?.setupRequired);
  const activeMode = setupAvailable && mode === "login" ? "setup" : mode;
  const heading = activeMode === "setup" ? "تهيئة مدير وَصل" : activeMode === "register" ? "إنشاء حساب وَصل" : "تسجيل الدخول إلى وَصل";
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (activeMode === "login") login.mutate({ email, password });
    else if (activeMode === "setup") bootstrap.mutate({ name, email, password });
    else register.mutate({ name, email, password });
  };
  return <main className="wasl-auth" dir="rtl"><section className="wasl-auth-card"><Link href="/" className="wasl-auth-brand"><span>و</span><b>وَصل</b></Link><div className="wasl-auth-copy"><span className="wasl-auth-icon">{activeMode === "setup" ? <ShieldCheck/> : <LockKeyhole/>}</span><h1>{heading}</h1><p>{activeMode === "setup" ? "أنشئ حساب المدير الأول لإدارة المنصة. يتم إغلاق هذه الخطوة تلقائيًا بعد التهيئة." : "حساب مستقل لمنصة وَصل. لا نستخدم أي حساب خارجي لتسجيل دخولك."}</p></div><form onSubmit={submit} className="wasl-auth-form">{activeMode !== "login" && <label>الاسم <span className="field-wrap"><UserRound size={16}/><input value={name} onChange={e => setName(e.target.value)} required minLength={2} autoComplete="name" placeholder="اسمك"/></span></label>}<label>البريد الإلكتروني <span className="field-wrap"><Mail size={16}/><input type="email" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email" placeholder="name@example.com"/></span></label><label>كلمة المرور <span className="field-wrap"><LockKeyhole size={16}/><input type={showPassword ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)} required minLength={activeMode === "login" ? 1 : 10} autoComplete={activeMode === "login" ? "current-password" : "new-password"} placeholder="10 أحرف على الأقل"/><button type="button" className="password-toggle" onClick={() => setShowPassword(value => !value)} aria-label={showPassword ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}>{showPassword ? <EyeOff size={16}/> : <Eye size={16}/>}</button></span></label><Button className="wasl-auth-submit" disabled={pending}>{pending ? "جارٍ التحقق…" : activeMode === "setup" ? "إنشاء حساب المدير" : activeMode === "register" ? "إنشاء الحساب" : "تسجيل الدخول"}<ArrowLeft size={16}/></Button></form>{!setupAvailable && <div className="wasl-auth-switch">{activeMode === "login" ? <>ليس لديك حساب؟ <button onClick={() => setMode("register")}>إنشاء حساب</button></> : <>لديك حساب بالفعل؟ <button onClick={() => setMode("login")}>تسجيل الدخول</button></>}</div>}<p className="wasl-auth-note">الجلسة محمية وآمنة، وتبقى أدوات الملفات المحلية مستقلة عن حسابك.</p></section></main>;
}
