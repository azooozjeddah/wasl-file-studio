import JsBarcode from "jsbarcode";
import QRCode, { type QRCodeErrorCorrectionLevel } from "qrcode";
import { jsPDF } from "jspdf";

export type QrKind = "url" | "text" | "phone" | "email" | "wifi" | "sms" | "whatsapp" | "vcard";
export type BarcodeFormat = "CODE128" | "CODE39" | "EAN13" | "EAN8" | "UPC";

export function qrLogoSafety(hasLogo: boolean, sizePercent: number, correction: QRCodeErrorCorrectionLevel) {
  if (!hasLogo) return { safe: true, level: "none" as const };
  if (correction !== "H") return { safe: false, level: "correction" as const, message: "يحتاج الشعار إلى مستوى تصحيح H." };
  if (sizePercent > 22) return { safe: false, level: "size" as const, message: "حجم الشعار أكبر من الحد الآمن للمسح." };
  if (sizePercent > 18) return { safe: true, level: "caution" as const, message: "الحجم مرتفع؛ اختبر المسح قبل مشاركة الرمز." };
  return { safe: true, level: "safe" as const };
}

export function addQrLogoToSvg(svg: string, logoDataUrl?: string, sizePercent = 16) {
  if (!logoDataUrl) return svg;
  const viewBox = svg.match(/viewBox="([^"]+)"/i)?.[1]?.trim().split(/\s+/).map(Number);
  const [left, top, width, height] = viewBox && viewBox.length === 4 && viewBox.every(Number.isFinite) ? viewBox : [0, 0, 320, 320];
  const side = Math.min(width, height) * (sizePercent / 100); const x = left + (width - side) / 2; const y = top + (height - side) / 2; const padding = side * 0.14;
  const href = logoDataUrl.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
  const overlay = `<g id="qr-logo-layer"><rect x="${x - padding}" y="${y - padding}" width="${side + padding * 2}" height="${side + padding * 2}" rx="${padding * .72}" fill="#ffffff"/><image href="${href}" x="${x}" y="${y}" width="${side}" height="${side}" preserveAspectRatio="xMidYMid meet"/></g>`;
  return svg.replace(/<\/svg>\s*$/i, `${overlay}</svg>`);
}

export function qrPayload(kind: QrKind, fields: Record<string, string>) {
  const value = fields.value?.trim() || "";
  if (kind === "url") return value.startsWith("http") ? value : `https://${value}`;
  if (kind === "phone") return `tel:${value.replace(/\s/g, "")}`;
  if (kind === "email") return `mailto:${fields.email || value}?subject=${encodeURIComponent(fields.subject || "")}&body=${encodeURIComponent(fields.body || "")}`;
  if (kind === "wifi") return `WIFI:T:${fields.security || "WPA"};S:${fields.ssid || ""};P:${fields.password || ""};;`;
  if (kind === "sms") return `SMSTO:${fields.phone || value}:${fields.message || ""}`;
  if (kind === "whatsapp") return `https://wa.me/${(fields.phone || value).replace(/\D/g, "")}${fields.message ? `?text=${encodeURIComponent(fields.message)}` : ""}`;
  if (kind === "vcard") return `BEGIN:VCARD\nVERSION:3.0\nFN:${fields.name || value}\nTEL:${fields.phone || ""}\nEMAIL:${fields.email || ""}\nORG:${fields.organization || ""}\nEND:VCARD`;
  return value;
}

export async function makeQrSvg(payload: string, options: { size: number; dark: string; light: string; correction: QRCodeErrorCorrectionLevel }) {
  if (!payload.trim()) throw new Error("أدخل محتوى لإنشاء رمز QR.");
  return QRCode.toString(payload, { type: "svg", width: options.size, margin: 2, errorCorrectionLevel: options.correction, color: { dark: options.dark, light: options.light } });
}

export async function makeQrPng(payload: string, options: { size: number; dark: string; light: string; correction: QRCodeErrorCorrectionLevel }) {
  return QRCode.toDataURL(payload, { width: options.size, margin: 2, errorCorrectionLevel: options.correction, color: { dark: options.dark, light: options.light } });
}

function checksum(value: string) {
  let total = 0;
  for (let i = value.length - 1; i >= 0; i--) total += Number(value[i]) * ((value.length - i) % 2 === 0 ? 1 : 3);
  return String((10 - (total % 10)) % 10);
}

export function validateBarcode(format: BarcodeFormat, raw: string) {
  const value = raw.replace(/\s/g, "");
  if (format === "CODE128") return value ? { value } : { error: "أدخل قيمة لـ Code 128." };
  if (format === "CODE39") return /^[0-9A-Z .\-$/+%]+$/.test(value) ? { value } : { error: "يدعم Code 39 الأحرف الكبيرة والأرقام والرموز القياسية فقط." };
  const expected = format === "EAN13" ? 12 : format === "EAN8" ? 7 : 11;
  const fullLength = expected + 1;
  if (!/^\d+$/.test(value) || (value.length !== expected && value.length !== fullLength)) return { error: `يتطلب هذا النوع ${expected} أرقامًا دون رقم تحقق أو ${fullLength} أرقامًا مع رقم تحقق صحيح.` };
  const source = value.slice(0, expected); const check = checksum(source);
  if (value.length === fullLength && value.at(-1) !== check) return { error: "رقم التحقق غير صحيح لهذا Barcode." };
  return { value: source + check };
}

export function makeBarcodeSvg(format: BarcodeFormat, raw: string, width = 2, height = 110) {
  const checked = validateBarcode(format, raw); if ("error" in checked) throw new Error(checked.error);
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  JsBarcode(svg, checked.value, { format, width, height, displayValue: true, margin: 12, lineColor: "#161326", background: "#ffffff", font: "monospace" });
  return { value: checked.value, svg: new XMLSerializer().serializeToString(svg) };
}

export async function svgToPng(svg: string, width = 900) {
  const image = new Image(); const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
  try {
    await new Promise<void>((resolve, reject) => { image.onload = () => resolve(); image.onerror = () => reject(new Error("تعذر تحويل الرسم إلى PNG.")); image.src = url; });
    const ratio = width / image.width; const canvas = document.createElement("canvas"); canvas.width = width; canvas.height = Math.ceil(image.height * ratio); const context = canvas.getContext("2d")!; context.fillStyle = "#ffffff"; context.fillRect(0, 0, canvas.width, canvas.height); context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob>((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error("تعذر إنشاء PNG.")), "image/png"));
  } finally { URL.revokeObjectURL(url); }
}

export async function makeCodePdf(dataUrl: string, title?: string) {
  const pdf = new jsPDF({ unit: "pt", format: "a4" }); const side = 451;
  if (title) { pdf.setFontSize(16); pdf.text(title, 48, 48); pdf.addImage(dataUrl, "PNG", 72, 90, side, side, undefined, "FAST"); }
  else pdf.addImage(dataUrl, "PNG", (595 - side) / 2, (842 - side) / 2, side, side, undefined, "FAST");
  return pdf.output("blob");
}
