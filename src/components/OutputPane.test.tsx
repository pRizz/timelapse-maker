import { cleanup, render } from "@solidjs/testing-library";
import { afterEach, describe, expect, it } from "vitest";
import type { RenderedVideo } from "../lib/renderedVideo";
import type { ProcessorSupport } from "../lib/processors/types";
import { OutputPane } from "./OutputPane";

const processorSupport: ProcessorSupport = {
  id: "webcodecs",
  label: "WebCodecs MP4",
  available: true,
  supportsExactFrameSampling: true,
  outputMimeType: "video/mp4",
  fileExtension: "mp4",
  outputFormatProfile: "mp4-h264-native",
  warnings: [],
  errors: [],
};

afterEach(() => {
  cleanup();
});

describe("OutputPane", () => {
  it("renders a typed video source when the output is previewable", () => {
    // Arrange
    const output = buildRenderedVideo({ canPreview: true });

    // Act
    const { baseElement } = render(() => renderOutputPane(output));

    // Assert
    const source = baseElement.querySelector("source");
    expect(source?.getAttribute("src")).toBe("blob:output");
    expect(source?.getAttribute("type")).toBe("video/mp4");
    expect(baseElement.textContent ?? "").not.toContain("cannot preview");
  });

  it("shows a download-only message when the output is not previewable", () => {
    // Arrange
    const output = buildRenderedVideo({ canPreview: false });

    // Act
    const { baseElement, getByText } = render(() => renderOutputPane(output));

    // Assert
    expect(baseElement.querySelector("video")).toBeNull();
    expect(getByText(/cannot preview the finished MP4/i)).toBeInTheDocument();
    expect(baseElement.querySelector('a[download="source-timelapse.mp4"]')).not.toBeNull();
  });
});

function renderOutputPane(output: RenderedVideo) {
  return (
    <OutputPane
      maybeOutput={output}
      canProcess={true}
      errors={[]}
      warnings={[]}
      metadataWarnings={[]}
      processorSupport={processorSupport}
      maybeProgress={null}
      isExporting={false}
      isOutputStale={false}
      hasExportAttempted={true}
      onExport={() => undefined}
      onCancel={() => undefined}
    />
  );
}

function buildRenderedVideo(options: { canPreview: boolean }): RenderedVideo {
  return {
    url: "blob:output",
    fileName: "source-timelapse.mp4",
    mimeType: "video/mp4",
    durationSeconds: 4,
    frameCount: 240,
    warnings: [],
    canPreview: options.canPreview,
  };
}
