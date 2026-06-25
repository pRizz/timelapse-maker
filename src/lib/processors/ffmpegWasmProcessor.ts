import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile } from "@ffmpeg/util";
import ffmpegCoreUrl from "@ffmpeg/core?url";
import ffmpegCoreWasmUrl from "@ffmpeg/core/wasm?url";
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
} from "./processingUtils";
import { MP4_MIME_TYPE } from "./outputCompatibility";
import type { ProcessInput, ProcessResult, Processor } from "./types";

const FRAME_DIRECTORY = "/frames";
const FRAME_PATTERN = `${FRAME_DIRECTORY}/frame-%06d.png`;
const OUTPUT_PATH = "/output.mp4";

export const ffmpegWasmProcessor: Processor = {
  id: "ffmpeg-wasm",
  label: "ffmpeg.wasm MP4",
  supportsExactFrameSampling: false,
  outputMimeType: MP4_MIME_TYPE,
  fileExtension: "mp4",
  process: processWithFfmpegWasm,
};

export type FfmpegH264Mp4ArgsInput = {
  frameRate: number;
  inputPattern: string;
  outputPath: string;
};

export function buildFfmpegH264Mp4Args(input: FfmpegH264Mp4ArgsInput): string[] {
  const frameRate = formatFfmpegFrameRate(input.frameRate);

  return [
    "-hide_banner",
    "-loglevel",
    "error",
    "-framerate",
    frameRate,
    "-start_number",
    "0",
    "-i",
    input.inputPattern,
    "-c:v",
    "libx264",
    "-preset",
    "slow",
    "-crf",
    "18",
    "-pix_fmt",
    "yuv420p",
    "-r",
    frameRate,
    "-movflags",
    "+faststart",
    "-an",
    input.outputPath,
  ];
}

function formatFfmpegFrameRate(frameRate: number): string {
  if (Number.isInteger(frameRate)) {
    return String(frameRate);
  }

  return frameRate.toFixed(6).replace(/0+$/, "").replace(/\.$/, "");
}

async function processWithFfmpegWasm(input: ProcessInput): Promise<ProcessResult> {
  assertNotAborted(input.signal);

  const outputDimensions = resolveOutputDimensions(input.metadata, input.settings.resolution);
  const canvas = document.createElement("canvas");
  canvas.width = outputDimensions.width;
  canvas.height = outputDimensions.height;
  const context = getCanvas2dContext(canvas);
  const objectUrl = URL.createObjectURL(input.file);
  const video = document.createElement("video");
  video.preload = "auto";
  video.muted = true;
  video.playsInline = true;
  const ffmpeg = new FFmpeg();
  const terminateOnAbort = () => ffmpeg.terminate();

  try {
    input.signal.addEventListener("abort", terminateOnAbort, { once: true });
    emitProgress(input.onProgress, {
      stage: "preparing",
      completedFrames: 0,
      totalFrames: input.samplingPlan.frameCount,
      message: "Loading ffmpeg.wasm",
    });

    await Promise.all([
      loadVideoForCanvas(video, objectUrl, input.signal),
      ffmpeg.load(
        {
          coreURL: ffmpegCoreUrl,
          wasmURL: ffmpegCoreWasmUrl,
        },
        { signal: input.signal },
      ),
    ]);

    await ffmpeg.createDir(FRAME_DIRECTORY, { signal: input.signal });
    await writeSampledFramesToFfmpeg(input, ffmpeg, video, context, outputDimensions);

    assertNotAborted(input.signal);
    emitProgress(input.onProgress, {
      stage: "encoding",
      completedFrames: input.samplingPlan.frameCount,
      totalFrames: input.samplingPlan.frameCount,
      message: "Encoding H.264 MP4 with ffmpeg.wasm",
    });

    const exitCode = await ffmpeg.exec(
      buildFfmpegH264Mp4Args({
        frameRate: input.samplingPlan.effectiveOutputFps,
        inputPattern: FRAME_PATTERN,
        outputPath: OUTPUT_PATH,
      }),
      -1,
      { signal: input.signal },
    );

    if (exitCode !== 0) {
      throw new Error(`ffmpeg.wasm failed to encode the MP4 output (exit ${exitCode}).`);
    }

    assertNotAborted(input.signal);
    emitProgress(input.onProgress, {
      stage: "finalizing",
      completedFrames: input.samplingPlan.frameCount,
      totalFrames: input.samplingPlan.frameCount,
      message: "Finalizing MP4",
    });

    const outputData = await ffmpeg.readFile(OUTPUT_PATH, undefined, {
      signal: input.signal,
    });

    if (typeof outputData === "string") {
      throw new Error("ffmpeg.wasm returned text instead of MP4 bytes.");
    }

    const outputBytes = new Uint8Array(outputData.byteLength);
    outputBytes.set(outputData);

    return {
      blob: new Blob([outputBytes.buffer], { type: MP4_MIME_TYPE }),
      mimeType: MP4_MIME_TYPE,
      fileName: createOutputFileName(input.metadata.fileName, "mp4", input.mode),
      durationSeconds: input.samplingPlan.estimatedOutputDurationSeconds,
      frameCount: input.samplingPlan.frameCount,
      warnings: [],
    };
  } finally {
    input.signal.removeEventListener("abort", terminateOnAbort);
    URL.revokeObjectURL(objectUrl);
    ffmpeg.terminate();
  }
}

async function writeSampledFramesToFfmpeg(
  input: ProcessInput,
  ffmpeg: FFmpeg,
  video: HTMLVideoElement,
  context: CanvasRenderingContext2D,
  outputDimensions: { width: number; height: number },
): Promise<void> {
  for (let index = 0; index < input.samplingPlan.timestampsSeconds.length; index += 1) {
    assertNotAborted(input.signal);
    const timestamp = input.samplingPlan.timestampsSeconds[index] ?? 0;

    await seekVideo(video, timestamp, input.signal);
    drawVideoContain(context, video, outputDimensions.width, outputDimensions.height);
    const pngBlob = await canvasToPngBlob(context.canvas, input.signal);
    await ffmpeg.writeFile(framePath(index), await fetchFile(pngBlob), {
      signal: input.signal,
    });

    emitProgress(input.onProgress, {
      stage: "decoding",
      completedFrames: index + 1,
      totalFrames: input.samplingPlan.frameCount,
      message: formatProcessingFrameMessage(index + 1, input.samplingPlan.frameCount),
    });
  }
}

function canvasToPngBlob(canvas: HTMLCanvasElement, signal: AbortSignal): Promise<Blob> {
  assertNotAborted(signal);

  return new Promise((resolve, reject) => {
    const onAbort = () => {
      reject(new DOMException("Processing was canceled.", "AbortError"));
    };

    signal.addEventListener("abort", onAbort, { once: true });
    canvas.toBlob(
      (maybeBlob) => {
        signal.removeEventListener("abort", onAbort);

        if (signal.aborted) {
          reject(new DOMException("Processing was canceled.", "AbortError"));
          return;
        }

        if (!maybeBlob) {
          reject(new Error("The browser could not encode a lossless canvas frame for ffmpeg.wasm."));
          return;
        }

        resolve(maybeBlob);
      },
      "image/png",
    );
  });
}

function framePath(frameIndex: number): string {
  return `${FRAME_DIRECTORY}/frame-${String(frameIndex).padStart(6, "0")}.png`;
}
