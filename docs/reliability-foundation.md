# Wasl File Studio — Reliability Foundation

## Change-control rule

Before changing a shared engine, identify every affected tool in this document, run the listed unit/regression checks, build from a clean output directory, and verify the affected Production route. A Ready tool must not be promoted or modified on the strength of TypeScript alone.

## Shared-engine impact map

| Shared layer | Affected tools or area | Runtime risk | Minimum regression before approval |
|---|---|---|---|
| `pdf-engine.ts` | PDF merge, split, pages, rotate, watermark, compression, images↔PDF, metadata, rendering | `pdf-lib`, `pdfjs` worker, canvas, dynamic imports | Exercise each affected Ready route with a real PDF plus a worker/chunk console check. |
| `image-engine.ts` | Image conversion, compression, resize, crop, rotate, blur | Canvas, `createImageBitmap`, MIME/Blob output | JPEG, PNG, WebP input; output download and dimensions/MIME checks. |
| `document-engine.ts` | Text/HTML/RTF/Word/PDF document conversions | `pdfjs` worker, Mammoth, DOCX preview, canvas | Representative text, DOCX, and PDF paths; verify download and worker load. |
| `excel-engine.ts` | XLSX→CSV/PDF, CSV→XLSX, merge Excel | dynamic `xlsx`, `jsPDF`, `html2canvas` | Arabic/English sheet, CSV encoding, output download. |
| `code-engine.ts` | QR generator/reader/export and code rendering | `qrcode`, `jsQR`, `jsPDF` | QR URL and Arabic text, PNG/SVG/PDF exports, generated-PNG decode round trip. |
| `ocr-engine.ts` | OCR image/PDF | dynamic Tesseract worker, PDF engine | Arabic, English, mixed image and worker cancellation/error path. |
| `dxf-engine.ts` | DXF→PDF | dynamic parser, `jsPDF`, `svg2pdf` | ASCII DXF line/circle/text/insert/HATCH, SVG and PDF output. |
| `media-engine.ts` | Audio/video tools | FFmpeg worker/local assets | Frozen unless explicitly re-authorized; any change needs its own full media matrix. |
| `sign-pdf-engine.ts` | Visual PDF signing | PDF handling, image fetch/embed | Text, PNG, and JPEG signature export. |
| Catalog and route guard | Every public tool | Lifecycle API/cache and direct-route guards | One Ready, one Maintenance, and one Disabled direct route after any shared change. |

## Production release gate

1. Run `pnpm check`, `pnpm test`, then `pnpm build` from a clean `dist` and Vite cache.
2. Confirm the build creates `dist/public`; the deployment runtime serves this exact directory.
3. Inspect the public HTML and verify it uses the expected entry asset. HTML must be served with `no-store`; fingerprinted assets may be immutable.
4. Read `/wasl-release.json` from Production and confirm its `sourceDigest` matches a clean local build before starting browser acceptance. `revision` is supplemental because managed build environments may not expose Git metadata.
5. Verify affected public routes in a clean browser session, including console/network for chunk and dynamic-import failures.
6. Record the tool lifecycle evidence only after the route, processing, and output are accepted in Production.

## Recovery points

The canonical source history is `github/main`. Manus checkpoints provide deployable recovery points; record the production-tested checkpoint in the release tag before any shared-engine change. Never use force-push or destructive history rewriting.

`pnpm test` is local regression only. The Resend credential probe is intentionally opt-in because it calls an external service: run `RUN_EXTERNAL_INTEGRATION_TESTS=1 pnpm vitest run server/auth/resend.secret.test.ts` when validating that integration.

## QR incident note

The QR failure was not a `qrcode` or `jsQR` dependency failure. Styled rendering was changing the three finder patterns, so `jsQR` could not locate the code. Finder patterns are now protected as square, contiguous modules and covered by a regression test. The incident also exposed a deployment contract: the platform publishes `dist/public`, so build output and static serving must remain aligned with that path.
