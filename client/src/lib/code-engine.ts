import JsBarcode from "jsbarcode";
import QRCode, { type QRCodeErrorCorrectionLevel } from "qrcode";
import { jsPDF } from "jspdf";

export type QrKind = "url" | "text" | "phone" | "email" | "wifi" | "sms" | "whatsapp" | "vcard";
export type BarcodeFormat = "CODE128" | "CODE39" | "EAN13" | "EAN8" | "UPC";
export type QrDotStyle = "square" | "dots" | "rounded" | "classy" | "classy-rounded" | "extra-rounded" | "diamond" | "vertical" | "horizontal";
export type QrFrameStyle = "none" | "outline" | "soft" | "ticket" | "badge" | "pill" | "double" | "scan" | "card" | "seal" | "brackets" | "ribbon" | "poster" | "caption";
export type QrEyeStyle = "square" | "rounded" | "dots" | "ring" | "leaf";
export type QrLabelPosition = "top" | "bottom";

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

function svgEscapedText(value: string) { return value.replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" }[character] || character)); }

function finderCell(row: number, col: number, count: number) { return (row < 7 && col < 7) || (row < 7 && col >= count - 7) || (row >= count - 7 && col < 7); }

/** Builds QR cells directly from the trusted QR matrix so styles remain local and SVG/PNG exports stay decoder-friendly. */
export async function makeStyledQrSvg(payload: string, options: {
  size: number; dark: string; light: string; correction: QRCodeErrorCorrectionLevel;
  dots: QrDotStyle; frame: QrFrameStyle; label?: string; labelPosition: QrLabelPosition; logo?: string; logoSize?: number;
  eyeStyle?: QrEyeStyle; margin?: number; gradientFrom?: string; gradientTo?: string;
}) {
  if (!payload.trim()) throw new Error("أدخل محتوى لإنشاء رمز QR.");
  const matrix = QRCode.create(payload, { errorCorrectionLevel: options.correction }); const count = matrix.modules.size; const quiet = Math.min(12, Math.max(2, Math.round(options.margin ?? 4))); const unit = Math.max(4, Math.round(options.size / (count + quiet * 2))); const qrSize = unit * (count + quiet * 2);
  const radius = options.dots === "extra-rounded" ? unit * .46 : options.dots === "rounded" || options.dots === "classy-rounded" ? unit * .32 : options.dots === "classy" ? unit * .18 : 0;
  const hasGradient = Boolean(options.gradientFrom && options.gradientTo && options.gradientFrom !== options.gradientTo);
  const fill = hasGradient ? "url(#qr-gradient)" : options.dark;
  const definitions = hasGradient ? `<defs><linearGradient id="qr-gradient" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="${options.gradientFrom}"/><stop offset="100%" stop-color="${options.gradientTo}"/></linearGradient></defs>` : "";
  let cells = `${definitions}<rect width="${qrSize}" height="${qrSize}" fill="${options.light}"/>`;
  for (let row = 0; row < count; row++) for (let col = 0; col < count; col++) if (matrix.modules.data[row * count + col]) {
    const x = (col + quiet) * unit; const y = (row + quiet) * unit; const finder = finderCell(row, col, count);
    // QR decoders depend on finder patterns being contiguous, square modules. Applying
    // the decorative dot/eye styles to every finder cell creates white seams and makes
    // otherwise valid exports unreadable. Keep the three detection patterns canonical;
    // apply visual styling only to regular data modules.
    const dot = options.dots === "dots" && !finder;
    const cellRadius = finder ? 0 : radius;
    if (dot) cells += `<circle cx="${x + unit / 2}" cy="${y + unit / 2}" r="${unit * .43}" fill="${fill}"/>`;
    else if (!finder && options.dots === "diamond") cells += `<path d="M${x + unit / 2} ${y + unit * .06}L${x + unit * .94} ${y + unit / 2}L${x + unit / 2} ${y + unit * .94}L${x + unit * .06} ${y + unit / 2}Z" fill="${fill}"/>`;
    else if (!finder && options.dots === "vertical") cells += `<rect x="${x + unit * .17}" y="${y}" width="${unit * .66}" height="${unit + .03}" rx="${unit * .18}" fill="${fill}"/>`;
    else if (!finder && options.dots === "horizontal") cells += `<rect x="${x}" y="${y + unit * .17}" width="${unit + .03}" height="${unit * .66}" rx="${unit * .18}" fill="${fill}"/>`;
    else cells += `<rect x="${x}" y="${y}" width="${unit + .03}" height="${unit + .03}"${cellRadius ? ` rx="${cellRadius}" ry="${cellRadius}"` : ""} fill="${fill}"/>`;
  }
  const source = addQrLogoToSvg(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${qrSize} ${qrSize}" width="${qrSize}" height="${qrSize}">${cells}</svg>`, options.logo, options.logoSize);
  const sourceViewBox = source.match(/viewBox="([^"]+)"/i)?.[1]?.trim().split(/\s+/).map(Number);
  const [, , sourceWidth, sourceHeight] = sourceViewBox && sourceViewBox.length === 4 ? sourceViewBox : [0, 0, options.size, options.size];
  const label = options.label?.trim().slice(0, 60) || "";
  const padding = options.frame === "none" ? 0 : Math.max(22, Math.round(options.size * .07));
  const labelHeight = label ? Math.max(30, Math.round(options.size * .12)) : 0;
  const totalWidth = sourceWidth + padding * 2;
  const totalHeight = sourceHeight + padding * 2 + labelHeight;
  const contentY = padding + (label && options.labelPosition === "top" ? labelHeight : 0);
  const inner = source.replace(/^<svg[^>]*>/i, "").replace(/<\/svg>\s*$/i, "");
  const frameStroke = fill;
  const border = options.frame === "none" ? "" : options.frame === "ticket"
    ? `<path d="M8 ${padding}H${totalWidth - 8}V${totalHeight - padding}H8Z" fill="${options.light}" stroke="${frameStroke}" stroke-width="3" stroke-dasharray="8 5"/>`
    : options.frame === "double"
      ? `<rect x="4" y="4" width="${totalWidth - 8}" height="${totalHeight - 8}" rx="16" fill="${options.light}" stroke="${frameStroke}" stroke-width="3"/><rect x="13" y="13" width="${totalWidth - 26}" height="${totalHeight - 26}" rx="10" fill="none" stroke="${frameStroke}" stroke-width="1.5"/>`
      : options.frame === "scan"
        ? `<rect x="4" y="4" width="${totalWidth - 8}" height="${totalHeight - 8}" rx="14" fill="${options.light}" stroke="${frameStroke}" stroke-width="3"/><path d="M16 34V16H34 M${totalWidth - 34} 16H${totalWidth - 16}V34 M${totalWidth - 16} ${totalHeight - 34}V${totalHeight - 16}H${totalWidth - 34} M34 ${totalHeight - 16}H16V${totalHeight - 34}" fill="none" stroke="${frameStroke}" stroke-width="3" stroke-linecap="round"/>`
        : options.frame === "brackets"
          ? `<rect x="5" y="5" width="${totalWidth - 10}" height="${totalHeight - 10}" rx="10" fill="${options.light}" stroke="${frameStroke}" stroke-width="1.5"/><path d="M14 36V14H36 M${totalWidth - 36} 14H${totalWidth - 14}V36 M${totalWidth - 14} ${totalHeight - 36}V${totalHeight - 14}H${totalWidth - 36} M36 ${totalHeight - 14}H14V${totalHeight - 36}" fill="none" stroke="${frameStroke}" stroke-width="4" stroke-linecap="round"/>`
          : options.frame === "seal"
            ? `<rect x="5" y="5" width="${totalWidth - 10}" height="${totalHeight - 10}" rx="${Math.round(padding * .7)}" fill="${options.light}" stroke="${frameStroke}" stroke-width="3" stroke-dasharray="2 5"/><rect x="13" y="13" width="${totalWidth - 26}" height="${totalHeight - 26}" rx="${Math.round(padding * .45)}" fill="none" stroke="${frameStroke}" stroke-width="1.2"/>`
            : options.frame === "ribbon"
              ? `<rect x="4" y="4" width="${totalWidth - 8}" height="${totalHeight - 8}" rx="15" fill="${options.light}" stroke="${frameStroke}" stroke-width="2.5"/><path d="M${totalWidth / 2 - 58} 4H${totalWidth / 2 + 58}V${Math.max(24, padding * .72)}H${totalWidth / 2 + 42}L${totalWidth / 2} ${Math.max(34, padding)}L${totalWidth / 2 - 42} ${Math.max(24, padding * .72)}H${totalWidth / 2 - 58}Z" fill="${frameStroke}"/>`
              : options.frame === "poster"
                ? `<rect x="4" y="4" width="${totalWidth - 8}" height="${totalHeight - 8}" rx="18" fill="${options.light}" stroke="${frameStroke}" stroke-width="3"/><path d="M16 ${totalHeight - 17}H${totalWidth - 16}" stroke="${frameStroke}" stroke-width="3" stroke-linecap="round"/>`
                : options.frame === "caption"
                  ? `<rect x="4" y="4" width="${totalWidth - 8}" height="${totalHeight - 8}" rx="12" fill="${options.light}" stroke="${frameStroke}" stroke-width="2"/><rect x="4" y="${totalHeight - Math.max(28, padding * .9)}" width="${totalWidth - 8}" height="${Math.max(24, padding * .9) - 4}" rx="0" fill="${frameStroke}"/>`
        : `<rect x="4" y="4" width="${totalWidth - 8}" height="${totalHeight - 8}" rx="${options.frame === "pill" ? Math.round(totalHeight / 2) : options.frame === "badge" ? Math.round(padding * .55) : options.frame === "soft" ? Math.round(padding * 1.1) : 10}" fill="${options.frame === "badge" ? frameStroke : options.light}" stroke="${frameStroke}" stroke-width="${options.frame === "soft" ? 0 : 3}"/>`;
  const labelY = options.labelPosition === "top" ? padding + labelHeight * .68 : contentY + sourceHeight + labelHeight * .68;
  const labelLayer = label ? `<text x="${totalWidth / 2}" y="${labelY}" text-anchor="middle" font-family="Arial, sans-serif" font-size="${Math.max(13, Math.round(options.size * .055))}" font-weight="700" fill="${options.frame === "badge" ? options.light : options.dark}">${svgEscapedText(label)}</text>` : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalWidth} ${totalHeight}" width="${totalWidth}" height="${totalHeight}">${border}${labelLayer}<g transform="translate(${padding} ${contentY})">${inner}</g></svg>`;
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

export async function svgToPng(svg: string, width = 900, intrinsicScale = 1) {
  const normalized = svg.replace(/^\s*<\?xml[^>]*>\s*/i, "").replace(/^\s*<svg(?![^>]*\sxmlns=)/i, '<svg xmlns="http://www.w3.org/2000/svg"');
  const image = new Image(); const dataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(normalized)}`;
  await new Promise<void>((resolve, reject) => { image.onload = () => resolve(); image.onerror = () => reject(new Error("تعذر تحويل الرسم إلى PNG.")); image.src = dataUrl; });
  const intrinsicWidth = image.naturalWidth || image.width; const intrinsicHeight = image.naturalHeight || image.height;
  if (!intrinsicWidth || !intrinsicHeight) throw new Error("تعذر تحديد أبعاد الرسم.");
  const targetWidth = width > 0 ? width : Math.round(intrinsicWidth * intrinsicScale); const ratio = targetWidth / intrinsicWidth; const canvas = document.createElement("canvas"); canvas.width = targetWidth; canvas.height = Math.ceil(intrinsicHeight * ratio); const context = canvas.getContext("2d")!; context.imageSmoothingEnabled = false; context.fillStyle = "#ffffff"; context.fillRect(0, 0, canvas.width, canvas.height); context.drawImage(image, 0, 0, canvas.width, canvas.height);
  return await new Promise<Blob>((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error("تعذر إنشاء PNG.")), "image/png"));
}

export async function makeCodePdf(dataUrl: string, title?: string) {
  const pdf = new jsPDF({ unit: "pt", format: "a4" }); const side = 451;
  if (title) { pdf.setFontSize(16); pdf.text(title, 48, 48); pdf.addImage(dataUrl, "PNG", 72, 90, side, side, undefined, "FAST"); }
  else pdf.addImage(dataUrl, "PNG", (595 - side) / 2, (842 - side) / 2, side, side, undefined, "FAST");
  return pdf.output("blob");
}
