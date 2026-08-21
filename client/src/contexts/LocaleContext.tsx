import { createContext, useContext, useEffect, useMemo, useState } from "react";

type Locale = "ar" | "en";
type LocaleContextValue = { locale: Locale; setLocale: (locale: Locale) => void; isArabic: boolean; t: (ar: string, en: string) => string };
const LocaleContext = createContext<LocaleContextValue | undefined>(undefined);

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocale] = useState<Locale>(() => (localStorage.getItem("wasl-locale") as Locale) || "ar");
  useEffect(() => { localStorage.setItem("wasl-locale", locale); document.documentElement.lang = locale; document.documentElement.dir = locale === "ar" ? "rtl" : "ltr"; }, [locale]);
  const value = useMemo(() => ({ locale, setLocale, isArabic: locale === "ar", t: (ar: string, en: string) => locale === "ar" ? ar : en }), [locale]);
  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale() { const context = useContext(LocaleContext); if (!context) throw new Error("useLocale must be used within LocaleProvider"); return context; }
