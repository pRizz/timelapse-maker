import type { ProcessingProgress } from "./types";

export function assertNotAborted(signal: AbortSignal): void {
  if (signal.aborted) {
    throw new DOMException("Processing was canceled.", "AbortError");
  }
}

export function createOutputFileName(
  sourceName: string,
  extension: "mp4" | "webm",
  mode: "preview" | "export",
): string {
  const cleanBaseName = sourceName.replace(/\.[^.]+$/, "").replace(/[^a-z0-9-_]+/gi, "-");
  const suffix = mode === "preview" ? "preview" : "timelapse";
  return `${cleanBaseName || "video"}-${suffix}.${extension}`;
}

export function emitProgress(
  onProgress: (progress: ProcessingProgress) => void,
  progress: ProcessingProgress,
): void {
  onProgress(progress);
}

export function getCanvas2dContext(
  canvas: HTMLCanvasElement,
): CanvasRenderingContext2D {
  const maybeContext = canvas.getContext("2d", { alpha: false });

  if (!maybeContext) {
    throw new Error("This browser could not create a 2D canvas context.");
  }

  return maybeContext;
}

export function clearCanvas(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
): void {
  context.fillStyle = "#000000";
  context.fillRect(0, 0, width, height);
}

export function drawVideoContain(
  context: CanvasRenderingContext2D,
  video: HTMLVideoElement,
  width: number,
  height: number,
): void {
  clearCanvas(context, width, height);

  const sourceRatio = video.videoWidth / video.videoHeight;
  const targetRatio = width / height;
  const drawWidth = sourceRatio > targetRatio ? width : height * sourceRatio;
  const drawHeight = sourceRatio > targetRatio ? width / sourceRatio : height;
  const drawX = (width - drawWidth) / 2;
  const drawY = (height - drawHeight) / 2;

  context.drawImage(video, drawX, drawY, drawWidth, drawHeight);
}

export function waitForMilliseconds(milliseconds: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    let timeoutId: number | null = null;
    const cleanup = () => {
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }
      signal.removeEventListener("abort", onAbort);
    };
    timeoutId = window.setTimeout(() => {
      cleanup();
      resolve();
    }, milliseconds);
    const onAbort = () => {
      cleanup();
      reject(new DOMException("Processing was canceled.", "AbortError"));
    };

    signal.addEventListener("abort", onAbort, { once: true });
  });
}
