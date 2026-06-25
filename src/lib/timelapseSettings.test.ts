import { describe, expect, it } from "vitest";
import {
  buildSamplingPlan,
  createDefaultSettings,
  resolveOutputDimensions,
  validateSettings,
  type TimelapseSettings,
} from "./timelapseSettings";
import type { VideoMetadata } from "./videoMetadata";

const baseMetadata: VideoMetadata = {
  fileName: "source.mp4",
  fileType: "video/mp4",
  fileSizeBytes: 120_000_000,
  durationSeconds: 120,
  width: 1920,
  height: 1080,
  maybeEstimatedFps: 30,
  canPlayNatively: true,
  warnings: [],
};

describe("timelapse settings", () => {
  it("builds a target-duration sampling plan", () => {
    // Arrange
    const settings = createDefaultSettings(baseMetadata);

    // Act
    const plan = buildSamplingPlan(baseMetadata, settings);

    // Assert
    expect(plan.frameCount).toBe(288);
    expect(plan.estimatedOutputDurationSeconds).toBe(12);
    expect(plan.maybeEffectiveSpeed).toBe(10);
  });

  it("samples interval timestamps from zero", () => {
    // Arrange
    const settings: TimelapseSettings = {
      ...createDefaultSettings(baseMetadata),
      sampling: { mode: "interval-seconds", intervalSeconds: 15 },
      outputFps: 24,
    };

    // Act
    const plan = buildSamplingPlan(baseMetadata, settings);

    // Assert
    expect(plan.timestampsSeconds).toEqual([0, 15, 30, 45, 60, 75, 90, 105]);
    expect(plan.estimatedOutputDurationSeconds).toBeCloseTo(8 / 24);
  });

  it("estimates keep-every-Nth-frame duration from source FPS", () => {
    // Arrange
    const settings: TimelapseSettings = {
      ...createDefaultSettings(baseMetadata),
      sampling: { mode: "nth-frame", everyNthFrame: 10 },
      outputFps: 30,
    };

    // Act
    const plan = buildSamplingPlan(baseMetadata, settings);

    // Assert
    expect(plan.frameCount).toBe(360);
    expect(plan.estimatedOutputDurationSeconds).toBe(12);
  });

  it("preserves aspect ratio when resizing to 720p", () => {
    // Arrange
    const resolution = { mode: "720p" } as const;

    // Act
    const dimensions = resolveOutputDimensions(baseMetadata, resolution);

    // Assert
    expect(dimensions).toEqual({ width: 1280, height: 720 });
  });

  it("blocks target duration that is not shorter than the source", () => {
    // Arrange
    const settings: TimelapseSettings = {
      ...createDefaultSettings(baseMetadata),
      sampling: { mode: "target-duration", targetDurationSeconds: 120 },
    };

    // Act
    const validation = validateSettings(baseMetadata, settings, {
      hasUsableProcessor: true,
      supportsExactFrameSampling: true,
    });

    // Assert
    expect(validation.errors).toContain("Target output duration must be shorter than the source video.");
  });

  it("warns about very large videos", () => {
    // Arrange
    const metadata = {
      ...baseMetadata,
      fileSizeBytes: 501 * 1024 * 1024,
    };

    // Act
    const validation = validateSettings(metadata, createDefaultSettings(metadata), {
      hasUsableProcessor: true,
      supportsExactFrameSampling: true,
    });

    // Assert
    expect(validation.warnings).toContain(
      "Large video: browser memory use may be high for files over 500 MB.",
    );
  });
});
