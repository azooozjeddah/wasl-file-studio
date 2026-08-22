import type { Express } from "express";
import path from "node:path";

export const FFMPEG_CORE_VERSION = "0.12.10";
export const FFMPEG_CORE_ROUTE = `/__wasl__/ffmpeg/ffmpeg-core.js?v=${FFMPEG_CORE_VERSION}`;
export const FFMPEG_WASM_ROUTE = `/__wasl__/ffmpeg/ffmpeg-core.wasm?v=${FFMPEG_CORE_VERSION}`;
export const FFMPEG_UMD_CORE_ROUTE = `/__wasl__/ffmpeg/ffmpeg-core.umd.js?v=${FFMPEG_CORE_VERSION}`;
export const FFMPEG_WORKER_ROUTE = `/__wasl__/ffmpeg/worker.js?v=${FFMPEG_CORE_VERSION}`;

const ffmpegEsmDirectory = path.resolve(process.cwd(), "node_modules", "@ffmpeg", "core", "dist", "esm");
const ffmpegUmdDirectory = path.resolve(process.cwd(), "node_modules", "@ffmpeg", "core", "dist", "umd");
const corePath = path.join(ffmpegEsmDirectory, "ffmpeg-core.js");
const wasmPath = path.join(ffmpegEsmDirectory, "ffmpeg-core.wasm");
const umdCorePath = path.join(ffmpegUmdDirectory, "ffmpeg-core.js");
const workerScript = `importScripts("${FFMPEG_UMD_CORE_ROUTE}");
const wasmURL = "${FFMPEG_WASM_ROUTE}";
let core;
const reply = (id, ok, data, transfer = []) => self.postMessage(ok ? { id, ok, data } : { id, ok, error: data }, transfer);
async function loadCore() {
  if (core) return;
  core = await self.createFFmpegCore({ mainScriptUrlOrBlob: self.location.href + "#" + btoa(JSON.stringify({ wasmURL })) });
  core.setLogger((data) => self.postMessage({ type: "log", data }));
  core.setProgress((data) => self.postMessage({ type: "progress", data }));
}
self.onmessage = async ({ data }) => {
  try {
    switch (data.type) {
      case "load": await loadCore(); reply(data.id, true, true); return;
      case "writeFile": await loadCore(); core.FS.writeFile(data.data?.path, data.data?.bytes); reply(data.id, true, true); return;
      case "exec": await loadCore(); core.exec(...(data.data?.args || [])); { const result = core.ret; core.reset(); reply(data.id, true, result); } return;
      case "readFile": { await loadCore(); const bytes = core.FS.readFile(data.data?.path); reply(data.id, true, bytes, [bytes.buffer]); return; }
      case "deleteFile": await loadCore(); core.FS.unlink(data.data?.path); reply(data.id, true, true); return;
    }
  } catch (error) { reply(data.id, false, error instanceof Error ? error.message : String(error)); }
};`;

/** Same-origin package assets keep user files local while allowing a module worker to import the ESM core. */
export function registerFfmpegAssetRoutes(app: Pick<Express, "get">) {
  app.get("/__wasl__/ffmpeg/ffmpeg-core.js", (_request, response) => {
    response.type("application/javascript").set("Cache-Control", "public, max-age=3600").sendFile(corePath);
  });

  app.get("/__wasl__/ffmpeg/ffmpeg-core.wasm", (_request, response) => {
    response.type("application/wasm").set("Cache-Control", "public, max-age=3600").sendFile(wasmPath);
  });

  app.get("/__wasl__/ffmpeg/ffmpeg-core.umd.js", (_request, response) => {
    response.type("application/javascript").set("Cache-Control", "public, max-age=3600").sendFile(umdCorePath);
  });

  app.get("/__wasl__/ffmpeg/worker.js", (_request, response) => {
    response.type("application/javascript").set("Cache-Control", "public, max-age=3600").send(workerScript);
  });
}
