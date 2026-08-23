import { Aperture } from "lucide-react";
import { Link } from "wouter";
import { useLocale } from "@/contexts/LocaleContext";

export function Brand({ compact = false, logoText, siteName, logoUrl }: { compact?: boolean; logoText?: string | null; siteName?: string | null; logoUrl?: string | null }) {
  const { isArabic } = useLocale();
  const word = logoText || (isArabic ? "وَصل" : "WASL"); const sub = siteName || (isArabic ? "للملفات" : "FILE STUDIO");
  const localLogoUrl = logoUrl && (logoUrl.startsWith("/") || logoUrl.startsWith(window.location.origin)) ? logoUrl : undefined;
  return <Link href="/" className="inline-flex items-center gap-2.5 no-underline group"><span className="brand-mark">{localLogoUrl ? <img src={localLogoUrl} alt=""/> : <Aperture size={compact ? 17 : 20} strokeWidth={2.4} />}</span>{!compact && <span className="leading-none"><b className="brand-word">{word}</b><small className="brand-sub">{sub}</small></span>}</Link>;
}
