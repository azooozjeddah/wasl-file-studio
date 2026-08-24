import { describe, expect, it } from "vitest";
import { addQrLogoToSvg, makeStyledQrSvg, qrLogoSafety, qrPayload, validateBarcode } from "./code-engine";

describe("local code payloads", () => {
  it("builds safe QR payloads for common daily actions", () => {
    expect(qrPayload("url", { value: "wasl.example" })).toBe("https://wasl.example");
    expect(qrPayload("wifi", { ssid: "Wasl WiFi", password: "secret", security: "WPA" })).toBe("WIFI:T:WPA;S:Wasl WiFi;P:secret;;");
    expect(qrPayload("whatsapp", { phone: "+966 50 123 4567", message: "مرحبًا" })).toContain("https://wa.me/966501234567?text=");
    expect(qrPayload("vcard", { name: "وصل", phone: "0500000000", email: "info@example.com", organization: "Wasl" })).toContain("BEGIN:VCARD");
  });

  it("validates and supplies check digits for numeric barcode formats", () => {
    expect(validateBarcode("EAN13", "629123456789")).toEqual({ value: "6291234567894" });
    expect(validateBarcode("EAN8", "9638507")).toEqual({ value: "96385074" });
    expect(validateBarcode("UPC", "03600029145")).toEqual({ value: "036000291452" });
    expect(validateBarcode("EAN13", "6291234567890")).toHaveProperty("error");
    expect(validateBarcode("CODE39", "INVALID@CHAR")).toHaveProperty("error");
  });

  it("constrains center-logo QR designs and injects only a logo layer", () => {
    expect(qrLogoSafety(true, 16, "H")).toMatchObject({ safe: true, level: "safe" });
    expect(qrLogoSafety(true, 24, "H")).toMatchObject({ safe: false, level: "size" });
    expect(qrLogoSafety(true, 16, "M")).toMatchObject({ safe: false, level: "correction" });
    const result = addQrLogoToSvg('<svg viewBox="0 0 100 100"><path d="M0 0"/></svg>', "data:image/png;base64,AA", 16);
    expect(result).toContain('id="qr-logo-layer"');
    expect(result).toContain('href="data:image/png;base64,AA"');
    expect(result).not.toContain("Wasl QR code");
  });

  it("renders styled local QR cells with a frame and label without third-party assets", async () => {
    const svg = await makeStyledQrSvg("https://wasl.example/qa", { size: 420, dark: "#161326", light: "#ffffff", correction: "H", dots: "extra-rounded", frame: "ticket", label: "Scan safely", labelPosition: "bottom" });
    expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"');
    expect(svg).toContain("Scan safely");
    expect(svg).toContain("stroke-dasharray");
    expect(svg).toContain("rx=");
    expect(svg).not.toContain("Wasl QR code");
  });

  it("keeps finder modules square even when decorative eye and dot styles are selected", async () => {
    const svg = await makeStyledQrSvg("https://waslfile.manus.space", { size: 360, dark: "#171326", light: "#ffffff", correction: "M", dots: "rounded", eyeStyle: "rounded", frame: "soft", margin: 4, labelPosition: "bottom" });
    expect(svg).toContain('<rect x="40" y="40" width="10.03" height="10.03" fill="#171326"/>');
    expect(svg).not.toContain('<rect x="40" y="40" width="10.03" height="10.03" rx="2.8000000000000003"');
  });

  it("renders a local QR template with gradient, eye style, larger quiet zone, and a scan frame", async () => {
    const svg = await makeStyledQrSvg("https://wasl.example/template", { size: 480, dark: "#171326", light: "#ffffff", correction: "H", dots: "rounded", eyeStyle: "rounded", margin: 7, gradientFrom: "#321b84", gradientTo: "#171326", frame: "scan", label: "امسح للوصول", labelPosition: "top" });
    expect(svg).toContain('id="qr-gradient"');
    expect(svg).toContain("url(#qr-gradient)");
    expect(svg).toContain("امسح للوصول");
    expect(svg).toContain("stroke-linecap");
  });

  it("renders expanded professional styles without external assets", async () => {
    const svg = await makeStyledQrSvg("https://wasl.example/pro", { size: 480, dark: "#7c3aed", light: "#fffbed", correction: "H", dots: "diamond", eyeStyle: "leaf", margin: 7, gradientFrom: "#7c3aed", gradientTo: "#ea580c", frame: "ribbon", label: "امسح للمزيد", labelPosition: "bottom" });
    expect(svg).toContain("L");
    expect(svg).toContain("امسح للمزيد");
    expect(svg).toContain("url(#qr-gradient)");
    expect(svg).not.toContain("Wasl QR code");
  });
});
