import { describe, expect, it } from "vitest";
import { chooseProcessor } from "./selectProcessor";

describe("chooseProcessor", () => {
  it("prefers WebCodecs MP4 when available", () => {
    // Arrange
    const capabilities = {
      hasWebCodecs: true,
      canEncodeMp4WithWebCodecs: true,
      maybeMediaRecorderMimeType: "video/webm",
    };

    // Act
    const selection = chooseProcessor(capabilities);

    // Assert
    expect(selection.processor?.id).toBe("webcodecs");
    expect(selection.support.outputMimeType).toBe("video/mp4");
  });

  it("falls back to MediaRecorder when WebCodecs MP4 is unavailable", () => {
    // Arrange
    const capabilities = {
      hasWebCodecs: false,
      canEncodeMp4WithWebCodecs: false,
      maybeMediaRecorderMimeType: "video/webm;codecs=vp8",
    };

    // Act
    const selection = chooseProcessor(capabilities);

    // Assert
    expect(selection.processor?.id).toBe("media-recorder");
    expect(selection.support.fileExtension).toBe("webm");
  });

  it("reports no processor when browser encoding is unavailable", () => {
    // Arrange
    const capabilities = {
      hasWebCodecs: false,
      canEncodeMp4WithWebCodecs: false,
      maybeMediaRecorderMimeType: null,
    };

    // Act
    const selection = chooseProcessor(capabilities);

    // Assert
    expect(selection.processor).toBeNull();
    expect(selection.support.available).toBe(false);
  });
});
