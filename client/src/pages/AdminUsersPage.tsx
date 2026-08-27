import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Pencil,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Trash2,
  UserRoundCheck,
  UserRoundPlus,
  UserRoundX,
  UsersRound,
  X,
} from "lucide-react";
import { FormEvent, useState } from "react";
import { toast } from "sonner";
import { Link, useLocation } from "wouter";
import "@/admin-mobile.css";

type InviteRole = "user" | "admin";
type EditableUser = { id: number; name: string; email: string };

export default function AdminUsersPage() {
  const { user, loading } = useAuth();
  const [, navigate] = useLocation();
  const requestedRole = new URLSearchParams(window.location.search).get("create");
  const enabled = user?.role === "admin";
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [inviteOpen, setInviteOpen] = useState(requestedRole === "user" || requestedRole === "admin");
  const [invite, setInvite] = useState({ name: "", email: "", role: (requestedRole === "admin" ? "admin" : "user") as InviteRole });
  const [editing, setEditing] = useState<EditableUser | null>(null);

  const usersQuery = trpc.admin.users.useQuery({ page, pageSize: 20, search }, { enabled, retry: false });
  const plansQuery = trpc.admin.userPlans.useQuery(undefined, { enabled, retry: false });
  const toolsQuery = trpc.admin.tools.useQuery(undefined, { enabled, retry: false });
  const permissionsQuery = trpc.admin.userToolPermissions.useQuery({ userId: selectedUserId || 0 }, { enabled: enabled && selectedUserId !== null, retry: false });
  const refresh = () => { void usersQuery.refetch(); void plansQuery.refetch(); };
  const setRole = trpc.admin.setPlatformRole.useMutation({ onSuccess: () => { refresh(); toast.success("تم تحديث دور المستخدم."); }, onError: error => toast.error(error.message) });
  const setPlan = trpc.admin.setUserPlan.useMutation({ onSuccess: () => { refresh(); toast.success("تم تعيين الخطة المستقبلية للمستخدم."); }, onError: error => toast.error(error.message) });
  const setStatus = trpc.admin.setUserAccountStatus.useMutation({ onSuccess: () => { refresh(); toast.success("تم تحديث حالة الحساب."); }, onError: error => toast.error(error.message) });
  const deleteAccount = trpc.admin.deleteUserAccount.useMutation({ onSuccess: () => { refresh(); setSelectedUserId(null); toast.success("تم حذف الحساب وإبطال جلسته."); }, onError: error => toast.error(error.message) });
  const setToolPermission = trpc.admin.setUserToolPermission.useMutation({ onSuccess: () => { void permissionsQuery.refetch(); toast.success("تم تحديث صلاحية الأداة للمستخدم."); }, onError: error => toast.error(error.message) });
  const createUser = trpc.admin.createUser.useMutation({ onSuccess: () => { refresh(); setInviteOpen(false); setInvite({ name: "", email: "", role: "user" }); navigate("/admin/users"); toast.success("أُرسل رابط ضبط كلمة المرور إلى المستخدم."); }, onError: error => toast.error(error.message) });
  const updateUser = trpc.admin.updateUser.useMutation({ onSuccess: () => { refresh(); setEditing(null); toast.success("تم تحديث بيانات المستخدم."); }, onError: error => toast.error(error.message) });

  if (loading) return null;
  if (!enabled) return <main className="admin-denied"><ShieldCheck size={29}/><h1>إدارة المستخدمين محمية</h1><p>سجّل الدخول بحساب وَصل يملك صلاحية المدير للوصول إلى هذه الصفحة.</p><Button asChild><Link href="/login">تسجيل دخول المدير</Link></Button></main>;

  const plansByUser = new Map((plansQuery.data || []).map(item => [item.userId, item]));
  const blockedTools = new Set((permissionsQuery.data || []).filter(item => !item.isAllowed).map(item => item.toolSlug));
  const busy = setRole.isPending || setPlan.isPending || setStatus.isPending || deleteAccount.isPending || setToolPermission.isPending || createUser.isPending || updateUser.isPending;
  const totalPages = Math.max(1, Math.ceil((usersQuery.data?.total || 0) / 20));
  const submitInvite = (event: FormEvent) => { event.preventDefault(); createUser.mutate(invite); };
  const submitEdit = (event: FormEvent) => { event.preventDefault(); if (editing) updateUser.mutate({ userId: editing.id, name: editing.name, email: editing.email }); };

  return <DashboardLayout><main className="admin-page" dir="rtl">
    <header className="admin-titlebar"><div><span className="admin-kicker"><UsersRound size={14}/>إدارة وصول وَصل</span><h1>المستخدمون والأدوار</h1><p>الدعوات لا تكشف كلمات المرور؛ يضبط كل مستخدم كلمة مروره من رابط صالح لمرة واحدة.</p></div><div className="admin-actions"><Button onClick={() => { setInvite({ name: "", email: "", role: "user" }); setInviteOpen(true); }}><UserRoundPlus size={15}/>إضافة مستخدم</Button><Button variant="outline" onClick={() => { setInvite({ name: "", email: "", role: "admin" }); setInviteOpen(true); }}><ShieldCheck size={15}/>إضافة مدير</Button><Button variant="outline" asChild><Link href="/admin"><ArrowRight size={15}/>عودة لمركز التشغيل</Link></Button></div></header>

    {inviteOpen && <section className="admin-panel"><div className="panel-head"><div><h2>{invite.role === "admin" ? "دعوة مدير جديد" : "دعوة مستخدم جديد"}</h2><p>سيُنشأ الحساب برسالة دعوة آمنة؛ لا تُعرض أو تُحفظ كلمة مرور في لوحة الإدارة.</p></div><Button size="icon" variant="ghost" onClick={() => setInviteOpen(false)} aria-label="إغلاق"><X size={16}/></Button></div><form className="content-form" onSubmit={submitInvite}><label>الاسم<input value={invite.name} onChange={event => setInvite({ ...invite, name: event.target.value })} required minLength={2}/></label><label>البريد الإلكتروني<input type="email" value={invite.email} onChange={event => setInvite({ ...invite, email: event.target.value })} required/></label><label>الدور<select value={invite.role} onChange={event => setInvite({ ...invite, role: event.target.value as InviteRole })}><option value="user">مستخدم</option><option value="admin">مدير</option></select></label><div className="flex items-end"><Button disabled={busy}>{createUser.isPending ? "جارٍ إرسال الدعوة…" : "إنشاء وإرسال الدعوة"}</Button></div></form></section>}

    {editing && <section className="admin-panel"><div className="panel-head"><div><h2>تعديل بيانات المستخدم</h2><p>يتحقق الخادم من فريدة البريد قبل الحفظ.</p></div><Button size="icon" variant="ghost" onClick={() => setEditing(null)} aria-label="إغلاق"><X size={16}/></Button></div><form className="content-form" onSubmit={submitEdit}><label>الاسم<input value={editing.name} onChange={event => setEditing({ ...editing, name: event.target.value })} required minLength={2}/></label><label>البريد الإلكتروني<input type="email" value={editing.email} onChange={event => setEditing({ ...editing, email: event.target.value })} required/></label><div className="flex items-end"><Button disabled={busy}>حفظ البيانات</Button></div></form></section>}

    <section className="admin-panel"><div className="panel-head"><div><h2>مستخدمو المنصة</h2><p>نتائج مقسمة من الخادم؛ لا تعرض محتوى الملفات أو عمليات المستخدم الخاصة.</p></div><span>{usersQuery.data?.total || 0} مستخدم</span></div><div className="mb-4 flex flex-wrap gap-2"><div className="relative min-w-64 flex-1"><Search className="absolute right-3 top-3 text-muted-foreground" size={16}/><input className="w-full rounded-xl border bg-background py-2 pr-9 pl-3" value={search} onChange={event => { setSearch(event.target.value); setPage(1); }} placeholder="ابحث بالاسم أو البريد"/></div>{search && <Button variant="outline" onClick={() => setSearch("")}>مسح البحث</Button>}</div>
      {usersQuery.isLoading ? <div className="admin-loading">تحميل المستخدمين…</div> : <><div className="user-admin-list">{usersQuery.data?.items.map(item => {
        const plan = plansByUser.get(item.id); const isCurrent = item.id === user.id; const isSuspended = item.accountStatus === "suspended";
        return <div key={item.id} className="user-admin-row"><span className="user-avatar">{(item.name || item.email || "U").slice(0, 1)}</span><div className="min-w-0"><b>{item.name || "مستخدم بلا اسم"}</b><small>{item.email || "بدون بريد"} · آخر دخول {new Date(item.lastSignedIn).toLocaleDateString("ar-SA")}</small><span className={isSuspended ? "mt-1 inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800" : "mt-1 inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-800"}>{isSuspended ? "معطل" : "نشط"}</span></div><label>دور المنصة<select value={item.role} disabled={busy || isCurrent} onChange={event => setRole.mutate({ userId: item.id, role: event.target.value as InviteRole })}><option value="user">مستخدم</option><option value="admin">مدير</option></select></label><label>خطة مستقبلية<select value={plan?.planCode || "free"} disabled={busy} onChange={event => setPlan.mutate({ userId: item.id, planCode: event.target.value as "free" | "basic" | "pro" | "business", status: "active" })}><option value="free">Free</option><option value="basic">Basic</option><option value="pro">Pro</option><option value="business">Business</option></select></label><div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" disabled={busy} onClick={() => setEditing({ id: item.id, name: item.name || "", email: item.email || "" })}><Pencil size={14}/>تعديل</Button><Button size="sm" variant="outline" onClick={() => setSelectedUserId(selectedUserId === item.id ? null : item.id)}><SlidersHorizontal size={14}/>أدواته</Button>{isSuspended ? <Button size="sm" variant="outline" disabled={busy} onClick={() => { if (window.confirm(`إعادة تفعيل حساب ${item.name || item.email}؟`)) setStatus.mutate({ userId: item.id, accountStatus: "active" }); }}><UserRoundCheck size={14}/>تفعيل</Button> : <Button size="sm" variant="outline" disabled={busy || isCurrent} onClick={() => { if (window.confirm(`تعطيل حساب ${item.name || item.email}؟ لن يستطيع الدخول حتى تفعيله مجددًا.`)) setStatus.mutate({ userId: item.id, accountStatus: "suspended" }); }}><UserRoundX size={14}/>تعطيل</Button>}<Button size="sm" variant="destructive" disabled={busy || isCurrent} onClick={() => { if (window.confirm(`حذف حساب ${item.name || item.email} نهائيًا؟ سيُبطل ذلك أي جلسة نشطة.`)) deleteAccount.mutate({ userId: item.id }); }}><Trash2 size={14}/>حذف</Button></div>{selectedUserId === item.id && <div className="col-span-full rounded-xl border bg-muted/30 p-3"><b>صلاحيات أدوات {item.name || item.email}</b><p className="mt-1 text-xs text-muted-foreground">الأداة متاحة افتراضيًا؛ اضغط «منع» لتعطيلها لهذا المستخدم فقط.</p><div className="mt-3 flex flex-wrap gap-2">{toolsQuery.data?.map(tool => <Button key={tool.slug} size="sm" variant={blockedTools.has(tool.slug) ? "destructive" : "outline"} disabled={busy} onClick={() => setToolPermission.mutate({ userId: item.id, toolSlug: tool.slug, isAllowed: blockedTools.has(tool.slug) })}>{blockedTools.has(tool.slug) ? `منع ${tool.nameAr}` : `سماح ${tool.nameAr}`}</Button>)}</div></div>}</div>;
      })}{!usersQuery.data?.items.length && <div className="admin-empty"><UsersRound size={22}/><b>لا توجد نتائج</b><p>{search ? "جرّب بحثًا مختلفًا." : "سيظهر كل مستخدم هنا فور إنشاء حسابه."}</p></div>}</div><div className="mt-5 flex items-center justify-between gap-3"><small>الصفحة {page} من {totalPages}</small><div className="flex gap-2"><Button size="sm" variant="outline" disabled={page <= 1 || usersQuery.isFetching} onClick={() => setPage(page - 1)}><ArrowRight size={15}/>السابق</Button><Button size="sm" variant="outline" disabled={page >= totalPages || usersQuery.isFetching} onClick={() => setPage(page + 1)}>التالي<ArrowLeft size={15}/></Button></div></div></>}
    </section>
    <section className="admin-panel"><div className="flex items-start gap-3 text-sm text-muted-foreground"><CheckCircle2 className="mt-0.5 text-emerald-600" size={18}/><p>جميع العمليات الحساسة محمية في الخادم. لا يمكن حذف أو تعطيل أو خفض دور المدير الحالي أو آخر مدير نشط، وحذف الحساب ينظف صلاحيات الأدوات والخطة والأدوار وسجل الاسترداد والوظائف المرتبطة.</p></div></section>
  </main></DashboardLayout>;
}
