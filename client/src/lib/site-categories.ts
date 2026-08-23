import { Braces, FileImage, FileSpreadsheet, FileText, FileType2, QrCode, SlidersHorizontal, Video, type LucideIcon } from "lucide-react";
import { toolDefinitions, type ToolDefinition } from "./tools";

export type SiteCategoryId = "pdf" | "documents" | "excel" | "images" | "media" | "qr" | "developer-data" | "other";

export type SiteToolCategory = {
  id: SiteCategoryId;
  slug: string;
  labelAr: string;
  labelEn: string;
  descriptionAr: string;
  descriptionEn: string;
  icon: LucideIcon;
  tone: "violet" | "blue" | "emerald" | "amber" | "rose" | "cyan" | "slate";
};

export const siteToolCategories: SiteToolCategory[] = [
  { id: "pdf", slug: "pdf", labelAr: "PDF", labelEn: "PDF", descriptionAr: "تنظيم، ضغط، توقيع، وحماية ملفات PDF.", descriptionEn: "Organize, compress, sign, and protect PDFs.", icon: FileType2, tone: "violet" },
  { id: "documents", slug: "documents", labelAr: "المستندات", labelEn: "Documents", descriptionAr: "تحويل Word والنصوص واستخراج المحتوى.", descriptionEn: "Convert Word and text documents, or extract content.", icon: FileText, tone: "blue" },
  { id: "excel", slug: "excel", labelAr: "Excel والجداول", labelEn: "Excel & sheets", descriptionAr: "تحويل وتصدير ودمج أوراق العمل محليًا.", descriptionEn: "Convert, export, and merge sheets locally.", icon: FileSpreadsheet, tone: "emerald" },
  { id: "images", slug: "images", labelAr: "الصور", labelEn: "Images", descriptionAr: "تحويل، ضغط، تغيير حجم، وتحرير الصور.", descriptionEn: "Convert, compress, resize, and edit images.", icon: FileImage, tone: "amber" },
  { id: "media", slug: "media", labelAr: "الفيديو والصوت", labelEn: "Video & audio", descriptionAr: "أدوات الوسائط المتاحة مع حالة كل مسار بوضوح.", descriptionEn: "Available media tools with clear readiness states.", icon: Video, tone: "rose" },
  { id: "qr", slug: "qr", labelAr: "QR", labelEn: "QR", descriptionAr: "إنشاء وقراءة رموز QR مع معاينة محلية.", descriptionEn: "Create and read QR codes with a local preview.", icon: QrCode, tone: "cyan" },
  { id: "developer-data", slug: "developer-data", labelAr: "المطورون والبيانات", labelEn: "Developer & data", descriptionAr: "فحص سلامة الملفات وأدوات البيانات العملية.", descriptionEn: "File-integrity checks and practical data tools.", icon: Braces, tone: "slate" },
  { id: "other", slug: "other", labelAr: "أدوات أخرى", labelEn: "Other tools", descriptionAr: "مساحة جاهزة للأدوات المستقبلية المتخصصة.", descriptionEn: "A ready place for future specialist tools.", icon: SlidersHorizontal, tone: "slate" },
];

export function siteCategoryForTool(tool: ToolDefinition): SiteCategoryId {
  if (tool.category === "pdf" || tool.category === "sign") return "pdf";
  if (tool.category === "document" || tool.category === "ocr") return "documents";
  if (tool.category === "spreadsheet") return "excel";
  if (tool.category === "image") return "images";
  if (tool.category === "audio" || tool.category === "video") return "media";
  if (tool.category === "code") return "qr";
  if (tool.category === "utility") return "developer-data";
  return "other";
}

export function toolsForSiteCategory(categoryId: SiteCategoryId, source = toolDefinitions) {
  return source.filter((tool) => siteCategoryForTool(tool) === categoryId);
}

export function findSiteCategory(slug: string) {
  return siteToolCategories.find((category) => category.slug === slug);
}
