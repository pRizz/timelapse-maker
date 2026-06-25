import { cleanup, render } from "@solidjs/testing-library";
import { afterEach, describe, expect, it } from "vitest";
import type { VideoMetadata } from "../lib/videoMetadata";
import { VideoUploader } from "./VideoUploader";

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

afterEach(() => {
  cleanup();
});

describe("VideoUploader", () => {
  it("omits unavailable metadata rows", () => {
    // Arrange
    const metadata: VideoMetadata = {
      ...baseMetadata,
      maybeEstimatedFps: null,
    };

    // Act
    const { baseElement, queryByText } = render(() => renderVideoUploader(metadata));

    // Assert
    expect(queryByText("Estimated FPS")).not.toBeInTheDocument();
    expect(baseElement.textContent ?? "").not.toContain("Unavailable");
    expect(queryByText("Duration")).toBeInTheDocument();
    expect(queryByText("Resolution")).toBeInTheDocument();
    expect(queryByText("File size")).toBeInTheDocument();
  });

  it("renders known FPS metadata", () => {
    // Arrange
    // Act
    const { getByText } = render(() => renderVideoUploader(baseMetadata));

    // Assert
    expect(getByText("Estimated FPS")).toBeInTheDocument();
    expect(getByText("30.0 fps")).toBeInTheDocument();
  });
});

function renderVideoUploader(metadata: VideoMetadata) {
  return (
    <VideoUploader
      maybeMetadata={metadata}
      isLoading={false}
      maybeError={null}
      onFileSelected={() => undefined}
    />
  );
}
