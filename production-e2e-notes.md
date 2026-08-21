# Production E2E Notes

## Target

- Production URL: `https://waslfile-b7bks7br.manus.space/`
- Production title at test start: `وَصل للملفات | أدوات ملفات تعمل على جهازك`
- Test browser: Chromium sandbox browser. A separate Playwright Firefox session was used earlier for local/development verification; Safari and physical Android are unavailable in this environment.

## Published catalog observed from the production homepage

| Family | Published count | Representative routes |
|---|---:|---|
| PDF | 19 | `/merge-pdf`, `/split-pdf`, `/pdf-to-jpg`, `/protect-pdf` |
| Images | 5 | `/convert-image`, `/compress-image`, `/resize-image`, `/rotate-image` |
| Documents | 6 | `/word-to-pdf`, `/pdf-to-word`, `/txt-to-pdf` |
| OCR | 1 | `/ocr` |
| Audio | 4 | `/convert-audio`, `/trim-audio`, `/merge-audio` |
| Video | 7 | `/video-to-mp3`, `/mp4-to-webm`, `/compress-video`, `/extract-frame` |

## Public-production observations

- Arabic RTL homepage loaded successfully and listed every expected tool category and route.
- The production homepage includes language toggle, dark-mode toggle, public admin link, CTA links, privacy/FAQ anchors, canonical public pages, and direct tool links.
- Local tool copy promises client-side processing; network behavior will be verified per selected tool using browser request inspection during this test run.
- Language toggle changed the complete primary navigation, CTA, tool catalog, privacy copy, and FAQ from Arabic RTL to English with no console output.
- Dark-mode toggle changed the published homepage to a readable dark palette while preserving visible navigation, CTAs, file-intake control, and catalog tabs.

## Merge PDF production test

- `/merge-pdf` loaded with the expected local-processing label, multiple-PDF intake, actionable process control, safety copy, and no JavaScript console output before processing.
- The page implements its native file input as a hidden control inside the custom intake button. Browser automation cannot target that hidden native field directly, so the field was temporarily made visible only in the test DOM to exercise the exact same upload handler; no source or deployed code was changed.
- Fixtures were copied to `/home/ubuntu/wasl-e2e-fixtures/` because browser uploads are restricted to paths below `/home/ubuntu/`. This is a harness restriction, not a production application failure.
- A separate Playwright production session loaded both `/` and `/merge-pdf` with the expected Arabic page titles, confirming that the public deployment is independently reachable beyond the initial browser session.
- In the separate session, activating the visible production button `اسحب الملف هنا أو اختره من جهازك` opened the native browser file chooser exactly as expected. The first automated upload was rejected solely because that browser harness permits fixture paths only below `/opt/.manus/current`; the existing source fixture path will be used for the retry.
- Retrying with `/opt/.manus/current/wasl-test-fixtures/sample-a.pdf` and `sample-b.pdf` succeeded through the natural chooser. The UI reported two selected files totaling 4.4 KB, exposed per-file queue controls and enabled `ابدأ المعالجة` without any source or DOM modification.
- Processing those files on production completed successfully and presented `sample-a-merged.pdf` (1.8 KB) as a downloadable result. The output preview in the browser showed two page thumbnails; the independent Chromium execution also rendered the first page content and both thumbnails.
- Production network inspection recorded only catalog retrieval plus anonymous telemetry during local merge. The examined telemetry bodies were `tool_open` with tool/locale/platform/browser fields and `process_start` with only `toolSlug` and a size bucket (`<1MB`); neither included a filename, file bytes, MIME payload, or uploaded file URL.

## Homepage, responsive, and SEO test

- A fresh automated session reached the published homepage with title `وَصل للملفات | أدوات ملفات تعمل على جهازك` and Arabic content. The initial metadata probe used an invalid browser-selector literal while reading Open Graph tags; this is an automation query error, not a browser-console error emitted by the production application. The corrected metadata check follows.
- The corrected production metadata probe found `lang="ar"`, `dir="rtl"`, a non-empty Arabic description, matching Open Graph title/description, and one JSON-LD block. It also found a real SEO defect: the production homepage canonical resolved to `https://wasl-file-studio.manus.space/`, not the active published domain.
- The hard-coded historical canonical in `client/index.html` was replaced with the root-relative value `/`, and a Vitest regression test now ensures the template cannot contain that historical domain. The focused test passed. The current preview resolves that link to its own active origin; this correction will require the next user-initiated Publish action before it can be re-verified on production.
- Production homepage testing has been restarted at a 390 × 844 viewport to simulate an iPhone-class layout. This verifies responsive web behavior in Firefox automation; it is not a claim of execution on physical iPhone, Android hardware, or Safari.
- The original production mobile snapshot exposed a reproducible accessibility issue: the OCR, audio, and video category tabs had negative horizontal positions and therefore were clipped outside the 390 px viewport. The mobile CSS was changed to wrap category tabs into a two-column grid. At the same 390 × 844 preview size, all six links now occupy three visible rows with x coordinates between 12 and 378 px. This must still be re-tested after the next Publish action.

## Image batch production test

- The test viewport was restored to 1366 × 900 and the published `/convert-image` route loaded with the expected Arabic title `تحويل الصور | وَصل للملفات`.
- The production image converter exposed JPG, PNG, and WebP support, output-format and quality controls, and a disabled process control until a file is selected. Activating the visible file-intake button opened the browser-native file chooser successfully.
- The converter accepted three PNG inputs (39.2 KB total), enabled processing, and completed the batch. The result controls exposed three individual `تنزيل` buttons plus `تنزيل الكل ZIP`, alongside `بدء عملية جديدة`; this proves the published UI recognizes a multi-result package.
- The three generated WebP outputs had distinct, expected names and reduced sizes: `sample-a-convert-image.webp` (532 B), `sample-b-convert-image.webp` (9.1 KB), and `ocr-english-convert-image.webp` (9.1 KB). Clicking the production ZIP button downloaded `wasl-results.zip`; archive inspection confirmed it contains exactly those three files with the reported byte lengths.

## PDF split production test

- A three-page fixture (`e2e-multipage.pdf`, 4.5 KB) was prepared from the supplied PDF samples. The published `/split-pdf` route opened with a native single-file picker and a range textbox accepting values such as `1-3,5`.
- The three-page PDF was accepted through the natural production file chooser (shown as one selected 4.4 KB file), and enabled the split action while leaving the page-range setting editable.
- Entering page range `2` produced `e2e-multipage-page-2.pdf` (937 B). The file was downloaded through the production UI and `pdfinfo` confirmed a valid PDF 1.7 with exactly one A4 page, establishing that the selected middle page was extracted rather than merely a placeholder file.

## OCR production test

- The published OCR tool advertises local Arabic/English recognition for JPG, PNG, and PDF inputs, with TXT and DOCX outputs. It exposes a language selector with clear first-use language-download notice and labels its current mode as local, with server-ready handling documented separately.
- The Arabic fixture was accepted through the native production picker and OCR was explicitly set to `ara`. The completed result state appeared after local processing and exposed a ZIP download plus an output group for the extracted artifacts; detailed text-preview and file-output verification follows.
- Production OCR then exposed a reproducible defect: the supplied, visually clear Arabic fixture completed with the preview `لم يتعرف OCR على نص قابل للاستخراج من هذه العينة.` and a zero-byte TXT. No production application console error accompanied the failure. The engine now uses automatic page segmentation first and retries blank passes with `SINGLE_LINE`; the new regression test and all OCR unit tests passed. A live preview retest is in progress before this change can be published and re-verified on production.
- The actual preview retest succeeded: the previous blank Arabic fixture now produced non-empty text beginning `وصل ملفات عربي`. Its final digits were imperfect (`٠١1771` rather than the source’s `٢٠٢٦`), which is a truthful OCR quality limitation; the decisive zero-byte/empty-output defect was resolved in the preview. The Tesseract `Estimating resolution` console entry is emitted by the underlying OCR WebAssembly engine and not by Wasl application code.
- A separate production OCR session has been opened for the English fixture. The same local-only language selector and native multi-file intake are present; English result verification is next.
- The English fixture was uploaded through the native production picker, OCR was set to `eng`, and the local output preview exactly returned `WASL OCR ENGLISH 2026`. This confirms the current production engine recognizes the supplied English sample correctly.

## Document conversion production test

- The published Word-to-PDF page loaded with its disclosed best-effort local rendering limitation, a native DOCX-only picker, and the expected local/server-ready processing label.
- The production Word-to-PDF conversion accepted `sample-word.docx` (8.5 KB), produced `sample-word-rendered.pdf` (72.4 KB), and downloaded it successfully. Independent PDF inspection confirmed one valid A4 PDF page. Text extraction is intentionally empty because this best-effort local path rasterizes the rendered document; visual inspection confirmed the output page contains the English heading, Arabic heading, and supporting paragraph from the DOCX fixture.
- The published PDF-to-Word page loaded with its explicit text-extraction limitation for scanned PDFs, a native single-PDF picker, and local/server-ready processing disclosure. A text-based fixture will now be used to validate the editable DOCX output.
- The native picker accepted `text-based.pdf` (3.2 KB) and enabled the production conversion action. The selected input is a text-based PDF, so successful conversion should yield a non-empty editable document rather than invoke the scanned-PDF rejection path.
- Converting `text-based.pdf` produced `text-based-editable.docx` (8.3 KB) and a companion output package. The DOCX downloaded successfully; its WordprocessingML text nodes contain `WASL TEXT PDF 2026 Editable text extraction verification.`, confirming a non-empty editable text result rather than a static placeholder.

## Media production test

- The production audio converter opened with the expected local/server-ready disclosure, native batch intake, supported MP3/WAV/M4A/AAC/OGG formats, and a bitrate control that remains disabled until media is selected.
- Production WAV conversion accepted the 15.7 KB fixture and began at 3%, while the core JS and WASM downloads returned HTTP 200. The progress did not advance after repeated checks; cancellation returned the workspace to a usable retry state. The occurrence is reproducible and is tracked as a media-engine defect.
- The first diagnosis found that the core was requested from the ESM bundle. Switching to UMD exposed a `NetworkError` when an explicit `ffmpeg-core.worker.js` URL was added; the official package manifest confirms neither UMD nor ESM publishes that file. The unsupported explicit worker URL was removed and the standard UMD configuration retained. The loader-configuration regression test passes, but the actual preview WAV conversion still shows the generic failure state; no fabricated media success has been recorded.
- Further diagnosis proved that `crossOriginIsolated` was false and `SharedArrayBuffer` was unavailable. The server now sends COOP `same-origin` and COEP `require-corp`; a fresh preview has `crossOriginIsolated: true` and `SharedArrayBuffer: function`. The third-party analytics script was removed because it was blocked by the required COEP policy; anonymous same-origin telemetry remains active.
- FFmpeg load diagnostics then identified an incompatible Core request. The installed `@ffmpeg/ffmpeg` 0.12.15 worker expects Core 0.12.9; the loader now uses the matching UMD Core directly, rather than Core 0.12.10 or an invalid worker URL. The targeted configuration and isolation tests pass. A live preview converted `sample.wav` (15.7 KB) to `sample-converted.mp3` (10.2 KB), and the downloaded file independently identifies as MPEG Layer III, 128 kbps, 8 kHz mono. Production remains on the prior release until the next successful publish.
