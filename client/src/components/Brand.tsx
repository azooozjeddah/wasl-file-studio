import { Link2 } from "lucide-react";
import { Link } from "wouter";
import { useLocale } from "@/contexts/LocaleContext";

export function Brand({ compact = false, logoText, siteName, logoUrl }: { compact?: boolean; logoText?: string | null; siteName?: string | null; logoUrl?: string | null }) {
  const { isArabic } = useLocale();
  const word = logoText || (isArabic ? "وصّل" : "WASL"); const sub = siteName || (isArabic ? "للملفات" : "FILE STUDIO");
  const localLogoUrl = logoUrl && (logoUrl.startsWith("/") || logoUrl.startsWith(window.location.origin)) ? logoUrl : undefined;
  if (localLogoUrl && !compact) return <Link href="/" className="brand-link brand-link-image inline-flex no-underline group" aria-label={isArabic ? "وصّل للملفات" : "Wasl File Studio"}><img className="brand-reference-logo" src={localLogoUrl} crossOrigin="anonymous" alt={isArabic ? "وصّل للملفات" : "Wasl File Studio"}/></Link>;
  return <Link href="/" className="brand-link inline-flex items-center gap-2.5 no-underline group" aria-label={isArabic ? "وصّل للملفات" : "Wasl File Studio"}><span className="brand-mark"><Link2 size={compact ? 18 : 22} strokeWidth={2.65} /></span>{!compact && <span className="leading-none"><b className="brand-word">{word}</b><small className="brand-sub">{sub}</small></span>}</Link>;
}
