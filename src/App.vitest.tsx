import { cleanup, fireEvent, render, waitFor } from "@solidjs/testing-library";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import type { ProcessorSelection, ProcessInput, ProcessResult } from "./lib/processors/types";
import { formatProcessingFrameMessage } from "./lib/processors/processingUtils";
import type { VideoMetadata } from "./lib/videoMetadata";

const mocks = vi.hoisted(() => ({
  loadVideoMetadata: vi.fn(),
  probeVideoUrlPreviewability: vi.fn(),
  process: vi.fn(),
  selectProcessor: vi.fn(),
}));

const originalScrollIntoViewDescriptor = Object.getOwnPropertyDescriptor(
  HTMLElement.prototype,
  "scrollIntoView",
);

vi.mock("./lib/videoMetadata", () => ({
  loadVideoMetadata: mocks.loadVideoMetadata,
}));

vi.mock("./lib/processors/outputCompatibility", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./lib/processors/outputCompatibility")>();

  return {
    ...actual,
    probeVideoUrlPreviewability: mocks.probeVideoUrlPreviewability,
  };
});

vi.mock("./lib/processors/selectProcessor", () => ({
  selectProcessor: mocks.selectProcessor,
  toValidationCapabilities: (selection: ProcessorSelection) => ({
    hasUsableProcessor: selection.processor !== null,
    supportsExactFrameSampling: selection.support.supportsExactFrameSampling,
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
    outputFormatProfile: "mp4-h264-native",
    warnings: [],
    errors: [],
  },
};

beforeEach(() => {
  mocks.loadVideoMetadata.mockResolvedValue(baseMetadata);
  mocks.probeVideoUrlPreviewability.mockResolvedValue(true);
  mocks.selectProcessor.mockResolvedValue(processorSelection);
  mocks.process.mockImplementation(async (input: ProcessInput) => buildProcessResult(input));

  Object.defineProperty(URL, "createObjectURL", {
    configurable: true,
    value: vi.fn(() => "blob:output"),
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
  vi.unstubAllGlobals();
  restoreScrollIntoView();
});

describe("App", () => {
  it("renders the utility with an output pane before upload", () => {
    // Arrange
    const { baseElement, getByRole, queryByRole } = render(() => <App />);

    // Act
    const text = baseElement.textContent ?? "";
    const buttons = Array.from(baseElement.querySelectorAll("button"));
    const maybeExportAction = buttons.find((button) =>
      /export video|retry export|re-export/i.test(button.textContent ?? ""),
    );
    const maybeCommitLink = Array.from(baseElement.querySelectorAll("a")).find((link) =>
      link.getAttribute("href")?.includes("/commit/"),
    );

    // Assert
    expect(text).toContain("Timelapse Maker");
    expect(text).toContain("Your video stays on your device");
    expect(text).toContain("Output");
    expect(text).toContain("Choose a video to get started.");
    expect(text).toContain("Choose a video to enable timelapse settings.");
    expect(text).not.toContain("Preview");
    expect(text).not.toContain("Generate preview");
    expect(text).not.toContain("Processor: Unavailable");
    expect(text).not.toContain("Client-side video utility");
    expect(text).not.toContain("Copy build info");
    expect(getByRole("heading", { name: "Output" })).toBeInTheDocument();
    expect(queryByRole("heading", { name: "Export" })).not.toBeInTheDocument();
    expect(maybeCommitLink?.textContent).toMatch(/^[0-9a-f]{7}$/i);
    expect(maybeCommitLink?.getAttribute("href")).toMatch(
      /^https:\/\/github\.com\/pRizz\/timelapse-maker\/commit\/[0-9a-f]{40}$/i,
    );
    expect(maybeExportAction).toBeUndefined();
  });

  it("automatically exports the full output after dropping a source video", async () => {
    // Arrange
    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => undefined);
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
    expect(processInput.mode).toBe("export");
    expect(processInput.settings.speedMultiplier).toBe(30);
    expect(processInput.settings.outputFps).toBe(60);
    expect(processInput.samplingPlan.frameCount).toBe(1200);
    expect(processInput.samplingPlan.estimatedOutputDurationSeconds).toBe(20);
    expect(processInput.samplingPlan.outputFrameDurationSeconds).toBeCloseTo(1 / 60);
    expect(processInput.samplingPlan.isCapped).toBe(false);
    await waitFor(() =>
      expect(baseElement.querySelector("source")?.getAttribute("src")).toBe("blob:output"),
    );
    expect(mocks.probeVideoUrlPreviewability).toHaveBeenCalledWith(
      "blob:output",
      "video/mp4",
      expect.any(AbortSignal),
    );
    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(baseElement.querySelector('a[download="source-timelapse.mp4"]')).not.toBeNull();
    expect(baseElement.textContent ?? "").not.toContain("Preview");
    expect(baseElement.textContent ?? "").not.toContain("Generate preview");
  });

  it("shows export progress while automatic export is pending", async () => {
    // Arrange
    const file = new File(["video"], "source.mp4", { type: "video/mp4" });
    const deferred = createDeferred<void>();
    mocks.process.mockImplementationOnce((input: ProcessInput) => {
      input.onProgress({
        stage: "encoding",
        completedFrames: 12,
        totalFrames: input.samplingPlan.frameCount,
        message: formatProcessingFrameMessage(12, input.samplingPlan.frameCount),
      });

      return deferred.promise.then(() => buildProcessResult(input));
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
    expect(getByText("Export in progress")).toBeInTheDocument();
    expect(getByText("Processing frame 12 / 240")).toBeInTheDocument();
    deferred.resolve();
    await waitFor(() =>
      expect(baseElement.querySelector("source")?.getAttribute("src")).toBe("blob:output"),
    );
  });

  it("smoothly scrolls to the output pane when automatic export starts on mobile", async () => {
    // Arrange
    const file = new File(["video"], "source.mp4", { type: "video/mp4" });
    const deferred = createDeferred<void>();
    const scrollIntoView = mockScrollIntoView();
    mockAnimationFrame();
    mockMediaQueries({ isMobileOutputLayout: true, prefersReducedMotion: false });
    mocks.process.mockImplementationOnce((input: ProcessInput) =>
      deferred.promise.then(() => buildProcessResult(input)),
    );
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
    await waitFor(() =>
      expect(scrollIntoView).toHaveBeenCalledWith({
        behavior: "smooth",
        block: "start",
        inline: "nearest",
      }),
    );
    deferred.resolve();
    await waitFor(() =>
      expect(baseElement.querySelector("source")?.getAttribute("src")).toBe("blob:output"),
    );
  });

  it("does not scroll when automatic export starts outside the mobile layout", async () => {
    // Arrange
    const file = new File(["video"], "source.mp4", { type: "video/mp4" });
    const deferred = createDeferred<void>();
    const scrollIntoView = mockScrollIntoView();
    mockAnimationFrame();
    mockMediaQueries({ isMobileOutputLayout: false, prefersReducedMotion: false });
    mocks.process.mockImplementationOnce((input: ProcessInput) =>
      deferred.promise.then(() => buildProcessResult(input)),
    );
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
    expect(scrollIntoView).not.toHaveBeenCalled();
    deferred.resolve();
    await waitFor(() =>
      expect(baseElement.querySelector("source")?.getAttribute("src")).toBe("blob:output"),
    );
  });

  it("uses instant output-pane scrolling when reduced motion is preferred", async () => {
    // Arrange
    const file = new File(["video"], "source.mp4", { type: "video/mp4" });
    const deferred = createDeferred<void>();
    const scrollIntoView = mockScrollIntoView();
    mockAnimationFrame();
    mockMediaQueries({ isMobileOutputLayout: true, prefersReducedMotion: true });
    mocks.process.mockImplementationOnce((input: ProcessInput) =>
      deferred.promise.then(() => buildProcessResult(input)),
    );
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
    await waitFor(() =>
      expect(scrollIntoView).toHaveBeenCalledWith({
        behavior: "auto",
        block: "start",
        inline: "nearest",
      }),
    );
    deferred.resolve();
    await waitFor(() =>
      expect(baseElement.querySelector("source")?.getAttribute("src")).toBe("blob:output"),
    );
  });

  it("marks output stale after settings change and waits for manual re-export", async () => {
    // Arrange
    const file = new File(["video"], "source.mp4", { type: "video/mp4" });
    const { baseElement, getByRole, getByText, queryByText } = render(() => <App />);
    const dropZone = getByText("Drop an iPhone, MP4, or MOV video").closest("label");

    fireEvent.drop(dropZone!, {
      dataTransfer: {
        files: {
          item: (index: number) => (index === 0 ? file : null),
        },
      },
    });
    await waitFor(() => expect(mocks.process).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(baseElement.querySelector("source")?.getAttribute("src")).toBe("blob:output"),
    );

    // Act
    fireEvent.click(getByRole("button", { name: "10x" }));

    // Assert
    expect(mocks.process).toHaveBeenCalledTimes(1);
    expect(getByText("Settings changed. Re-export to update this output.")).toBeInTheDocument();

    // Act
    fireEvent.click(getByRole("button", { name: "Re-export" }));

    // Assert
    await waitFor(() => expect(mocks.process).toHaveBeenCalledTimes(2));
    const processInput = mocks.process.mock.calls[1][0] as ProcessInput;
    expect(processInput.mode).toBe("export");
    expect(processInput.settings.speedMultiplier).toBe(10);
    await waitFor(() =>
      expect(queryByText("Settings changed. Re-export to update this output.")).not.toBeInTheDocument(),
    );
  });

  it("shows a retry action after canceling an automatic export", async () => {
    // Arrange
    const file = new File(["video"], "source.mp4", { type: "video/mp4" });
    mocks.process
      .mockImplementationOnce((input: ProcessInput) => {
        input.onProgress({
          stage: "encoding",
          completedFrames: 12,
          totalFrames: input.samplingPlan.frameCount,
          message: formatProcessingFrameMessage(12, input.samplingPlan.frameCount),
        });

        return new Promise<ProcessResult>((_resolve, reject) => {
          input.signal.addEventListener(
            "abort",
            () => reject(new DOMException("Processing was canceled.", "AbortError")),
            { once: true },
          );
        });
      })
      .mockImplementationOnce(async (input: ProcessInput) => buildProcessResult(input));
    const { baseElement, getByRole, getByText } = render(() => <App />);
    const dropZone = getByText("Drop an iPhone, MP4, or MOV video").closest("label");

    fireEvent.drop(dropZone!, {
      dataTransfer: {
        files: {
          item: (index: number) => (index === 0 ? file : null),
        },
      },
    });
    await waitFor(() => expect(mocks.process).toHaveBeenCalledTimes(1));

    // Act
    fireEvent.click(getByRole("button", { name: "Cancel" }));

    // Assert
    await waitFor(() => expect(getByRole("button", { name: "Retry export" })).toBeInTheDocument());

    // Act
    fireEvent.click(getByRole("button", { name: "Retry export" }));

    // Assert
    await waitFor(() => expect(mocks.process).toHaveBeenCalledTimes(2));
    await waitFor(() =>
      expect(baseElement.querySelector("source")?.getAttribute("src")).toBe("blob:output"),
    );
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

function mockScrollIntoView() {
  const scrollIntoView = vi.fn();

  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
    configurable: true,
    value: scrollIntoView,
  });

  return scrollIntoView;
}

function restoreScrollIntoView(): void {
  if (originalScrollIntoViewDescriptor) {
    Object.defineProperty(
      HTMLElement.prototype,
      "scrollIntoView",
      originalScrollIntoViewDescriptor,
    );
    return;
  }

  delete (HTMLElement.prototype as { scrollIntoView?: Element["scrollIntoView"] })
    .scrollIntoView;
}

function mockAnimationFrame(): void {
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    callback(0);
    return 1;
  });
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
}

function mockMediaQueries(options: {
  isMobileOutputLayout: boolean;
  prefersReducedMotion: boolean;
}): void {
  vi.stubGlobal("matchMedia", (query: string) => {
    const matches =
      (query === "(max-width: 980px)" && options.isMobileOutputLayout) ||
      (query === "(prefers-reduced-motion: reduce)" && options.prefersReducedMotion);

    return {
      matches,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    } as MediaQueryList;
  });
}
