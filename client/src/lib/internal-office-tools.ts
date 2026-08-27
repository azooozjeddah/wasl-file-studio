import { FileSpreadsheet, FileText, LockKeyhole, LockOpen, type LucideIcon } from "lucide-react";
import type { ToolDefinition } from "./tools";

export const officeOperations = [
  "protect-word",
  "unlock-word",
  "protect-excel",
  "unlock-excel",
  "protect-powerpoint",
  "unlock-powerpoint",
] as const;

export type OfficeOperation = (typeof officeOperations)[number];
export type InternalOfficeToolDefinition = ToolDefinition & { slug: OfficeOperation };

const word = FileText;
const spreadsheet = FileSpreadsheet;

export const internalOfficeTools: InternalOfficeToolDefinition[] = [
  { slug: "protect-word", category: "document", icon: LockKeyhole, labelAr: "حماية Word بكلمة مرور", labelEn: "Protect Word with password", descriptionAr: "أنشئ نسخة DOCX مشفرة بكلمة مرور فتح عبر خدمة داخلية مؤقتة.", descriptionEn: "Create a DOCX copy encrypted with an open password through a temporary internal service.", formats: ["DOCX"], accepts: [".docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"], settings: ["password"], local: false, processingMode: "server" },
  { slug: "unlock-word", category: "document", icon: LockOpen, labelAr: "فك حماية Word", labelEn: "Unlock Word", descriptionAr: "أنشئ نسخة DOCX غير مشفرة عندما تملك كلمة مرور الفتح الصحيحة.", descriptionEn: "Create an unencrypted DOCX copy when you have the correct open password.", formats: ["DOCX"], accepts: [".docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"], settings: ["password"], local: false, processingMode: "server" },
  { slug: "protect-excel", category: "spreadsheet", icon: LockKeyhole, labelAr: "حماية Excel بكلمة مرور", labelEn: "Protect Excel with password", descriptionAr: "أنشئ نسخة XLSX مشفرة بكلمة مرور فتح عبر خدمة داخلية مؤقتة.", descriptionEn: "Create an XLSX copy encrypted with an open password through a temporary internal service.", formats: ["XLSX"], accepts: [".xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"], settings: ["password"], local: false, processingMode: "server" },
  { slug: "unlock-excel", category: "spreadsheet", icon: LockOpen, labelAr: "فك حماية Excel", labelEn: "Unlock Excel", descriptionAr: "أنشئ نسخة XLSX غير مشفرة عندما تملك كلمة مرور الفتح الصحيحة.", descriptionEn: "Create an unencrypted XLSX copy when you have the correct open password.", formats: ["XLSX"], accepts: [".xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"], settings: ["password"], local: false, processingMode: "server" },
  { slug: "protect-powerpoint", category: "document", icon: LockKeyhole, labelAr: "حماية PowerPoint بكلمة مرور", labelEn: "Protect PowerPoint with password", descriptionAr: "أنشئ نسخة PPTX مشفرة بكلمة مرور فتح عبر خدمة داخلية مؤقتة.", descriptionEn: "Create a PPTX copy encrypted with an open password through a temporary internal service.", formats: ["PPTX"], accepts: [".pptx", "application/vnd.openxmlformats-officedocument.presentationml.presentation"], settings: ["password"], local: false, processingMode: "server" },
  { slug: "unlock-powerpoint", category: "document", icon: LockOpen, labelAr: "فك حماية PowerPoint", labelEn: "Unlock PowerPoint", descriptionAr: "أنشئ نسخة PPTX غير مشفرة عندما تملك كلمة مرور الفتح الصحيحة.", descriptionEn: "Create an unencrypted PPTX copy when you have the correct open password.", formats: ["PPTX"], accepts: [".pptx", "application/vnd.openxmlformats-officedocument.presentationml.presentation"], settings: ["password"], local: false, processingMode: "server" },
];

export const findInternalOfficeTool = (slug: OfficeOperation) => internalOfficeTools.find(tool => tool.slug === slug);
export const internalOfficeIconFor = (tool: InternalOfficeToolDefinition): LucideIcon => {
  if (tool.slug.endsWith("excel")) return spreadsheet;
  return word;
};
