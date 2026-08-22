import { mkdir, writeFile } from 'node:fs/promises';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import * as XLSX from 'xlsx';

const output = '/home/ubuntu/wasl-qa-fixtures';
await mkdir(output, { recursive: true });

for (const [name, lines] of [
  ['qa-alpha.pdf', ['Wasl QA Alpha', 'Local PDF fixture', 'Amount: 120']],
  ['qa-beta.pdf', ['Wasl QA Beta', 'Local comparison fixture', 'Amount: 240']],
]) {
  const pdf = await PDFDocument.create(); const page = pdf.addPage([595, 842]); const font = await pdf.embedFont(StandardFonts.Helvetica);
  lines.forEach((line, index) => page.drawText(line, { x: 55, y: 760 - index * 34, size: 18, font, color: rgb(.15, .13, .28) }));
  await writeFile(`${output}/${name}`, await pdf.save());
}

const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAIAAAAmkwkpAAAAGElEQVR42mNk+M/wHwAE/gL+PfkB6i1SbYwAAAAASUVORK5CYII=', 'base64');
await writeFile(`${output}/qa-image.png`, png);
await writeFile(`${output}/qa-notes.txt`, 'Wasl QA\nاختبار محلي آمن\n');
await writeFile(`${output}/qa-data.csv`, '\uFEFFالاسم,القيمة\nوصل,120\nاختبار,240\n', 'utf8');
const workbook = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([['الاسم', 'القيمة'], ['وصل', 120], ['اختبار', 240]]), 'بيانات');
XLSX.writeFile(workbook, `${output}/qa-data.xlsx`);
console.log(output);
