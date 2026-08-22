import createFFmpegCore from "@ffmpeg/core";
import wasmURL from "@ffmpeg/core/wasm?url";

type Request = {
  id: number;
  type: "load" | "writeFile" | "exec" | "readFile" | "deleteFile";
  data?: { path?: string; bytes?: Uint8Array; args?: string[] };
};

const workerScope = globalThis as unknown as {
  postMessage: (message: unknown, transfer?: Transferable[]) => void;
  location: Location;
  onmessage: (event: MessageEvent<Request>) => void;
};
let core: any;

function postResult(id: number, data?: unknown, transfer: Transferable[] = []) {
  workerScope.postMessage({ id, ok: true, data }, transfer);
}

function postFailure(id: number, error: unknown) {
  workerScope.postMessage({ id, ok: false, error: error instanceof Error ? error.message : String(error) });
}

async function loadCore() {
  if (core) return;
  core = await createFFmpegCore({
    mainScriptUrlOrBlob: `${workerScope.location.href}#${btoa(JSON.stringify({ wasmURL }))}`,
  });
  core.setLogger((data: unknown) => workerScope.postMessage({ type: "log", data }));
  core.setProgress((data: { progress?: number }) => workerScope.postMessage({ type: "progress", data }));
}

workerScope.onmessage = async ({ data }: MessageEvent<Request>) => {
  try {
    switch (data.type) {
      case "load":
        await loadCore();
        postResult(data.id, true);
        return;
      case "writeFile":
        await loadCore();
        core.FS.writeFile(data.data?.path, data.data?.bytes);
        postResult(data.id, true);
        return;
      case "exec": {
        await loadCore();
        core.exec(...(data.data?.args ?? []));
        const result = core.ret;
        core.reset();
        postResult(data.id, result);
        return;
      }
      case "readFile": {
        await loadCore();
        const bytes = core.FS.readFile(data.data?.path);
        postResult(data.id, bytes, [bytes.buffer]);
        return;
      }
      case "deleteFile":
        await loadCore();
        core.FS.unlink(data.data?.path);
        postResult(data.id, true);
        return;
    }
  } catch (error) {
    postFailure(data.id, error);
  }
};
