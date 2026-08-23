# مراجع قرار PowerPoint المحلي

تم اختيار `@aiden0z/pptx-renderer` لمسار PPTX إلى PDF لأنه عارض يعمل داخل المتصفح ويعرض الشرائح كـHTML/SVG، بترخيص Apache-2.0، ويقدم API لتشغيل الشرائح محليًا. استُخدم معه `html2canvas` و`jsPDF` الموجودان أصلًا لحفظ العرض المرئي كـPDF غير قابل لتحرير عناصر PowerPoint.

المصادر:

1. https://github.com/aiden0z/pptx-renderer — يصف العارض كحل browser-native لـPPTX ويدعم API `PptxViewer.open` و`renderSlideToContainer`، مع حدود واضحة لبعض العناصر مثل EMF/WMF.
2. https://www.npmjs.com/package/pptx-browser — بديل محلي MIT لعرض PPTX في Canvas، لكنه قد يحمّل خطوط Google لتطابق بعض خطوط Office، لذلك لم يُعتمد لمسار Wasl المحلي الصرف.
3. https://github.com/jbastias/pptx2pdf — يثبت أن التحويل التقليدي يحتاج LibreOffice/ImageMagick، وهي ثنائيات خادم لا تناسب نهج Wasl المحلي داخل المتصفح.

لم تتم إضافة PDF إلى PowerPoint أو ضغط PPTX؛ لا توجد مكتبة متصفح مفتوحة المصدر تم التحقق منها ضمن هذا النطاق تضمن إخراجًا موثوقًا لتلك المسارات دون خدمة خارجية أو خادم تحويل.
