import { describe, expect, it } from "vitest";
import { createOutputFileName, formatProcessingFrameMessage } from "./processingUtils";

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

  it("keeps preview and export filename suffixes distinct", () => {
    // Arrange
    const sourceName = "My Source.mov";

    // Act
    const previewName = createOutputFileName(sourceName, "mp4", "preview");
    const exportName = createOutputFileName(sourceName, "mp4", "export");

    // Assert
    expect(previewName).toBe("My-Source-preview.mp4");
    expect(exportName).toBe("My-Source-timelapse.mp4");
  });
});
