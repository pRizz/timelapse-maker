import { describe, expect, it } from "vitest";
import { buildFfmpegH264Mp4Args } from "./ffmpegWasmProcessor";

describe("ffmpegWasmProcessor", () => {
  it("builds high-quality H.264 MP4 args from the sampling frame rate", () => {
    // Arrange
    const input = {
      frameRate: 59.94006,
      inputPattern: "/frames/frame-%06d.png",
      outputPath: "/output.mp4",
    };

    // Act
    const args = buildFfmpegH264Mp4Args(input);

    // Assert
    expect(args).toEqual([
      "-hide_banner",
      "-loglevel",
      "error",
      "-framerate",
      "59.94006",
      "-start_number",
      "0",
      "-i",
      "/frames/frame-%06d.png",
      "-c:v",
      "libx264",
      "-preset",
      "slow",
      "-crf",
      "18",
      "-pix_fmt",
      "yuv420p",
      "-r",
      "59.94006",
      "-movflags",
      "+faststart",
      "-an",
      "/output.mp4",
    ]);
  });

  it("keeps integer frame rates concise", () => {
    // Arrange
    const input = {
      frameRate: 60,
      inputPattern: "/frames/frame-%06d.png",
      outputPath: "/output.mp4",
    };

    // Act
    const args = buildFfmpegH264Mp4Args(input);

    // Assert
    expect(args[4]).toBe("60");
    expect(args[18]).toBe("60");
  });
});
