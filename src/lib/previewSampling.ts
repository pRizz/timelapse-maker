import type { TimelapseSettings } from "./timelapseSettings";

const PREVIEW_MAX_FRAMES = 240;
const PREVIEW_FRAME_BUDGET_SECONDS = 8;

export function buildPreviewSamplingOptions(
  settings: Pick<TimelapseSettings, "outputFps">,
): { maxFrameCount: number } {
  return {
    maxFrameCount: Math.min(
      PREVIEW_MAX_FRAMES,
      Math.floor(PREVIEW_FRAME_BUDGET_SECONDS * settings.outputFps),
    ),
  };
}
