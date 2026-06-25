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
  it("shows a gentle empty state before a source video is selected", () => {
    // Arrange
    // Act
    const { baseElement, getByText } = render(() =>
      renderOutputPane(null, {
        hasSourceVideo: false,
        canProcess: false,
        processorSupport: null,
      }),
    );

    // Assert
    expect(getByText("Choose a video to get started.")).toBeInTheDocument();
    expect(baseElement.textContent ?? "").not.toContain("Processor:");
    expect(baseElement.textContent ?? "").not.toContain("Unavailable");
  });

  it("omits the processor line when processor support is unavailable", () => {
    // Arrange
    const unsupportedProcessorSupport: ProcessorSupport = {
      ...processorSupport,
      id: "unsupported",
      label: "Unsupported",
      available: false,
      supportsExactFrameSampling: false,
      outputMimeType: null,
      fileExtension: null,
      outputFormatProfile: "unsupported",
      errors: ["No browser export processor is available."],
    };

    // Act
    const { baseElement, getByText } = render(() =>
      renderOutputPane(null, {
        hasSourceVideo: true,
        processorSupport: unsupportedProcessorSupport,
      }),
    );

    // Assert
    expect(getByText("No browser export processor is available.")).toBeInTheDocument();
    expect(baseElement.textContent ?? "").not.toContain("Processor:");
    expect(baseElement.textContent ?? "").not.toContain("Unavailable");
  });

  it("shows the processor line when processor support is available", () => {
    // Arrange
    // Act
    const { getByText } = render(() => renderOutputPane(null));

    // Assert
    expect(getByText("Processor:")).toBeInTheDocument();
    expect(getByText("WebCodecs MP4")).toBeInTheDocument();
  });

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

function renderOutputPane(
  maybeOutput: RenderedVideo | null,
  options: {
    hasSourceVideo?: boolean;
    canProcess?: boolean;
    processorSupport?: ProcessorSupport | null;
  } = {},
) {
  const resolvedProcessorSupport =
    options.processorSupport === undefined ? processorSupport : options.processorSupport;

  return (
    <OutputPane
      maybeOutput={maybeOutput}
      hasSourceVideo={options.hasSourceVideo ?? true}
      canProcess={options.canProcess ?? true}
      errors={[]}
      warnings={[]}
      metadataWarnings={[]}
      processorSupport={resolvedProcessorSupport}
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
