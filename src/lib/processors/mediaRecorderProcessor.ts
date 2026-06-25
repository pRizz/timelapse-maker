import { resolveOutputDimensions } from "../timelapseSettings";
import {
  assertNotAborted,
  createOutputFileName,
  drawVideoContain,
  emitProgress,
  formatProcessingFrameMessage,
  getCanvas2dContext,
  loadVideoForCanvas,
  seekVideo,
  waitForMilliseconds,
} from "./processingUtils";
import { maybeFirstSupportedMediaRecorderMp4MimeType } from "./outputCompatibility";
import type { ProcessInput, ProcessResult, Processor } from "./types";

export const mediaRecorderProcessor: Processor = {
  id: "media-recorder",
  label: "Canvas + MediaRecorder MP4",
  supportsExactFrameSampling: false,
  outputMimeType: "video/mp4",
  fileExtension: "mp4",
  process: processWithMediaRecorder,
};

async function processWithMediaRecorder(input: ProcessInput): Promise<ProcessResult> {
  assertNotAborted(input.signal);

  const maybeMimeType = maybeFirstSupportedMediaRecorderMp4MimeType();
  if (!maybeMimeType) {
    throw new Error("MediaRecorder cannot export H.264 MP4 video in this browser.");
  }

  const outputDimensions = resolveOutputDimensions(input.metadata, input.settings.resolution);
  const canvas = document.createElement("canvas");
  canvas.width = outputDimensions.width;
  canvas.height = outputDimensions.height;
  const context = getCanvas2dContext(canvas);
  const frameDurationMs = input.samplingPlan.outputFrameDurationSeconds * 1000;
  const stream = canvas.captureStream(input.samplingPlan.effectiveOutputFps);
  const recorder = new MediaRecorder(stream, {
    mimeType: maybeMimeType,
    videoBitsPerSecond: calculateMediaRecorderVideoBitsPerSecond(
      outputDimensions,
      input.samplingPlan.effectiveOutputFps,
    ),
  });
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
    await pauseRecorder(recorder, input.signal);

    for (let index = 0; index < input.samplingPlan.timestampsSeconds.length; index += 1) {
      assertNotAborted(input.signal);
      const timestamp = input.samplingPlan.timestampsSeconds[index] ?? 0;

      emitProgress(input.onProgress, {
        stage: "decoding",
        completedFrames: index,
        totalFrames: input.samplingPlan.frameCount,
        message: formatProcessingFrameMessage(index + 1, input.samplingPlan.frameCount),
      });

      await seekVideo(video, timestamp, input.signal);
      drawVideoContain(context, video, outputDimensions.width, outputDimensions.height);

      await resumeRecorder(recorder, input.signal);
      const maybeVideoTrack = stream.getVideoTracks()[0] as
        | (MediaStreamTrack & { requestFrame?: () => void })
        | undefined;
      maybeVideoTrack?.requestFrame?.();

      emitProgress(input.onProgress, {
        stage: "encoding",
        completedFrames: index + 1,
        totalFrames: input.samplingPlan.frameCount,
        message: formatProcessingFrameMessage(index + 1, input.samplingPlan.frameCount),
      });

      // MediaRecorder timestamps frames in real time. This fallback is slower than
      // WebCodecs, but it preserves playback duration without a heavy wasm encoder.
      await waitForMilliseconds(frameDurationMs, input.signal);
      await pauseRecorder(recorder, input.signal);
    }

    recorder.stop();
    const blob = await recorded;

    return {
      blob,
      mimeType: maybeMimeType,
      fileName: createOutputFileName(input.metadata.fileName, "mp4", input.mode),
      durationSeconds: input.samplingPlan.estimatedOutputDurationSeconds,
      frameCount: input.samplingPlan.frameCount,
      warnings: [],
    };
  } finally {
    URL.revokeObjectURL(objectUrl);
    stream.getTracks().forEach((track) => track.stop());
  }
}

function pauseRecorder(recorder: MediaRecorder, signal: AbortSignal): Promise<void> {
  if (recorder.state !== "recording") {
    return Promise.resolve();
  }

  return waitForRecorderStateChange(recorder, signal, "pause", () => recorder.pause());
}

function resumeRecorder(recorder: MediaRecorder, signal: AbortSignal): Promise<void> {
  if (recorder.state !== "paused") {
    return Promise.resolve();
  }

  return waitForRecorderStateChange(recorder, signal, "resume", () => recorder.resume());
}

function waitForRecorderStateChange(
  recorder: MediaRecorder,
  signal: AbortSignal,
  eventName: "pause" | "resume",
  changeState: () => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      recorder.removeEventListener(eventName, onStateChange);
      recorder.removeEventListener("error", onError);
      signal.removeEventListener("abort", onAbort);
    };

    const onStateChange = () => {
      cleanup();
      resolve();
    };

    const onError = () => {
      cleanup();
      reject(new Error("MediaRecorder failed while changing recording state."));
    };

    const onAbort = () => {
      cleanup();
      reject(new DOMException("Processing was canceled.", "AbortError"));
    };

    recorder.addEventListener(eventName, onStateChange, { once: true });
    recorder.addEventListener("error", onError, { once: true });
    signal.addEventListener("abort", onAbort, { once: true });

    try {
      changeState();
    } catch (error) {
      cleanup();
      reject(error);
    }
  });
}

export function calculateMediaRecorderVideoBitsPerSecond(
  dimensions: { width: number; height: number },
  outputFps: number,
): number {
  const pixelsPerSecond = dimensions.width * dimensions.height * outputFps;
  const targetBitrate = Math.round(pixelsPerSecond * 0.14);

  return Math.min(50_000_000, Math.max(2_000_000, targetBitrate));
}
