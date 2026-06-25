import {
  ALL_FORMATS,
  BlobSource,
  BufferTarget,
  CanvasSource,
  Input,
  Mp4OutputFormat,
  Output,
  QUALITY_HIGH,
  VideoSampleSink,
} from "mediabunny";
import { resolveOutputDimensions } from "../timelapseSettings";
import {
  assertNotAborted,
  clearCanvas,
  createOutputFileName,
  emitProgress,
  formatProcessingFrameMessage,
  getCanvas2dContext,
} from "./processingUtils";
import type { ProcessInput, ProcessResult, Processor } from "./types";

export const webCodecsProcessor: Processor = {
  id: "webcodecs",
  label: "WebCodecs MP4",
  supportsExactFrameSampling: true,
  outputMimeType: "video/mp4",
  fileExtension: "mp4",
  process: processWithWebCodecs,
};

async function processWithWebCodecs(input: ProcessInput): Promise<ProcessResult> {
  assertNotAborted(input.signal);

  const outputDimensions = resolveOutputDimensions(input.metadata, input.settings.resolution);
  const canvas = document.createElement("canvas");
  canvas.width = outputDimensions.width;
  canvas.height = outputDimensions.height;
  const context = getCanvas2dContext(canvas);
  const target = new BufferTarget();
  const output = new Output({
    format: new Mp4OutputFormat(),
    target,
  });
  const videoSource = new CanvasSource(canvas, {
    codec: "avc",
    bitrate: QUALITY_HIGH,
    keyFrameInterval: 2,
  });

  output.addVideoTrack(videoSource, {
    frameRate: input.samplingPlan.effectiveOutputFps,
  });

  const sourceInput = new Input({
    source: new BlobSource(input.file),
    formats: ALL_FORMATS,
  });
  const maybeVideoTrack = await sourceInput.getPrimaryVideoTrack();

  if (!maybeVideoTrack) {
    throw new Error("No video track was found in the uploaded file.");
  }

  if (!(await maybeVideoTrack.canDecode())) {
    throw new Error("This browser cannot decode the uploaded video's codec.");
  }

  emitProgress(input.onProgress, {
    stage: "preparing",
    completedFrames: 0,
    totalFrames: input.samplingPlan.frameCount,
    message: "Preparing MP4 encoder",
  });

  await output.start();
  const sampleSink = new VideoSampleSink(maybeVideoTrack, {
    hardwareAcceleration: "prefer-hardware",
  });

  // Mediabunny handles demuxing and MP4 muxing. We still add frames one at a
  // time and await CanvasSource.add so WebCodecs encoder backpressure is honored
  // instead of accumulating decoded frames in memory.
  if (input.settings.sampling.mode === "nth-frame" && !input.samplingPlan.isCapped) {
    await encodeEveryNthFrame(input, sampleSink, videoSource, context, outputDimensions);
  } else {
    await encodeFramesAtTimestamps(input, sampleSink, videoSource, context, outputDimensions);
  }

  assertNotAborted(input.signal);
  emitProgress(input.onProgress, {
    stage: "finalizing",
    completedFrames: input.samplingPlan.frameCount,
    totalFrames: input.samplingPlan.frameCount,
    message: "Finalizing MP4",
  });

  await output.finalize();

  if (!target.buffer) {
    throw new Error("MP4 muxing finished without producing an output buffer.");
  }

  return {
    blob: new Blob([target.buffer], { type: "video/mp4" }),
    mimeType: "video/mp4",
    fileName: createOutputFileName(input.metadata.fileName, "mp4", input.mode),
    durationSeconds: input.samplingPlan.estimatedOutputDurationSeconds,
    frameCount: input.samplingPlan.frameCount,
    warnings: [],
  };
}

async function encodeFramesAtTimestamps(
  input: ProcessInput,
  sampleSink: VideoSampleSink,
  videoSource: CanvasSource,
  context: CanvasRenderingContext2D,
  outputDimensions: { width: number; height: number },
): Promise<void> {
  let outputFrameIndex = 0;
  const outputFrameDuration = input.samplingPlan.outputFrameDurationSeconds;

  for await (const maybeSample of sampleSink.samplesAtTimestamps(
    input.samplingPlan.timestampsSeconds,
  )) {
    assertNotAborted(input.signal);

    if (!maybeSample) {
      continue;
    }

    clearCanvas(context, outputDimensions.width, outputDimensions.height);
    maybeSample.draw(context, 0, 0, outputDimensions.width, outputDimensions.height);
    maybeSample.close();

    await videoSource.add(outputFrameIndex * outputFrameDuration, outputFrameDuration, {
      keyFrame: shouldEncodeKeyFrame(outputFrameIndex, input.samplingPlan.effectiveOutputFps),
    });

    outputFrameIndex += 1;
    emitProgress(input.onProgress, {
      stage: "encoding",
      completedFrames: outputFrameIndex,
      totalFrames: input.samplingPlan.frameCount,
      message: formatProcessingFrameMessage(outputFrameIndex, input.samplingPlan.frameCount),
    });
  }
}

async function encodeEveryNthFrame(
  input: ProcessInput,
  sampleSink: VideoSampleSink,
  videoSource: CanvasSource,
  context: CanvasRenderingContext2D,
  outputDimensions: { width: number; height: number },
): Promise<void> {
  if (input.settings.sampling.mode !== "nth-frame") {
    return;
  }

  let sourceFrameIndex = 0;
  let outputFrameIndex = 0;
  const outputFrameDuration = input.samplingPlan.outputFrameDurationSeconds;

  for await (const sample of sampleSink.samples()) {
    assertNotAborted(input.signal);

    const shouldKeepFrame = sourceFrameIndex % input.settings.sampling.everyNthFrame === 0;
    sourceFrameIndex += 1;

    if (!shouldKeepFrame) {
      sample.close();
      continue;
    }

    if (outputFrameIndex >= input.samplingPlan.frameCount) {
      sample.close();
      break;
    }

    clearCanvas(context, outputDimensions.width, outputDimensions.height);
    sample.draw(context, 0, 0, outputDimensions.width, outputDimensions.height);
    sample.close();

    await videoSource.add(outputFrameIndex * outputFrameDuration, outputFrameDuration, {
      keyFrame: shouldEncodeKeyFrame(outputFrameIndex, input.samplingPlan.effectiveOutputFps),
    });

    outputFrameIndex += 1;
    emitProgress(input.onProgress, {
      stage: "encoding",
      completedFrames: outputFrameIndex,
      totalFrames: input.samplingPlan.frameCount,
      message: formatProcessingFrameMessage(outputFrameIndex, input.samplingPlan.frameCount),
    });
  }
}

function shouldEncodeKeyFrame(outputFrameIndex: number, effectiveOutputFps: number): boolean {
  const keyFrameInterval = Math.max(1, Math.round(effectiveOutputFps));
  return outputFrameIndex % keyFrameInterval === 0;
}
