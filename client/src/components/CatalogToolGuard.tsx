import PublicLayout from "@/components/PublicLayout";
import { trpc } from "@/lib/trpc";
import { Link } from "wouter";

export default function CatalogToolGuard({ slug, children }: { slug: string; children: React.ReactNode }) {
  const availability = trpc.catalog.availability.useQuery({ slug });
  const catalog = trpc.catalog.list.useQuery();
  const missingFromManagedCatalog = Boolean(catalog.data?.length && !catalog.data.some((tool) => tool.slug === slug));
  const inMaintenance = availability.data?.lifecycleStatus === "maintenance";
  const unavailable = missingFromManagedCatalog || Boolean(availability.data && (!availability.data.isActive || availability.data.lifecycleStatus === "disabled" || availability.data.isAllowed === false || inMaintenance));

  if (availability.isLoading || catalog.isLoading) return <>{children}</>;
  if (!unavailable) return <>{children}</>;

  return <PublicLayout><main className="tool-page"><div className="container"><section className="mx-auto my-16 max-w-xl rounded-3xl border bg-card p-8 text-center shadow-sm"><span className="section-eyebrow">{inMaintenance ? "قيد الصيانة" : "غير متاحة"}</span><h1 className="mt-3 text-2xl font-bold">{inMaintenance ? "هذه الأداة قيد الصيانة حاليًا" : "هذه الأداة غير متاحة حاليًا"}</h1><p className="mt-3 leading-7 text-muted-foreground">{inMaintenance ? "أوقفنا المعالجة مؤقتًا حتى يكتمل التحقق من النتيجة. لم تتم معالجة أي ملف." : "تم إيقاف الأداة من الكتالوج أو لم تعد متاحة لحسابك. لم تتم معالجة أي ملف."}</p><Link href="/tools" className="mt-6 inline-flex rounded-xl bg-violet-600 px-5 py-3 font-semibold text-white">العودة إلى الأدوات</Link></section></div></main></PublicLayout>;
}
