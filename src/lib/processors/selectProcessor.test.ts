import { describe, expect, it } from "vitest";
import { chooseProcessor } from "./selectProcessor";

describe("chooseProcessor", () => {
  it("prefers WebCodecs MP4 when available", () => {
    // Arrange
    const capabilities = {
      hasWebCodecs: true,
      canEncodeMp4WithWebCodecs: true,
      maybeMediaRecorderMp4MimeType: "video/mp4",
      canPreviewH264Mp4: true,
      canUseFfmpegWasm: true,
    };

    // Act
    const selection = chooseProcessor(capabilities);

    // Assert
    expect(selection.processor?.id).toBe("webcodecs");
    expect(selection.support.outputMimeType).toBe("video/mp4");
    expect(selection.support.outputFormatProfile).toBe("mp4-h264-native");
  });

  it("falls back to MediaRecorder MP4 when WebCodecs MP4 is unavailable", () => {
    // Arrange
    const capabilities = {
      hasWebCodecs: false,
      canEncodeMp4WithWebCodecs: false,
      maybeMediaRecorderMp4MimeType: "video/mp4",
      canPreviewH264Mp4: true,
      canUseFfmpegWasm: true,
    };

    // Act
    const selection = chooseProcessor(capabilities);

    // Assert
    expect(selection.processor?.id).toBe("media-recorder");
    expect(selection.support.outputMimeType).toBe("video/mp4");
    expect(selection.support.fileExtension).toBe("mp4");
  });

  it("uses the WASM fallback when native MP4 encoding is unavailable", () => {
    // Arrange
    const capabilities = {
      hasWebCodecs: false,
      canEncodeMp4WithWebCodecs: false,
      maybeMediaRecorderMp4MimeType: null,
      canPreviewH264Mp4: true,
      canUseFfmpegWasm: true,
    };

    // Act
    const selection = chooseProcessor(capabilities);

    // Assert
    expect(selection.processor?.id).toBe("ffmpeg-wasm");
    expect(selection.support.fileExtension).toBe("mp4");
    expect(selection.support.outputFormatProfile).toBe("mp4-h264-wasm");
  });

  it("reports no processor when previewable MP4 output is unavailable", () => {
    // Arrange
    const capabilities = {
      hasWebCodecs: false,
      canEncodeMp4WithWebCodecs: false,
      maybeMediaRecorderMp4MimeType: null,
      canPreviewH264Mp4: false,
      canUseFfmpegWasm: true,
    };

    // Act
    const selection = chooseProcessor(capabilities);

    // Assert
    expect(selection.processor).toBeNull();
    expect(selection.support.available).toBe(false);
    expect(selection.support.outputFormatProfile).toBe("unsupported");
  });
});
