import { cleanup, fireEvent, render, waitFor } from "@solidjs/testing-library";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import type { ProcessorSelection, ProcessInput, ProcessResult } from "./lib/processors/types";
import { formatProcessingFrameMessage } from "./lib/processors/processingUtils";
import type { VideoMetadata } from "./lib/videoMetadata";

const mocks = vi.hoisted(() => ({
  loadVideoMetadata: vi.fn(),
  process: vi.fn(),
  selectProcessor: vi.fn(),
}));

vi.mock("./lib/videoMetadata", () => ({
  loadVideoMetadata: mocks.loadVideoMetadata,
}));

vi.mock("./lib/processors/selectProcessor", () => ({
  selectProcessor: mocks.selectProcessor,
  toValidationCapabilities: (selection: ProcessorSelection) => ({
    hasUsableProcessor: selection.processor !== null,
    supportsExactFrameSampling: selection.support.supportsExactFrameSampling,
    maybeFallbackMimeType:
      selection.support.id === "media-recorder" ? selection.support.outputMimeType : null,
  }),
}));

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

const processorSelection: ProcessorSelection = {
  processor: {
    id: "webcodecs",
    label: "WebCodecs MP4",
    supportsExactFrameSampling: true,
    outputMimeType: "video/mp4",
    fileExtension: "mp4",
    process: mocks.process,
  },
  support: {
    id: "webcodecs",
    label: "WebCodecs MP4",
    available: true,
    supportsExactFrameSampling: true,
    outputMimeType: "video/mp4",
    fileExtension: "mp4",
    warnings: [],
    errors: [],
  },
};

beforeEach(() => {
  mocks.loadVideoMetadata.mockResolvedValue(baseMetadata);
  mocks.selectProcessor.mockResolvedValue(processorSelection);
  mocks.process.mockImplementation(async (input: ProcessInput) => buildProcessResult(input));

  Object.defineProperty(URL, "createObjectURL", {
    configurable: true,
    value: vi.fn(() => "blob:preview"),
  });
  Object.defineProperty(URL, "revokeObjectURL", {
    configurable: true,
    value: vi.fn(),
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

describe("App", () => {
  it("renders the utility with disabled processing before upload", () => {
    // Arrange
    const { baseElement } = render(() => <App />);

    // Act
    const text = baseElement.textContent ?? "";
    const buttons = Array.from(baseElement.querySelectorAll("button"));
    const maybePreviewButton = buttons.find((button) => /generate preview/i.test(button.textContent ?? ""));
    const maybeExportButton = buttons.find((button) => /export video/i.test(button.textContent ?? ""));
    const maybeCommitLink = Array.from(baseElement.querySelectorAll("a")).find((link) =>
      link.getAttribute("href")?.includes("/commit/"),
    );

    // Assert
    expect(text).toContain("Timelapse Maker");
    expect(text).toContain("Your video stays on your device");
    expect(text).not.toContain("Client-side video utility");
    expect(text).not.toContain("Copy build info");
    expect(maybeCommitLink?.textContent).toMatch(/^[0-9a-f]{7}$/i);
    expect(maybeCommitLink?.getAttribute("href")).toMatch(
      /^https:\/\/github\.com\/pRizz\/timelapse-maker\/commit\/[0-9a-f]{40}$/i,
    );
    expect(maybePreviewButton?.disabled).toBe(true);
    expect(maybeExportButton?.disabled).toBe(true);
  });

  it("automatically generates a capped preview after dropping a source video", async () => {
    // Arrange
    const file = new File(["video"], "source.mp4", { type: "video/mp4" });
    mocks.loadVideoMetadata.mockResolvedValueOnce({
      ...baseMetadata,
      durationSeconds: 600,
    });
    const { baseElement, getByText } = render(() => <App />);
    const dropZone = getByText("Drop an iPhone, MP4, or MOV video").closest("label");

    // Act
    fireEvent.drop(dropZone!, {
      dataTransfer: {
        files: {
          item: (index: number) => (index === 0 ? file : null),
        },
      },
    });

    // Assert
    await waitFor(() => expect(mocks.process).toHaveBeenCalledTimes(1));
    const processInput = mocks.process.mock.calls[0][0] as ProcessInput;
    expect(processInput.file).toBe(file);
    expect(processInput.mode).toBe("preview");
    expect(processInput.settings.speedMultiplier).toBe(30);
    expect(processInput.settings.outputFps).toBe(60);
    expect(processInput.samplingPlan.frameCount).toBe(240);
    expect(processInput.samplingPlan.estimatedOutputDurationSeconds).toBe(20);
    expect(processInput.samplingPlan.outputFrameDurationSeconds).toBeCloseTo(20 / 240);
    expect(processInput.samplingPlan.isCapped).toBe(true);
    await waitFor(() =>
      expect(baseElement.querySelector("video")?.getAttribute("src")).toBe("blob:preview"),
    );
  });

  it("shows preview progress while the automatic preview is pending", async () => {
    // Arrange
    const file = new File(["video"], "source.mp4", { type: "video/mp4" });
    const deferred = createDeferred<void>();
    mocks.process.mockImplementationOnce((input: ProcessInput) => {
      input.onProgress({
        stage: "encoding",
        completedFrames: 12,
        totalFrames: 240,
        message: formatProcessingFrameMessage(12, 240),
      });

      return deferred.promise.then(() => buildProcessResult(input));
    });
    const { baseElement, getAllByText, getByText } = render(() => <App />);
    const dropZone = getByText("Drop an iPhone, MP4, or MOV video").closest("label");

    // Act
    fireEvent.drop(dropZone!, {
      dataTransfer: {
        files: {
          item: (index: number) => (index === 0 ? file : null),
        },
      },
    });

    // Assert
    await waitFor(() => expect(mocks.process).toHaveBeenCalledTimes(1));
    expect(getByText("Preview is generating")).toBeInTheDocument();
    expect(getAllByText("Processing frame 12 / 240")).toHaveLength(2);
    deferred.resolve();
    await waitFor(() =>
      expect(baseElement.querySelector("video")?.getAttribute("src")).toBe("blob:preview"),
    );
  });

  it("starts a download after export while keeping the download link available", async () => {
    // Arrange
    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => undefined);
    const file = new File(["video"], "source.mp4", { type: "video/mp4" });
    const { baseElement, getByText } = render(() => <App />);
    const dropZone = getByText("Drop an iPhone, MP4, or MOV video").closest("label");

    fireEvent.drop(dropZone!, {
      dataTransfer: {
        files: {
          item: (index: number) => (index === 0 ? file : null),
        },
      },
    });
    await waitFor(() =>
      expect(baseElement.querySelector("video")?.getAttribute("src")).toBe("blob:preview"),
    );
    const maybeExportButton = Array.from(baseElement.querySelectorAll("button")).find((button) =>
      /export video/i.test(button.textContent ?? ""),
    );

    // Act
    fireEvent.click(maybeExportButton!);

    // Assert
    await waitFor(() => expect(mocks.process).toHaveBeenCalledTimes(2));
    expect(clickSpy).toHaveBeenCalledTimes(1);
    await waitFor(() =>
      expect(baseElement.querySelector('a[download="source-timelapse.mp4"]')).not.toBeNull(),
    );
    expect(getByText("Download")).toBeInTheDocument();
  });
});

function buildProcessResult(input: ProcessInput): ProcessResult {
  const suffix = input.mode === "preview" ? "preview" : "timelapse";

  return {
    blob: new Blob([input.mode], { type: "video/mp4" }),
    mimeType: "video/mp4",
    fileName: `source-${suffix}.mp4`,
    durationSeconds: input.samplingPlan.estimatedOutputDurationSeconds,
    frameCount: input.samplingPlan.frameCount,
    warnings: [],
  };
}

function createDeferred<T>(): {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason?: unknown) => void;
} {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });

  return { promise, resolve, reject };
}
