import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, Eye, EyeOff, KeyRound, LockKeyhole, Mail, ShieldCheck, UserRound } from "lucide-react";
import { FormEvent, useState } from "react";
import { Link, useLocation } from "wouter";
import { toast } from "sonner";

type Mode = "login" | "register" | "setup" | "forgot" | "reset";

export default function LoginPage() {
  const [location, navigate] = useLocation();
  const status = trpc.waslAuth.status.useQuery(undefined, { retry: false });
  const resetToken = new URLSearchParams(window.location.search).get("token") || "";
  const [mode, setMode] = useState<Mode>(resetToken ? "reset" : location === "/register" ? "register" : "login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const utils = trpc.useUtils();
  const finish = async (user: { role: "admin" | "user" }) => {
    await utils.waslAuth.me.invalidate();
    navigate("/dashboard");
  };
  const login = trpc.waslAuth.login.useMutation({ onSuccess: finish, onError: error => toast.error(error.message) });
  const register = trpc.waslAuth.register.useMutation({ onSuccess: finish, onError: error => toast.error(error.message) });
  const bootstrap = trpc.waslAuth.bootstrapAdmin.useMutation({ onSuccess: finish, onError: error => toast.error(error.message) });
  const requestReset = trpc.waslAuth.requestPasswordReset.useMutation({ onSuccess: () => { toast.success("إذا كان البريد مسجلًا، أرسلنا رابطًا آمنًا لإعادة التعيين."); setMode("login"); }, onError: () => { toast.success("إذا كان البريد مسجلًا، أرسلنا رابطًا آمنًا لإعادة التعيين."); setMode("login"); } });
  const resetPassword = trpc.waslAuth.resetPassword.useMutation({ onSuccess: () => { toast.success("تم تعيين كلمة المرور الجديدة. يمكنك تسجيل الدخول الآن."); setPassword(""); setMode("login"); navigate("/login"); }, onError: error => toast.error(error.message) });
  const pending = login.isPending || register.isPending || bootstrap.isPending || requestReset.isPending || resetPassword.isPending;
  const setupAvailable = Boolean(status.data?.setupRequired);
  const activeMode = setupAvailable && mode === "login" ? "setup" : mode;
  const heading = activeMode === "setup" ? "تهيئة مدير وَصل" : activeMode === "register" ? "إنشاء حساب وَصل" : activeMode === "forgot" ? "استعادة كلمة المرور" : activeMode === "reset" ? "كلمة مرور جديدة" : "تسجيل الدخول إلى وَصل";
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (activeMode === "login") login.mutate({ email, password });
    else if (activeMode === "setup") bootstrap.mutate({ name, email, password });
    else if (activeMode === "register") register.mutate({ name, email, password });
    else if (activeMode === "forgot") requestReset.mutate({ email });
    else resetPassword.mutate({ token: resetToken, nextPassword: password });
  };
  const showName = activeMode === "register" || activeMode === "setup";
  const showEmail = activeMode !== "reset";
  const needsPassword = activeMode !== "forgot";
  const submitLabel = activeMode === "setup" ? "إنشاء حساب المدير" : activeMode === "register" ? "إنشاء الحساب" : activeMode === "forgot" ? "إرسال رابط الاستعادة" : activeMode === "reset" ? "حفظ كلمة المرور الجديدة" : "تسجيل الدخول";
  const description = activeMode === "setup" ? "أنشئ حساب المدير الأول لإدارة المنصة. يتم إغلاق هذه الخطوة تلقائيًا بعد التهيئة." : activeMode === "forgot" ? "أدخل بريدك وسنرسل رابطًا صالحًا لمدة 30 دقيقة إذا كان الحساب موجودًا." : activeMode === "reset" ? "اختر كلمة مرور قوية وجديدة لحساب وَصل." : "حساب مستقل لمنصة وَصل. لا نستخدم أي حساب خارجي لتسجيل دخولك.";
  return <main className="wasl-auth" dir="rtl"><section className="wasl-auth-card"><Link href="/" className="wasl-auth-brand"><span>و</span><b>وَصل</b></Link><div className="wasl-auth-copy"><span className="wasl-auth-icon">{activeMode === "setup" ? <ShieldCheck/> : activeMode === "forgot" || activeMode === "reset" ? <KeyRound/> : <LockKeyhole/>}</span><h1>{heading}</h1><p>{description}</p></div><form onSubmit={submit} className="wasl-auth-form">{showName && <label>الاسم <span className="field-wrap"><UserRound size={16}/><input value={name} onChange={e => setName(e.target.value)} required minLength={2} autoComplete="name" placeholder="اسمك"/></span></label>}{showEmail && <label>البريد الإلكتروني <span className="field-wrap"><Mail size={16}/><input type="email" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email" placeholder="name@example.com"/></span></label>}{needsPassword && <label>{activeMode === "reset" ? "كلمة المرور الجديدة" : "كلمة المرور"}<span className="field-wrap"><LockKeyhole size={16}/><input type={showPassword ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)} required minLength={activeMode === "login" ? 1 : 10} autoComplete={activeMode === "login" ? "current-password" : "new-password"} placeholder="10 أحرف على الأقل"/><button type="button" className="password-toggle" onClick={() => setShowPassword(value => !value)} aria-label={showPassword ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}>{showPassword ? <EyeOff size={16}/> : <Eye size={16}/>}</button></span></label>}<Button className="wasl-auth-submit" disabled={pending}>{pending ? "جارٍ التحقق…" : submitLabel}<ArrowLeft size={16}/></Button></form>{!setupAvailable && <div className="wasl-auth-switch">{activeMode === "login" ? <><button onClick={() => setMode("forgot")}>نسيت كلمة المرور؟</button><span>·</span><span>ليس لديك حساب؟ <button onClick={() => setMode("register")}>إنشاء حساب</button></span></> : <button onClick={() => { setMode("login"); navigate("/login"); }}>العودة إلى تسجيل الدخول</button>}</div>}<p className="wasl-auth-note">الجلسة محمية وآمنة، وتبقى أدوات الملفات المحلية مستقلة عن حسابك.</p></section></main>;
}
