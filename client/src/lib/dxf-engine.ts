import type { LocalFileResult } from "./file-utils";
import { outputName } from "./file-utils";

type Point = { x: number; y: number };
type Bounds = { minX: number; minY: number; maxX: number; maxY: number };
type ParsedDxf = { entities?: unknown[]; blocks?: Record<string, unknown> | unknown[]; tables?: { layer?: { layers?: Record<string, unknown> } } };

export const DWG_TO_DXF_GUIDANCE = "للحصول على تحويل مجاني محلي، صدّر ملف DWG إلى ASCII DXF من برنامج CAD ثم ارفعه هنا.";
export const DXF_LARGE_FILE_WARNING = "هذا الملف أكبر من 20 MB. ستتم معالجته داخل جهازك، وقد يحتاج وقتًا وذاكرة أكثر خصوصًا على الهاتف.";

export type DxfPreparedDrawing = {
  svg: string;
  width: number;
  height: number;
  entityCount: number;
  layerCount: number;
  layers: string[];
  warnings: string[];
};

export type DxfPdfConversion = DxfPreparedDrawing & { result: LocalFileResult };

const svgEscape = (value: unknown) => String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char] || char);
const number = (value: unknown, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const pointOf = (value: any): Point => ({ x: number(value?.x), y: number(value?.y) });
const typeOf = (entity: any) => String(entity?.type || "UNKNOWN").toUpperCase();
const pause = () => new Promise<void>(resolve => setTimeout(resolve, 0));

function validAsciiDxf(text: string) {
  const normalized = text.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
  const lines = normalized.split("\n");
  const hasSection = lines.some((line, index) => line.trim() === "0" && lines[index + 1]?.trim() === "SECTION");
  const hasEntities = lines.some((line, index) => line.trim() === "2" && lines[index + 1]?.trim() === "ENTITIES");
  const hasEof = lines.some((line, index) => line.trim() === "0" && lines[index + 1]?.trim() === "EOF");
  return hasSection && hasEntities && hasEof;
}

export function assertAsciiDxfText(text: string, fileName = "drawing.dxf") {
  if (!validAsciiDxf(text)) throw new Error(`يدعم محول DXF ملفات ASCII DXF ثنائية الأبعاد فقط. ملف ${fileName} ليس DXF ASCII صالحًا أو يحتوي صيغة ثنائية غير مدعومة.`);
}

export async function parseAsciiDxf(file: File): Promise<ParsedDxf> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".dwg")) throw new Error(DWG_TO_DXF_GUIDANCE);
  if (!name.endsWith(".dxf")) throw new Error("يدعم هذا المحول ملفات DXF فقط. لا يتم دعم DWG في هذه الأداة.");
  const text = await file.text();
  assertAsciiDxfText(text, file.name);
  const module: any = await import("dxf-parser");
  const Parser = module.DxfParser || (typeof module.default === "function" && /^class\s/.test(Function.prototype.toString.call(module.default)) ? module.default : undefined);
  const parse = module.parse || (!Parser ? module.default : undefined);
  try {
    const drawing = typeof parse === "function" ? parse(text) : new Parser().parseSync(text);
    if (!drawing || !Array.isArray((drawing as ParsedDxf).entities)) throw new Error("لم يتعرف المحلل على كائنات DXF قابلة للرسم.");
    return drawing as ParsedDxf;
  } catch (error) {
    throw new Error(`تعذر تحليل DXF ASCII: ${error instanceof Error ? error.message : "بنية الملف غير صالحة."}`);
  }
}

function createBounds(): Bounds { return { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity }; }
function include(bounds: Bounds, point: Point) { bounds.minX = Math.min(bounds.minX, point.x); bounds.minY = Math.min(bounds.minY, point.y); bounds.maxX = Math.max(bounds.maxX, point.x); bounds.maxY = Math.max(bounds.maxY, point.y); }
function presentBounds(bounds: Bounds) { return Number.isFinite(bounds.minX) && Number.isFinite(bounds.minY) && Number.isFinite(bounds.maxX) && Number.isFinite(bounds.maxY); }
function toSvg(point: Point) { return `${point.x.toFixed(3)} ${(-point.y).toFixed(3)}`; }
function entityVertices(entity: any) { return Array.isArray(entity?.vertices) ? entity.vertices.map(pointOf) : []; }

function findBlock(drawing: ParsedDxf, name: string) {
  const blocks = drawing.blocks;
  if (Array.isArray(blocks)) return blocks.find((block: any) => block?.name === name) as any;
  if (!blocks) return undefined;
  return (blocks as Record<string, any>)[name] || Object.values(blocks).find((block: any) => block?.name === name) as any;
}

function textFrom(entity: any) { return String(entity?.text ?? entity?.string ?? "").replace(/\\P/g, " ").replace(/\\[A-Za-z][^;]*;/g, "").trim(); }

function renderEntity(
  entity: any,
  drawing: ParsedDxf,
  mapPoint: (point: Point) => Point,
  output: string[],
  bounds: Bounds,
  layers: Set<string>,
  unsupported: Map<string, number>,
  stack: string[],
) {
  const type = typeOf(entity);
  if (entity?.layer) layers.add(String(entity.layer));
  const addUnsupported = () => unsupported.set(type, (unsupported.get(type) || 0) + 1);
  const style = "fill=\"none\" stroke=\"#25185f\" stroke-width=\"1\" vector-effect=\"non-scaling-stroke\"";
  if (type === "LINE") {
    const vertices = entityVertices(entity);
    const start = mapPoint(vertices[0] || pointOf(entity.startPoint)); const end = mapPoint(vertices[1] || pointOf(entity.endPoint));
    include(bounds, start); include(bounds, end); output.push(`<line x1="${start.x}" y1="${-start.y}" x2="${end.x}" y2="${-end.y}" ${style}/>`); return;
  }
  if (type === "CIRCLE") {
    const center = mapPoint(pointOf(entity.center)); const radius = Math.abs(number(entity.radius));
    if (!radius) { addUnsupported(); return; }
    include(bounds, { x: center.x - radius, y: center.y - radius }); include(bounds, { x: center.x + radius, y: center.y + radius }); output.push(`<circle cx="${center.x}" cy="${-center.y}" r="${radius}" ${style}/>`); return;
  }
  if (type === "ARC") {
    const center = mapPoint(pointOf(entity.center)); const radius = Math.abs(number(entity.radius)); const startAngle = number(entity.startAngle) * Math.PI / 180; const endAngle = number(entity.endAngle) * Math.PI / 180;
    if (!radius) { addUnsupported(); return; }
    const start = { x: center.x + radius * Math.cos(startAngle), y: center.y + radius * Math.sin(startAngle) }; const end = { x: center.x + radius * Math.cos(endAngle), y: center.y + radius * Math.sin(endAngle) };
    include(bounds, { x: center.x - radius, y: center.y - radius }); include(bounds, { x: center.x + radius, y: center.y + radius }); let delta = (endAngle - startAngle + Math.PI * 2) % (Math.PI * 2); if (!delta) delta = Math.PI * 2;
    output.push(`<path d="M ${toSvg(start)} A ${radius} ${radius} 0 ${delta > Math.PI ? 1 : 0} 0 ${toSvg(end)}" ${style}/>`); return;
  }
  if (type === "LWPOLYLINE" || type === "POLYLINE") {
    const vertices: Point[] = entityVertices(entity).map((candidate: Point) => mapPoint(candidate)); if (vertices.length < 2) { addUnsupported(); return; }
    vertices.forEach((point: Point) => include(bounds, point)); const closed = Boolean(entity.shape || entity.closed || entity.isClosed); const path = vertices.map((point: Point, index: number) => `${index ? "L" : "M"} ${toSvg(point)}`).join(" "); output.push(`<path d="${path}${closed ? " Z" : ""}" ${style}/>`); return;
  }
  if (type === "POINT") {
    const point = mapPoint(pointOf(entity.position || entity)); include(bounds, point); output.push(`<circle cx="${point.x}" cy="${-point.y}" r="1.5" fill="#25185f"/>`); return;
  }
  if (type === "TEXT" || type === "MTEXT") {
    const value = textFrom(entity); const point = mapPoint(pointOf(entity.startPoint || entity.position || entity)); const height = Math.max(2, number(entity.textHeight ?? entity.height, 4));
    if (!value) { addUnsupported(); return; }
    include(bounds, point); include(bounds, { x: point.x + Math.max(height, value.length * height * .58), y: point.y + height }); output.push(`<text x="${point.x}" y="${-point.y}" fill="#25185f" font-size="${height}" font-family="Arial, sans-serif" transform="scale(1,-1)">${svgEscape(value)}</text>`); return;
  }
  if (type === "INSERT") {
    const name = String(entity.name || ""); const block = findBlock(drawing, name);
    if (!block || !Array.isArray(block.entities)) { addUnsupported(); return; }
    if (stack.includes(name)) { unsupported.set("INSERT دائري", (unsupported.get("INSERT دائري") || 0) + 1); return; }
    const base = pointOf(block.basePoint || block.position); const insertion = pointOf(entity.position || entity.insertPoint); const scaleX = number(entity.xScale ?? entity.scaleX, 1); const scaleY = number(entity.yScale ?? entity.scaleY, 1); const rotation = number(entity.rotation) * Math.PI / 180;
    const childMap = (point: Point) => { const x = (point.x - base.x) * scaleX; const y = (point.y - base.y) * scaleY; return mapPoint({ x: insertion.x + x * Math.cos(rotation) - y * Math.sin(rotation), y: insertion.y + x * Math.sin(rotation) + y * Math.cos(rotation) }); };
    for (const child of block.entities) renderEntity(child, drawing, childMap, output, bounds, layers, unsupported, [...stack, name]); return;
  }
  addUnsupported();
}

export function renderParsedDxf(drawing: ParsedDxf): DxfPreparedDrawing {
  const output: string[] = []; const bounds = createBounds(); const layers = new Set<string>(); const unsupported = new Map<string, number>();
  const entities = Array.isArray(drawing.entities) ? drawing.entities : [];
  for (const entity of entities) renderEntity(entity, drawing, point => point, output, bounds, layers, unsupported, []);
  if (!presentBounds(bounds) || !output.length) throw new Error("لم نجد كائنات DXF ثنائية الأبعاد مدعومة للرسم. يدعم المحول الخطوط والأقواس والدوائر وPolyline والنصوص والكتل الأساسية.");
  const padding = Math.max(10, Math.min(80, Math.max(bounds.maxX - bounds.minX, bounds.maxY - bounds.minY) * .04)); const minX = bounds.minX - padding; const maxX = bounds.maxX + padding; const minY = bounds.minY - padding; const maxY = bounds.maxY + padding; const width = Math.max(1, maxX - minX); const height = Math.max(1, maxY - minY);
  const warnings = Array.from(unsupported.entries()).map(([type, count]) => `لم يُرسم ${count} عنصر من نوع ${type} لأنه خارج نطاق DXF ثنائي الأبعاد المدعوم.`);
  return { svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${minX} ${-maxY} ${width} ${height}" role="img" aria-label="DXF preview"><rect x="${minX}" y="${-maxY}" width="${width}" height="${height}" fill="#ffffff"/>${output.join("")}</svg>`, width, height, entityCount: entities.length, layerCount: layers.size, layers: Array.from(layers).sort(), warnings };
}

export async function prepareDxfDrawing(file: File, report?: (fraction: number) => void) {
  report?.(.08); await pause(); const drawing = await parseAsciiDxf(file); report?.(.48); await pause(); const prepared = renderParsedDxf(drawing); report?.(.7); return prepared;
}

export async function convertDxfToPdf(file: File, report?: (fraction: number) => void): Promise<DxfPdfConversion> {
  const prepared = await prepareDxfDrawing(file, report); await pause();
  if (typeof DOMParser === "undefined") throw new Error("يتطلب تصدير PDF متصفحًا حديثًا يدعم عرض SVG محليًا.");
  const [{ jsPDF }, { svg2pdf }] = await Promise.all([import("jspdf"), import("svg2pdf.js")]); report?.(.8);
  const svg = new DOMParser().parseFromString(prepared.svg, "image/svg+xml").documentElement; const longest = Math.max(prepared.width, prepared.height); const ratio = Math.min(760 / longest, 1.6); const margin = 20; const pageWidth = Math.max(160, prepared.width * ratio + margin * 2); const pageHeight = Math.max(160, prepared.height * ratio + margin * 2);
  const pdf = new jsPDF({ unit: "pt", format: [pageWidth, pageHeight], compress: true }); await svg2pdf(svg, pdf, { x: margin, y: margin, width: prepared.width * ratio, height: prepared.height * ratio, loadExternalStyleSheets: false }); report?.(.98);
  const result: LocalFileResult = { name: outputName(file.name, "converted", "pdf"), blob: pdf.output("blob") as Blob, mime: "application/pdf", label: "DXF vector PDF", details: { source: "local-dxf-svg-vector-pdf", entities: prepared.entityCount, layers: prepared.layerCount } };
  report?.(1); return { ...prepared, result };
}
