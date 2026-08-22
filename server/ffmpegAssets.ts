import type { Express } from "express";
import path from "node:path";

export const FFMPEG_CORE_VERSION = "0.12.10";
export const FFMPEG_CORE_ROUTE = `/__wasl__/ffmpeg/ffmpeg-core.js?v=${FFMPEG_CORE_VERSION}`;
export const FFMPEG_WASM_ROUTE = `/__wasl__/ffmpeg/ffmpeg-core.wasm?v=${FFMPEG_CORE_VERSION}`;

const ffmpegEsmDirectory = path.resolve(process.cwd(), "node_modules", "@ffmpeg", "core", "dist", "esm");
const corePath = path.join(ffmpegEsmDirectory, "ffmpeg-core.js");
const wasmPath = path.join(ffmpegEsmDirectory, "ffmpeg-core.wasm");

/** Same-origin package assets keep user files local while allowing a module worker to import the ESM core. */
export function registerFfmpegAssetRoutes(app: Pick<Express, "get">) {
  app.get("/__wasl__/ffmpeg/ffmpeg-core.js", (_request, response) => {
    response.type("application/javascript").set("Cache-Control", "public, max-age=3600").sendFile(corePath);
  });

  app.get("/__wasl__/ffmpeg/ffmpeg-core.wasm", (_request, response) => {
    response.type("application/wasm").set("Cache-Control", "public, max-age=3600").sendFile(wasmPath);
  });
}
