import { Aperture } from "lucide-react";
import { Link } from "wouter";
import { useLocale } from "@/contexts/LocaleContext";

export function Brand({ compact = false }: { compact?: boolean }) {
  const { isArabic } = useLocale();
  return <Link href="/" className="inline-flex items-center gap-2.5 no-underline group"><span className="brand-mark"><Aperture size={compact ? 17 : 20} strokeWidth={2.4} /></span>{!compact && <span className="leading-none"><b className="brand-word">{isArabic ? "وَصل" : "WASL"}</b><small className="brand-sub">{isArabic ? "للملفات" : "FILE STUDIO"}</small></span>}</Link>;
}
