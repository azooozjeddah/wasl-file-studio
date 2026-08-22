declare module "@ffmpeg/core" {
  const createFFmpegCore: (options: Record<string, unknown>) => Promise<any>;
  export default createFFmpegCore;
}
