import { afterEach, describe, expect, it, vi } from "vitest";
import {
  canBrowserPreviewH264Mp4,
  chooseOutputFormatProfile,
  H264_HIGH_MP4_MIME_TYPE,
  maybeFirstSupportedMediaRecorderMp4MimeType,
  MP4_MIME_TYPE,
} from "./outputCompatibility";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("output compatibility", () => {
  it("chooses native H.264 MP4 when native encoding and playback are supported", () => {
    // Arrange
    const input = {
      canPreviewH264Mp4: true,
      canEncodeMp4WithWebCodecs: true,
      maybeMediaRecorderMp4MimeType: null,
      canUseFfmpegWasm: true,
    };

    // Act
    const profile = chooseOutputFormatProfile(input);

    // Assert
    expect(profile.id).toBe("mp4-h264-native");
    expect(profile.mimeType).toBe(MP4_MIME_TYPE);
    expect(profile.fileExtension).toBe("mp4");
  });

  it("chooses WASM H.264 MP4 when native MP4 encoding is unavailable", () => {
    // Arrange
    const input = {
      canPreviewH264Mp4: true,
      canEncodeMp4WithWebCodecs: false,
      maybeMediaRecorderMp4MimeType: null,
      canUseFfmpegWasm: true,
    };

    // Act
    const profile = chooseOutputFormatProfile(input);

    // Assert
    expect(profile.id).toBe("mp4-h264-wasm");
    expect(profile.mimeType).toBe(MP4_MIME_TYPE);
    expect(profile.warnings.join(" ")).toContain("ffmpeg.wasm");
  });

  it("reports unsupported when MP4 cannot be previewed", () => {
    // Arrange
    const input = {
      canPreviewH264Mp4: false,
      canEncodeMp4WithWebCodecs: true,
      maybeMediaRecorderMp4MimeType: H264_HIGH_MP4_MIME_TYPE,
      canUseFfmpegWasm: true,
    };

    // Act
    const profile = chooseOutputFormatProfile(input);

    // Assert
    expect(profile.id).toBe("unsupported");
    expect(profile.errors).toContain("This browser cannot preview H.264 MP4 output.");
  });

  it("checks MP4 playback support through a video element", () => {
    // Arrange
    const canPlayType = vi.fn((mimeType: string) =>
      mimeType === H264_HIGH_MP4_MIME_TYPE ? "probably" : "",
    );
    vi.spyOn(document, "createElement").mockReturnValue({
      canPlayType,
    } as unknown as HTMLVideoElement);

    // Act
    const canPreview = canBrowserPreviewH264Mp4();

    // Assert
    expect(canPreview).toBe(true);
    expect(canPlayType).toHaveBeenCalledWith(H264_HIGH_MP4_MIME_TYPE);
  });

  it("returns the first supported MediaRecorder MP4 MIME type", () => {
    // Arrange
    vi.stubGlobal("MediaRecorder", {
      isTypeSupported: vi.fn((mimeType: string) => mimeType === MP4_MIME_TYPE),
    });

    // Act
    const maybeMimeType = maybeFirstSupportedMediaRecorderMp4MimeType();

    // Assert
    expect(maybeMimeType).toBe(MP4_MIME_TYPE);
  });
});
