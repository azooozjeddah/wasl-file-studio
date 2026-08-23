import pptxgen from "pptxgenjs";
import { mkdir } from "node:fs/promises";

const outputDir = "/home/ubuntu/wasl-qa-fixtures";
await mkdir(outputDir, { recursive: true });
const pptx = new pptxgen();
pptx.layout = "LAYOUT_WIDE";
pptx.author = "Wasl QA";
pptx.subject = "Non-sensitive local acceptance fixture";
pptx.title = "Wasl PowerPoint QA";
pptx.company = "Wasl";

const first = pptx.addSlide();
first.background = { color: "F7F4FF" };
first.addText("Wasl PowerPoint QA", { x: 0.6, y: 0.55, w: 8.8, h: 0.55, fontFace: "Arial", fontSize: 28, bold: true, color: "5A43B8" });
first.addText("Local rendering and visual PDF export", { x: 0.62, y: 1.3, w: 7.8, h: 0.35, fontFace: "Arial", fontSize: 15, color: "3A3650" });
first.addShape(pptx.ShapeType.roundRect, { x: 0.62, y: 2.05, w: 3.0, h: 1.3, rectRadius: 0.12, fill: { color: "7056F4" }, line: { color: "7056F4" } });
first.addText("Local only", { x: 0.8, y: 2.46, w: 2.6, h: 0.35, fontFace: "Arial", fontSize: 20, bold: true, color: "FFFFFF", align: "center" });
first.addShape(pptx.ShapeType.ellipse, { x: 4.35, y: 2.03, w: 1.3, h: 1.3, fill: { color: "A8E7D2" }, line: { color: "62B99E" } });
first.addText("2 slides", { x: 5.9, y: 2.44, w: 2.2, h: 0.35, fontFace: "Arial", fontSize: 18, bold: true, color: "255D50" });

const second = pptx.addSlide();
second.background = { color: "FFFFFF" };
second.addText("Acceptance checklist", { x: 0.6, y: 0.5, w: 7, h: 0.5, fontFace: "Arial", fontSize: 26, bold: true, color: "171326" });
second.addText([{ text: "• ", options: { color: "7056F4", bold: true } }, { text: "PPTX opens locally" }], { x: 0.75, y: 1.35, w: 6.5, h: 0.35, fontFace: "Arial", fontSize: 17, color: "28243B" });
second.addText([{ text: "• ", options: { color: "7056F4", bold: true } }, { text: "Slides render to a visual PDF" }], { x: 0.75, y: 1.95, w: 7.2, h: 0.35, fontFace: "Arial", fontSize: 17, color: "28243B" });
second.addText([{ text: "• ", options: { color: "7056F4", bold: true } }, { text: "No upload or third-party conversion" }], { x: 0.75, y: 2.55, w: 7.4, h: 0.35, fontFace: "Arial", fontSize: 17, color: "28243B" });
second.addShape(pptx.ShapeType.line, { x: 0.75, y: 3.45, w: 8.4, h: 0, line: { color: "D7D0FF", width: 2 } });
second.addText("QA fixture · non-sensitive", { x: 0.75, y: 3.72, w: 4.5, h: 0.3, fontFace: "Arial", fontSize: 12, color: "7A748E" });

await pptx.writeFile({ fileName: `${outputDir}/qa-powerpoint.pptx` });
console.log(`${outputDir}/qa-powerpoint.pptx`);
