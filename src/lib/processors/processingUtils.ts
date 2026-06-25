import type { ProcessingProgress } from "./types";

export function assertNotAborted(signal: AbortSignal): void {
  if (signal.aborted) {
    throw new DOMException("Processing was canceled.", "AbortError");
  }
}

export function createOutputFileName(
  sourceName: string,
  extension: "mp4",
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

export function formatProcessingFrameMessage(currentFrame: number, totalFrames: number): string {
  return `Processing frame ${currentFrame} / ${totalFrames}`;
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

export function loadVideoForCanvas(
  video: HTMLVideoElement,
  objectUrl: string,
  signal: AbortSignal,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      video.removeEventListener("loadeddata", onLoadedData);
      video.removeEventListener("error", onError);
      signal.removeEventListener("abort", onAbort);
    };

    const onLoadedData = () => {
      cleanup();
      resolve();
    };

    const onError = () => {
      cleanup();
      reject(new Error("The browser could not decode this video for canvas processing."));
    };

    const onAbort = () => {
      cleanup();
      reject(new DOMException("Processing was canceled.", "AbortError"));
    };

    video.addEventListener("loadeddata", onLoadedData, { once: true });
    video.addEventListener("error", onError, { once: true });
    signal.addEventListener("abort", onAbort, { once: true });
    video.src = objectUrl;
  });
}

export function seekVideo(
  video: HTMLVideoElement,
  timestampSeconds: number,
  signal: AbortSignal,
): Promise<void> {
  return new Promise((resolve, reject) => {
    if (Math.abs(video.currentTime - timestampSeconds) < 0.01 && video.readyState >= 2) {
      resolve();
      return;
    }

    const cleanup = () => {
      video.removeEventListener("seeked", onSeeked);
      video.removeEventListener("error", onError);
      signal.removeEventListener("abort", onAbort);
    };

    const onSeeked = () => {
      cleanup();
      resolve();
    };

    const onError = () => {
      cleanup();
      reject(new Error("The browser failed while seeking the source video."));
    };

    const onAbort = () => {
      cleanup();
      reject(new DOMException("Processing was canceled.", "AbortError"));
    };

    video.addEventListener("seeked", onSeeked, { once: true });
    video.addEventListener("error", onError, { once: true });
    signal.addEventListener("abort", onAbort, { once: true });
    video.currentTime = Math.max(0, timestampSeconds);
  });
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
