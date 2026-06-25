import type { VideoMetadata } from "./videoMetadata";

export const OUTPUT_FPS_OPTIONS = [12, 24, 30, 60] as const;
export const SPEED_MULTIPLIERS = [5, 10, 30, 60] as const;

export type OutputFps = (typeof OUTPUT_FPS_OPTIONS)[number];
export type SpeedMultiplier = (typeof SPEED_MULTIPLIERS)[number];
export type SamplingMode = "nth-frame" | "interval-seconds" | "target-duration";
export type ResolutionMode = "original" | "1080p" | "720p" | "custom-width";

export type SamplingSettings =
  | {
      mode: "nth-frame";
      everyNthFrame: number;
    }
  | {
      mode: "interval-seconds";
      intervalSeconds: number;
    }
  | {
      mode: "target-duration";
      targetDurationSeconds: number;
    };

export type ResolutionSettings =
  | {
      mode: "original" | "1080p" | "720p";
    }
  | {
      mode: "custom-width";
      customWidth: number;
    };

export type TimelapseSettings = {
  sampling: SamplingSettings;
  outputFps: OutputFps;
  speedMultiplier: SpeedMultiplier;
  resolution: ResolutionSettings;
  muteAudio: boolean;
};

export type OutputDimensions = {
  width: number;
  height: number;
};

export type SamplingPlan = {
  timestampsSeconds: number[];
  frameCount: number;
  estimatedOutputDurationSeconds: number;
  maybeEffectiveSpeed: number | null;
  warnings: string[];
};

export type SamplingPlanOptions = {
  maxFrameCount?: number;
  maxOutputDurationSeconds?: number;
};

export type ValidationCapabilities = {
  hasUsableProcessor: boolean;
  supportsExactFrameSampling: boolean;
  maybeFallbackMimeType?: string | null;
};

export type ValidationResult = {
  errors: string[];
  warnings: string[];
};

const MIN_OUTPUT_SECONDS = 0.2;
const DEFAULT_OUTPUT_FPS: OutputFps = 60;
const DEFAULT_SPEED_MULTIPLIER: SpeedMultiplier = 30;
const LARGE_FILE_BYTES = 500 * 1024 * 1024;
const LONG_VIDEO_SECONDS = 15 * 60;
const LARGE_OUTPUT_FRAME_COUNT = 10_000;

export function createDefaultSettings(maybeMetadata?: VideoMetadata | null): TimelapseSettings {
  const maybeTargetDurationSeconds = maybeMetadata
    ? Math.max(MIN_OUTPUT_SECONDS, maybeMetadata.durationSeconds / DEFAULT_SPEED_MULTIPLIER)
    : 6;

  return {
    sampling: {
      mode: "target-duration",
      targetDurationSeconds: roundToTenth(maybeTargetDurationSeconds),
    },
    outputFps: DEFAULT_OUTPUT_FPS,
    speedMultiplier: DEFAULT_SPEED_MULTIPLIER,
    resolution: { mode: "original" },
    muteAudio: true,
  };
}

export function applySpeedMultiplier(
  settings: TimelapseSettings,
  metadata: VideoMetadata,
  speedMultiplier: SpeedMultiplier,
): TimelapseSettings {
  return {
    ...settings,
    speedMultiplier,
    sampling: {
      mode: "target-duration",
      targetDurationSeconds: roundToTenth(metadata.durationSeconds / speedMultiplier),
    },
  };
}

export function resolveOutputDimensions(
  metadata: Pick<VideoMetadata, "width" | "height">,
  resolution: ResolutionSettings,
): OutputDimensions {
  if (resolution.mode === "original") {
    return {
      width: makeEven(metadata.width),
      height: makeEven(metadata.height),
    };
  }

  if (resolution.mode === "custom-width") {
    const width = makeEven(Math.min(resolution.customWidth, metadata.width));
    return {
      width,
      height: makeEven((metadata.height / metadata.width) * width),
    };
  }

  const maxHeight = resolution.mode === "1080p" ? 1080 : 720;
  const height = makeEven(Math.min(maxHeight, metadata.height));

  return {
    width: makeEven((metadata.width / metadata.height) * height),
    height,
  };
}

export function buildSamplingPlan(
  metadata: VideoMetadata,
  settings: TimelapseSettings,
  options: SamplingPlanOptions = {},
): SamplingPlan {
  const warnings: string[] = [];
  const timestampsSeconds = buildFullTimestamps(metadata, settings, warnings);
  const maxFramesFromDuration =
    options.maxOutputDurationSeconds === undefined
      ? Number.POSITIVE_INFINITY
      : Math.floor(options.maxOutputDurationSeconds * settings.outputFps);
  const maybeMaxFrameCount = Math.min(
    options.maxFrameCount ?? Number.POSITIVE_INFINITY,
    maxFramesFromDuration,
  );
  const cappedTimestamps = timestampsSeconds.slice(0, maybeMaxFrameCount);
  const frameCount = cappedTimestamps.length;
  const estimatedOutputDurationSeconds = frameCount / settings.outputFps;
  const maybeEffectiveSpeed =
    estimatedOutputDurationSeconds > 0
      ? metadata.durationSeconds / estimatedOutputDurationSeconds
      : null;

  if (timestampsSeconds.length > frameCount) {
    warnings.push("Preview is capped and does not include the full export.");
  }

  if (frameCount > LARGE_OUTPUT_FRAME_COUNT) {
    warnings.push("This render creates more than 10,000 frames and may take a long time.");
  }

  return {
    timestampsSeconds: cappedTimestamps,
    frameCount,
    estimatedOutputDurationSeconds,
    maybeEffectiveSpeed,
    warnings,
  };
}

export function validateSettings(
  metadata: VideoMetadata,
  settings: TimelapseSettings,
  capabilities?: ValidationCapabilities | null,
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!OUTPUT_FPS_OPTIONS.includes(settings.outputFps)) {
    errors.push("Choose a supported output FPS.");
  }

  if (!settings.muteAudio) {
    errors.push("Unmuted export is not supported in this browser-only version yet.");
  }

  if (metadata.fileSizeBytes > LARGE_FILE_BYTES) {
    warnings.push("Large video: browser memory use may be high for files over 500 MB.");
  }

  if (metadata.durationSeconds > LONG_VIDEO_SECONDS) {
    warnings.push("Long video: processing can be slow for videos over 15 minutes.");
  }

  if (!metadata.canPlayNatively) {
    warnings.push("Native playback support is uncertain; export may fail if the codec cannot decode.");
  }

  validateSampling(metadata, settings.sampling, capabilities, errors);
  validateResolution(metadata, settings.resolution, errors);

  const samplingPlan = buildSamplingPlan(metadata, settings);
  warnings.push(...samplingPlan.warnings);

  if (capabilities && !capabilities.hasUsableProcessor) {
    errors.push("No browser export processor is available for this video and settings.");
  }

  if (capabilities?.maybeFallbackMimeType?.startsWith("video/webm")) {
    warnings.push("Fallback export will download as WebM because MP4 recording is unavailable.");
  }

  return {
    errors,
    warnings,
  };
}

export function isTargetDurationSampling(
  sampling: SamplingSettings,
): sampling is Extract<SamplingSettings, { mode: "target-duration" }> {
  return sampling.mode === "target-duration";
}

function buildFullTimestamps(
  metadata: VideoMetadata,
  settings: TimelapseSettings,
  warnings: string[],
): number[] {
  if (settings.sampling.mode === "interval-seconds") {
    return buildIntervalTimestamps(metadata.durationSeconds, settings.sampling.intervalSeconds);
  }

  if (settings.sampling.mode === "target-duration") {
    const desiredFrameCount = Math.max(
      1,
      Math.ceil(settings.sampling.targetDurationSeconds * settings.outputFps),
    );
    return buildEvenlySpacedTimestamps(metadata.durationSeconds, desiredFrameCount);
  }

  const maybeEstimatedFps = metadata.maybeEstimatedFps;

  if (!maybeEstimatedFps) {
    warnings.push("FPS is unavailable, so keep-every-Nth-frame timing is approximate.");
    const approximateDuration = metadata.durationSeconds / settings.sampling.everyNthFrame;
    const approximateFrameCount = Math.max(1, Math.ceil(approximateDuration * settings.outputFps));
    return buildEvenlySpacedTimestamps(metadata.durationSeconds, approximateFrameCount);
  }

  const sourceFrameCount = Math.max(1, Math.ceil(metadata.durationSeconds * maybeEstimatedFps));
  const selectedFrameCount = Math.max(
    1,
    Math.ceil(sourceFrameCount / settings.sampling.everyNthFrame),
  );
  const intervalSeconds = settings.sampling.everyNthFrame / maybeEstimatedFps;

  return Array.from({ length: selectedFrameCount }, (_value, index) =>
    clampTimestamp(index * intervalSeconds, metadata.durationSeconds),
  );
}

function buildIntervalTimestamps(durationSeconds: number, intervalSeconds: number): number[] {
  const timestamps: number[] = [];

  for (let timestamp = 0; timestamp < durationSeconds; timestamp += intervalSeconds) {
    timestamps.push(clampTimestamp(timestamp, durationSeconds));
  }

  return timestamps.length > 0 ? timestamps : [0];
}

function buildEvenlySpacedTimestamps(durationSeconds: number, frameCount: number): number[] {
  if (frameCount <= 1) {
    return [0];
  }

  const intervalSeconds = durationSeconds / frameCount;

  return Array.from({ length: frameCount }, (_value, index) =>
    clampTimestamp(index * intervalSeconds, durationSeconds),
  );
}

function validateSampling(
  metadata: VideoMetadata,
  sampling: SamplingSettings,
  capabilities: ValidationCapabilities | null | undefined,
  errors: string[],
): void {
  if (sampling.mode === "nth-frame") {
    if (!Number.isInteger(sampling.everyNthFrame) || sampling.everyNthFrame < 2) {
      errors.push("Keep-every-Nth-frame must use an integer of 2 or greater.");
    }

    if (!metadata.maybeEstimatedFps && capabilities && !capabilities.supportsExactFrameSampling) {
      errors.push("Frame-based sampling needs an FPS estimate when using the fallback renderer.");
    }

    return;
  }

  if (sampling.mode === "interval-seconds") {
    if (!Number.isFinite(sampling.intervalSeconds) || sampling.intervalSeconds <= 0) {
      errors.push("Sample interval must be greater than zero seconds.");
    }

    if (sampling.intervalSeconds >= metadata.durationSeconds) {
      errors.push("Sample interval must be shorter than the source video.");
    }

    return;
  }

  if (!Number.isFinite(sampling.targetDurationSeconds) || sampling.targetDurationSeconds <= 0) {
    errors.push("Target output duration must be greater than zero.");
  }

  if (sampling.targetDurationSeconds >= metadata.durationSeconds) {
    errors.push("Target output duration must be shorter than the source video.");
  }
}

function validateResolution(
  metadata: VideoMetadata,
  resolution: ResolutionSettings,
  errors: string[],
): void {
  if (resolution.mode !== "custom-width") {
    return;
  }

  if (!Number.isInteger(resolution.customWidth)) {
    errors.push("Custom width must be a whole number.");
    return;
  }

  if (resolution.customWidth < 64) {
    errors.push("Custom width must be at least 64 pixels.");
  }

  if (resolution.customWidth > metadata.width) {
    errors.push("Custom width cannot upscale beyond the original width.");
  }
}

function clampTimestamp(timestamp: number, durationSeconds: number): number {
  return Math.min(Math.max(timestamp, 0), Math.max(0, durationSeconds - 0.001));
}

function makeEven(value: number): number {
  const rounded = Math.max(2, Math.round(value));
  return rounded % 2 === 0 ? rounded : rounded - 1;
}

function roundToTenth(value: number): number {
  return Math.round(value * 10) / 10;
}
