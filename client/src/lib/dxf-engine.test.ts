import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { assertAsciiDxfText, dxfEntityTypeHints, dxfPdfLayout, parseAsciiDxf, renderParsedDxf } from "./dxf-engine";

describe("DXF local rendering", () => {
  it("renders basic geometry, text, layers, blocks, and warns about unsupported hatch entities", () => {
    const rendered = renderParsedDxf({
      entities: [
        { type: "LINE", layer: "Walls", vertices: [{ x: 0, y: 0 }, { x: 120, y: 0 }] },
        { type: "CIRCLE", layer: "Doors", center: { x: 40, y: 30 }, radius: 12 },
        { type: "ARC", layer: "Doors", center: { x: 80, y: 30 }, radius: 12, startAngle: 0, endAngle: 180 },
        { type: "LWPOLYLINE", layer: "Walls", vertices: [{ x: 0, y: 0 }, { x: 0, y: 80 }, { x: 120, y: 80 }], shape: false },
        { type: "TEXT", layer: "Notes", startPoint: { x: 12, y: 12 }, textHeight: 6, text: "Lobby" },
        { type: "INSERT", layer: "Fixtures", name: "TAG", position: { x: 95, y: 56 } },
        { type: "HATCH", layer: "Fill" },
      ],
      blocks: { TAG: { basePoint: { x: 0, y: 0 }, entities: [{ type: "LINE", vertices: [{ x: -4, y: 0 }, { x: 4, y: 0 }] }, { type: "LINE", vertices: [{ x: 0, y: -4 }, { x: 0, y: 4 }] }] } },
    });
    expect(rendered.svg).toContain("<line");
    expect(rendered.svg).toContain("<circle");
    expect(rendered.svg).toContain("Lobby");
    expect(rendered.layerCount).toBeGreaterThanOrEqual(4);
    expect(rendered.warnings.join(" ")).toContain("HATCH");
  });

  it("accepts ASCII DXF section framing and rejects binary or malformed content", () => {
    expect(() => assertAsciiDxfText("0\nSECTION\n2\nENTITIES\n0\nENDSEC\n0\nEOF\n")).not.toThrow();
    expect(() => assertAsciiDxfText("AC1032 binary dwg", "plan.dxf")).toThrow(/ASCII DXF/);
  });

  it("parses a real ASCII DXF floor-plan fixture with layers, an insert, and text", async () => {
    const source = await readFile(resolve(process.cwd(), "test-fixtures/cad/wasl-floorplan.dxf"));
    const drawing = await parseAsciiDxf(new File([source], "wasl-floorplan.dxf", { type: "application/dxf" }));
    const rendered = renderParsedDxf(drawing);
    expect(rendered.entityCount).toBeGreaterThanOrEqual(6);
    expect(rendered.layers).toEqual(expect.arrayContaining(["Walls", "Doors", "Notes", "Fixtures"]));
    expect(rendered.svg).toContain("WASL ROOM");
    expect(rendered.svg).not.toContain("transform=\"scale(1,-1)\"");
  });

  it("uses an oriented PDF page that fills small wide drawings instead of shrinking them into a square", () => {
    const layout = dxfPdfLayout(43.49, 23.65);
    expect(layout.pageWidth).toBeGreaterThan(layout.pageHeight);
    expect(layout.contentWidth / layout.pageWidth).toBeGreaterThan(.85);
    expect(layout.orientation).toBe("landscape");
  });

  it("detects unsupported HATCH records from ASCII source even when a parser omits them", () => {
    const source = "0\nSECTION\n2\nENTITIES\n0\nLINE\n0\nHATCH\n0\nENDSEC\n0\nEOF\n";
    expect(dxfEntityTypeHints(source)).toEqual(["LINE", "HATCH"]);
  });
});
