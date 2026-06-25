import { describe, expect, it } from "vitest";
import { formatProcessingFrameMessage } from "./processingUtils";

describe("processing utils", () => {
  it("formats stable per-frame progress text", () => {
    // Arrange
    const currentFrame = 12;
    const totalFrames = 240;

    // Act
    const message = formatProcessingFrameMessage(currentFrame, totalFrames);

    // Assert
    expect(message).toBe("Processing frame 12 / 240");
  });
});
