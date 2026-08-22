import { describe, expect, it } from "vitest";
import { addQrLogoToSvg, qrLogoSafety, qrPayload, validateBarcode } from "./code-engine";

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
});
