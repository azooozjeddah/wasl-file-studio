import { Button } from "@/components/ui/button";
import { useLocale } from "@/contexts/LocaleContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, ChevronDown, KeyRound, Languages, LogOut, Menu, Moon, ShieldCheck, Sun, UserRound, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { Brand } from "./Brand";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  const { locale, setLocale, isArabic, t } = useLocale();
  const { theme, toggleTheme } = useTheme();
  const { user, logout } = useAuth();
  const [location] = useLocation();
  const [accountOpen, setAccountOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const settings = trpc.catalog.settings.useQuery();
  const isTool = location !== "/";

  useEffect(() => {
    if (location !== "/") return;
    const title = settings.data?.metaTitle || settings.data?.siteName;
    const description = settings.data?.metaDescription;
    if (title) document.title = title;
    let meta = document.querySelector('meta[name="description"]');
    if (description) {
      if (!meta) {
        meta = document.createElement("meta");
        meta.setAttribute("name", "description");
        document.head.appendChild(meta);
      }
      meta.setAttribute("content", description);
    }
  }, [location, settings.data?.metaTitle, settings.data?.metaDescription, settings.data?.siteName]);

  useEffect(() => {
    if (!mobileOpen) return;
    document.body.classList.add("mobile-menu-open");
    return () => document.body.classList.remove("mobile-menu-open");
  }, [mobileOpen]);

  const brandProps = { logoText: settings.data?.logoText, siteName: settings.data?.siteName, logoUrl: settings.data?.logoUrl };
  const closeMobile = () => setMobileOpen(false);
  const signOut = async () => {
    await logout();
    setAccountOpen(false);
    window.location.replace("/login");
  };

  return (
    <div className="min-h-screen wasl-app" style={{ "--wasl-accent": settings.data?.accentColor || "#6746E8" } as React.CSSProperties}>
      <header className="site-header">
        <div className="container header-inner">
          <Brand {...brandProps} />
          <nav className="desktop-nav" aria-label={t("التنقل الرئيسي", "Main navigation")}>
            <Link href="/" className={location === "/" ? "is-active" : ""}>{t("الرئيسية", "Home")}</Link>
            <Link href="/tools" className={location.startsWith("/tools") ? "is-active" : ""}>{t("الأدوات", "Tools")}</Link>
            <a href="/#faq">{t("مركز المساعدة", "Help center")}</a>
            {isTool && !location.startsWith("/tools") && <Link href="/tools" className="inline-flex items-center gap-1 text-foreground font-medium"><ArrowLeft size={15} className={isArabic ? "rotate-180" : ""} />{t("كل الأدوات", "All tools")}</Link>}
          </nav>
          <div className="header-actions">
            <Button variant="ghost" size="icon" className="locale-control" aria-label="switch language" onClick={() => setLocale(locale === "ar" ? "en" : "ar")}><Languages size={17} /><span className="hidden lg:inline">{isArabic ? "العربية" : "English"}</span></Button>
            <Button variant="ghost" size="icon" className="theme-control" aria-label="toggle theme" onClick={toggleTheme}>{theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}</Button>
            {user ? (
              <div className="relative">
                <Button variant="ghost" onClick={() => setAccountOpen(value => !value)} className="gap-2 px-2" aria-expanded={accountOpen}>
                  <span className="grid size-7 place-items-center rounded-full bg-violet-100 text-violet-700"><UserRound size={15} /></span>
                  <span className="max-w-20 truncate text-xs sm:max-w-28 sm:text-sm">{user.name?.trim().split(/\s+/)[0] || "حسابي"}</span>
                  <ChevronDown size={14} />
                </Button>
                {accountOpen && <div className="absolute end-0 top-full z-50 mt-2 w-52 rounded-xl border bg-popover p-1 text-popover-foreground shadow-lg">
                  <Link href="/dashboard" onClick={() => setAccountOpen(false)} className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-muted"><UserRound size={15} />حسابي</Link>
                  <Link href="/account/security" onClick={() => setAccountOpen(false)} className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-muted"><KeyRound size={15} />أمان الحساب</Link>
                  <button onClick={signOut} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-red-600 hover:bg-red-50"><LogOut size={15} />تسجيل الخروج</button>
                </div>}
              </div>
            ) : <Button variant="ghost" className="header-login header-login-primary" asChild><Link href="/login">{t("تسجيل الدخول", "Login")}</Link></Button>}
            {user?.role === "admin" && <Link href="/admin"><Button className="hidden lg:inline-flex gap-2 wasl-admin-btn"><ShieldCheck size={15} />{t("الإدارة", "Admin")}</Button></Link>}
            <Button variant="ghost" size="icon" className="mobile-menu-trigger" aria-label={t("فتح القائمة", "Open menu")} aria-expanded={mobileOpen} onClick={() => setMobileOpen(value => !value)}>{mobileOpen ? <X size={20} /> : <Menu size={20} />}</Button>
          </div>
        </div>
        {mobileOpen && <div className="mobile-nav"><div className="container">
          <Link href="/" onClick={closeMobile}>{t("الرئيسية", "Home")}</Link>
          <Link href="/tools" onClick={closeMobile}>{t("الأدوات", "Tools")}</Link>
          {user?.role === "admin" && <Link href="/admin" onClick={closeMobile}>{t("لوحة الإدارة", "Admin panel")}</Link>}
          <a href="/#faq" onClick={closeMobile}>{t("مركز المساعدة", "Help center")}</a>
        </div></div>}
      </header>
      {children}
      <footer className="site-footer">
        <div className="container footer-grid">
          <div className="footer-brand"><Brand {...brandProps} /><p>{t("أدوات ملفات احترافية تعالج ملفاتك محليًا كلما كان ذلك ممكنًا، وتوضح لك الخطوة المناسبة بوضوح.", "Professional file tools that process locally whenever possible and make the next step clear.")}</p><div className="footer-socials" aria-label={t("روابط التواصل", "Social links")}><span>◉</span><span>◌</span><span>◍</span><span>◎</span></div></div>
          <div><p className="footer-title">{t("المنتجات", "Products")}</p><div className="footer-links"><Link href="/tools/pdf">{t("معالجة PDF", "PDF tools")}</Link><Link href="/tools/documents">{t("المستندات", "Documents")}</Link><Link href="/tools/images">{t("أدوات الصور", "Image tools")}</Link><Link href="/tools/qr">{t("أدوات QR", "QR tools")}</Link></div></div>
          <div><p className="footer-title">{t("الشركة", "Company")}</p><div className="footer-links"><Link href="/about">{t("من نحن", "About")}</Link><Link href="/contact">{t("اتصل بنا", "Contact")}</Link></div></div>
          <div><p className="footer-title">{t("المساعدة", "Help")}</p><div className="footer-links"><a href="/#faq">{t("مركز المساعدة", "Help center")}</a><Link href="/terms">{t("اتفاقية الاستخدام", "Terms")}</Link><Link href="/privacy">{t("سياسة الخصوصية", "Privacy")}</Link><Link href="/account/security">{t("أمان الحساب", "Account security")}</Link></div></div>
        </div>
        <div className="container footer-bottom"><span>© {new Date().getFullYear()} {settings.data?.siteName || "وصّل للملفات"}</span><span>{t("أدوات ملفات تعمل محليًا وتحترم خصوصيتك.", "Local-first file tools that respect your privacy.")}</span></div>
      </footer>
    </div>
  );
}
