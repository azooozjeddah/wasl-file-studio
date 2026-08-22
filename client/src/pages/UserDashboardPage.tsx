import PublicLayout from "@/components/PublicLayout";
import ToolCard from "@/components/ToolCard";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/_core/hooks/useAuth";
import { findTool } from "@/lib/tools";
import { readRecentTools } from "@/lib/user-recent-tools";
import { ArrowLeft, Clock3, LayoutGrid, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "wouter";

export default function UserDashboardPage() {
  const { user, loading } = useAuth({ redirectOnUnauthenticated: true, redirectPath: "/login" });
  const [recentSlugs, setRecentSlugs] = useState<string[]>([]);
  useEffect(() => { if (user) setRecentSlugs(readRecentTools(user.id).map(item => item.slug)); }, [user]);
  if (loading || !user) return null;
  const recentTools = recentSlugs.map(findTool).filter(Boolean);
  const accountName = user.name?.trim() || "مستخدم وَصل";
  const firstName = accountName.split(/\s+/)[0] || accountName;
  return <PublicLayout><main className="container py-8 md:py-12"><section className="rounded-[28px] border border-violet-100 bg-gradient-to-bl from-violet-50 via-background to-background p-6 shadow-sm md:p-10"><div className="flex flex-col gap-7 md:flex-row md:items-end md:justify-between"><div className="max-w-2xl"><span className="inline-flex items-center gap-2 rounded-full bg-violet-100 px-3 py-1 text-xs font-semibold text-violet-700"><Sparkles size={14}/>لوحة وَصل</span><h1 className="mt-4 text-3xl font-bold tracking-tight md:text-4xl">مرحبًا، {firstName} 👋</h1><p className="mt-3 text-base leading-8 text-muted-foreground">أهلًا بك في وصل — أدواتك لمعالجة الملفات بسهولة.</p></div><Link href="/#tools"><Button size="lg" className="gap-2">ابدأ باستخدام الأدوات <ArrowLeft size={17}/></Button></Link></div></section><section className="mt-10"><div className="mb-5 flex items-end justify-between gap-4"><div><p className="text-sm font-semibold text-violet-600">مساحتك</p><h2 className="mt-1 text-2xl font-bold">{recentTools.length ? "آخر أدواتك" : "مرحبًا بك في وصل"}</h2><p className="mt-2 text-sm text-muted-foreground">{recentTools.length ? "ارجع بسرعة إلى الأدوات التي استخدمتها مؤخرًا." : "مرحبًا بك في وصل، اختر إحدى الأدوات للبدء."}</p></div>{recentTools.length > 0 && <Link href="/#tools" className="hidden items-center gap-1 text-sm font-semibold text-violet-700 sm:inline-flex">جميع الأدوات <ArrowLeft size={15}/></Link>}</div>{recentTools.length ? <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{recentTools.map((tool, index) => tool && <ToolCard key={tool.slug} tool={tool} index={index}/>)}</div> : <div className="rounded-2xl border border-dashed border-violet-200 bg-violet-50/50 p-7"><Clock3 className="mb-3 text-violet-600" size={24}/><p className="font-semibold">لا توجد أدوات سابقة بعد</p><p className="mt-1 text-sm text-muted-foreground">كل أداة تستخدمها ستظهر هنا على هذا الجهاز لتسهيل العودة إليها.</p></div>}</section><section id="all-tools" className="mt-10 rounded-2xl border bg-card p-6"><div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><div className="flex items-center gap-2 font-bold"><LayoutGrid size={19} className="text-violet-600"/>جميع الأدوات</div><p className="mt-1 text-sm text-muted-foreground">PDF وصور ومستندات وExcel وQR وأدوات محلية أخرى.</p></div><Link href="/#tools"><Button variant="outline">عرض جميع الأدوات</Button></Link></div></section></main></PublicLayout>;
}
