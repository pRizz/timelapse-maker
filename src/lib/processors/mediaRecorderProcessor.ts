import { resolveOutputDimensions } from "../timelapseSettings";
import {
  assertNotAborted,
  createOutputFileName,
  drawVideoContain,
  emitProgress,
  getCanvas2dContext,
  waitForMilliseconds,
} from "./processingUtils";
import type { ProcessInput, ProcessResult, Processor } from "./types";

const MEDIA_RECORDER_MIME_CANDIDATES = [
  'video/mp4;codecs="avc1.42E01E"',
  "video/mp4",
  "video/webm;codecs=vp9",
  "video/webm;codecs=vp8",
  "video/webm",
] as const;

export const mediaRecorderProcessor: Processor = {
  id: "media-recorder",
  label: "Canvas + MediaRecorder",
  supportsExactFrameSampling: false,
  outputMimeType: "video/webm",
  fileExtension: "webm",
  process: processWithMediaRecorder,
};

export function maybeFirstSupportedMediaRecorderMimeType(): string | null {
  if (!("MediaRecorder" in globalThis)) {
    return null;
  }

  return (
    MEDIA_RECORDER_MIME_CANDIDATES.find((mimeType) =>
      MediaRecorder.isTypeSupported(mimeType),
    ) ?? null
  );
}

async function processWithMediaRecorder(input: ProcessInput): Promise<ProcessResult> {
  assertNotAborted(input.signal);

  const maybeMimeType = maybeFirstSupportedMediaRecorderMimeType();
  if (!maybeMimeType) {
    throw new Error("MediaRecorder cannot export MP4 or WebM video in this browser.");
  }

  const outputDimensions = resolveOutputDimensions(input.metadata, input.settings.resolution);
  const canvas = document.createElement("canvas");
  canvas.width = outputDimensions.width;
  canvas.height = outputDimensions.height;
  const context = getCanvas2dContext(canvas);
  const frameDurationMs = 1000 / input.settings.outputFps;
  const stream = canvas.captureStream(input.settings.outputFps);
  const recorder = new MediaRecorder(stream, { mimeType: maybeMimeType });
  const chunks: BlobPart[] = [];

  const objectUrl = URL.createObjectURL(input.file);
  const video = document.createElement("video");
  video.preload = "auto";
  video.muted = true;
  video.playsInline = true;

  try {
    await loadVideoForCanvas(video, objectUrl, input.signal);

    const recorded = new Promise<Blob>((resolve, reject) => {
      const cleanup = () => {
        recorder.removeEventListener("dataavailable", onDataAvailable);
        recorder.removeEventListener("stop", onStop);
        recorder.removeEventListener("error", onError);
        input.signal.removeEventListener("abort", onAbort);
      };

      const onDataAvailable = (event: BlobEvent) => {
        if (event.data.size > 0) {
          chunks.push(event.data);
        }
      };

      const onStop = () => {
        cleanup();
        resolve(new Blob(chunks, { type: maybeMimeType }));
      };

      const onError = () => {
        cleanup();
        reject(new Error("MediaRecorder failed while encoding the timelapse."));
      };

      const onAbort = () => {
        cleanup();
        if (recorder.state !== "inactive") {
          recorder.stop();
        }
        reject(new DOMException("Processing was canceled.", "AbortError"));
      };

      recorder.addEventListener("dataavailable", onDataAvailable);
      recorder.addEventListener("stop", onStop, { once: true });
      recorder.addEventListener("error", onError, { once: true });
      input.signal.addEventListener("abort", onAbort, { once: true });
    });

    recorder.start();

    for (let index = 0; index < input.samplingPlan.timestampsSeconds.length; index += 1) {
      assertNotAborted(input.signal);
      const timestamp = input.samplingPlan.timestampsSeconds[index] ?? 0;

      emitProgress(input.onProgress, {
        stage: "decoding",
        completedFrames: index,
        totalFrames: input.samplingPlan.frameCount,
        message: `Seeking source frame ${index + 1} of ${input.samplingPlan.frameCount}`,
      });

      await seekVideo(video, timestamp, input.signal);
      drawVideoContain(context, video, outputDimensions.width, outputDimensions.height);

      const maybeVideoTrack = stream.getVideoTracks()[0] as
        | (MediaStreamTrack & { requestFrame?: () => void })
        | undefined;
      maybeVideoTrack?.requestFrame?.();

      emitProgress(input.onProgress, {
        stage: "encoding",
        completedFrames: index + 1,
        totalFrames: input.samplingPlan.frameCount,
        message: `Recording output frame ${index + 1} of ${input.samplingPlan.frameCount}`,
      });

      // MediaRecorder timestamps frames in real time. This fallback is slower than
      // WebCodecs, but it preserves playback duration without a heavy wasm encoder.
      await waitForMilliseconds(frameDurationMs, input.signal);
    }

    recorder.stop();
    const blob = await recorded;
    const fileExtension = maybeMimeType.startsWith("video/mp4") ? "mp4" : "webm";

    return {
      blob,
      mimeType: maybeMimeType,
      fileName: createOutputFileName(input.metadata.fileName, fileExtension, input.mode),
      durationSeconds: input.samplingPlan.estimatedOutputDurationSeconds,
      frameCount: input.samplingPlan.frameCount,
      warnings: maybeMimeType.startsWith("video/mp4")
        ? []
        : ["Downloaded fallback output is WebM because MP4 recording is unavailable."],
    };
  } finally {
    URL.revokeObjectURL(objectUrl);
    stream.getTracks().forEach((track) => track.stop());
  }
}

function loadVideoForCanvas(
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

function seekVideo(
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
