import { describe, expect, it } from "vitest";
import { calculateMediaRecorderVideoBitsPerSecond } from "./mediaRecorderProcessor";

describe("mediaRecorderProcessor", () => {
  it("sets a high bounded bitrate from output size and frame rate", () => {
    // Arrange
    const dimensions = { width: 1920, height: 1080 };

    // Act
    const bitrate = calculateMediaRecorderVideoBitsPerSecond(dimensions, 60);

    // Assert
    expect(bitrate).toBe(17_418_240);
  });

  it("keeps very small outputs above the minimum bitrate", () => {
    // Arrange
    const dimensions = { width: 320, height: 180 };

    // Act
    const bitrate = calculateMediaRecorderVideoBitsPerSecond(dimensions, 12);

    // Assert
    expect(bitrate).toBe(2_000_000);
  });
});
