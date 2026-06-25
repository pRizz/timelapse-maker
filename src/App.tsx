import { createEffect, createMemo, createSignal, onCleanup } from "solid-js";
import { BuildInfo } from "./components/BuildInfo";
import { ExportPanel } from "./components/ExportPanel";
import { PreviewPlayer } from "./components/PreviewPlayer";
import { SettingsPanel } from "./components/SettingsPanel";
import { VideoUploader } from "./components/VideoUploader";
import type { RenderedVideo } from "./lib/renderedVideo";
import type { ProcessingMode, ProcessingProgress, ProcessResult } from "./lib/processors/types";
import { selectProcessor, toValidationCapabilities } from "./lib/processors/selectProcessor";
import type { ProcessorSelection } from "./lib/processors/types";
import {
  buildSamplingPlan,
  createDefaultSettings,
  validateSettings,
  type TimelapseSettings,
} from "./lib/timelapseSettings";
import { loadVideoMetadata, type VideoMetadata } from "./lib/videoMetadata";
import styles from "./App.module.css";

const PREVIEW_MAX_FRAMES = 240;
const PREVIEW_FRAME_BUDGET_SECONDS = 8;

export default function App() {
  const [maybeFile, setMaybeFile] = createSignal<File | null>(null);
  const [maybeMetadata, setMaybeMetadata] = createSignal<VideoMetadata | null>(null);
  const [settings, setSettings] = createSignal<TimelapseSettings>(createDefaultSettings());
  const [maybeSelection, setMaybeSelection] = createSignal<ProcessorSelection | null>(null);
  const [isLoadingMetadata, setIsLoadingMetadata] = createSignal(false);
  const [maybeError, setMaybeError] = createSignal<string | null>(null);
  const [maybePreview, setMaybePreview] = createSignal<RenderedVideo | null>(null);
  const [maybeExport, setMaybeExport] = createSignal<RenderedVideo | null>(null);
  const [maybeProgress, setMaybeProgress] = createSignal<ProcessingProgress | null>(null);
  const [maybeProcessingMode, setMaybeProcessingMode] = createSignal<ProcessingMode | null>(null);
  const [maybePendingAutoPreviewFile, setMaybePendingAutoPreviewFile] = createSignal<File | null>(
    null,
  );
  let maybeAbortController: AbortController | null = null;

  createEffect(() => {
    const metadata = maybeMetadata();
    const currentSettings = settings();

    if (!metadata) {
      setMaybeSelection(null);
      return;
    }

    let isCurrent = true;

    selectProcessor(metadata, currentSettings)
      .then((selection) => {
        if (isCurrent) {
          setMaybeSelection(selection);
        }
      })
      .catch((error: unknown) => {
        if (isCurrent) {
          setMaybeSelection(null);
          setMaybeError(error instanceof Error ? error.message : "Browser support detection failed.");
        }
      });

    onCleanup(() => {
      isCurrent = false;
    });
  });

  onCleanup(() => {
    maybeAbortController?.abort();
    revokeRenderedVideo(maybePreview());
    revokeRenderedVideo(maybeExport());
  });

  const validation = createMemo(() => {
    const metadata = maybeMetadata();
    const selection = maybeSelection();

    if (!metadata) {
      return { errors: [], warnings: [] };
    }

    return validateSettings(
      metadata,
      settings(),
      selection ? toValidationCapabilities(selection) : null,
    );
  });

  const canProcess = createMemo(() => {
    const selection = maybeSelection();

    return (
      Boolean(maybeFile()) &&
      Boolean(maybeMetadata()) &&
      Boolean(selection?.processor) &&
      validation().errors.length === 0 &&
      maybeProcessingMode() === null
    );
  });

  const handleFileSelected = async (file: File) => {
    maybeAbortController?.abort();
    const abortController = new AbortController();
    maybeAbortController = abortController;

    clearRenderedVideos();
    setMaybeFile(file);
    setMaybePendingAutoPreviewFile(file);
    setMaybeMetadata(null);
    setMaybeSelection(null);
    setMaybeError(null);
    setIsLoadingMetadata(true);

    try {
      const metadata = await loadVideoMetadata(file, abortController.signal);
      if (abortController.signal.aborted) {
        return;
      }

      setMaybeMetadata(metadata);
      setSettings(createDefaultSettings(metadata));
    } catch (error) {
      if (isAbortError(error)) {
        return;
      }

      setMaybePendingAutoPreviewFile(null);
      setMaybeError(error instanceof Error ? error.message : "Could not read the selected video.");
    } finally {
      if (maybeAbortController === abortController) {
        maybeAbortController = null;
        setIsLoadingMetadata(false);
      }
    }
  };

  const handleSettingsChange = (nextSettings: TimelapseSettings) => {
    clearRenderedVideos();
    setSettings(nextSettings);
  };

  const handleProcess = async (mode: ProcessingMode, expectedFile?: File) => {
    const file = maybeFile();
    const metadata = maybeMetadata();
    const selection = maybeSelection();
    const currentSettings = settings();

    if (!file || (expectedFile && file !== expectedFile) || !metadata || !selection?.processor) {
      return;
    }

    const abortController = new AbortController();
    maybeAbortController = abortController;
    setMaybeProcessingMode(mode);
    setMaybeProgress({
      stage: "preparing",
      completedFrames: 0,
      totalFrames: 0,
      message: "Preparing render",
    });
    setMaybeError(null);

    const samplingPlan = buildSamplingPlan(
      metadata,
      currentSettings,
      mode === "preview" ? buildPreviewSamplingOptions(currentSettings) : {},
    );

    try {
      const result = await selection.processor.process({
        file,
        metadata,
        settings: currentSettings,
        samplingPlan,
        mode,
        signal: abortController.signal,
        onProgress: setMaybeProgress,
      });
      const renderedVideo = toRenderedVideo(result);

      if (mode === "preview") {
        revokeRenderedVideo(maybePreview());
        setMaybePreview(renderedVideo);
      } else {
        revokeRenderedVideo(maybeExport());
        setMaybeExport(renderedVideo);
        downloadRenderedVideo(renderedVideo);
      }
    } catch (error) {
      if (!isAbortError(error)) {
        setMaybeError(error instanceof Error ? error.message : "Processing failed.");
      }
    } finally {
      if (maybeAbortController === abortController) {
        maybeAbortController = null;
      }
      setMaybeProgress(null);
      setMaybeProcessingMode(null);
    }
  };

  const handleCancel = () => {
    maybeAbortController?.abort();
  };

  createEffect(() => {
    const pendingFile = maybePendingAutoPreviewFile();

    if (!pendingFile) {
      return;
    }

    if (maybeFile() !== pendingFile) {
      setMaybePendingAutoPreviewFile(null);
      return;
    }

    if (maybeError()) {
      setMaybePendingAutoPreviewFile(null);
      return;
    }

    const metadata = maybeMetadata();
    const selection = maybeSelection();

    if (!metadata || !selection || maybeProcessingMode() !== null) {
      return;
    }

    if (!selection.processor || validation().errors.length > 0) {
      setMaybePendingAutoPreviewFile(null);
      return;
    }

    setMaybePendingAutoPreviewFile(null);
    void handleProcess("preview", pendingFile);
  });

  const clearRenderedVideos = () => {
    revokeRenderedVideo(maybePreview());
    revokeRenderedVideo(maybeExport());
    setMaybePreview(null);
    setMaybeExport(null);
  };

  return (
    <div class={styles.appShell}>
      <header class={styles.header}>
        <div>
          <h1>Timelapse Maker</h1>
          <p>
            Convert local iPhone, MP4, and MOV videos into downloadable timelapses
            without sending files anywhere.
          </p>
        </div>
        <div class={styles.privacyCallout}>Your video stays on your device.</div>
      </header>

      <main class={styles.mainGrid}>
        <div class={styles.primaryColumn}>
          <VideoUploader
            maybeMetadata={maybeMetadata()}
            isLoading={isLoadingMetadata()}
            maybeError={maybeError()}
            onFileSelected={handleFileSelected}
          />
          <PreviewPlayer
            maybePreview={maybePreview()}
            isGeneratingPreview={maybeProcessingMode() === "preview"}
            maybeProgress={maybeProcessingMode() === "preview" ? maybeProgress() : null}
          />
        </div>

        <div class={styles.secondaryColumn}>
          <SettingsPanel
            maybeMetadata={maybeMetadata()}
            settings={settings()}
            supportsExactFrameSampling={maybeSelection()?.support.supportsExactFrameSampling ?? false}
            onSettingsChange={handleSettingsChange}
          />
          <ExportPanel
            canProcess={canProcess()}
            errors={validation().errors}
            warnings={validation().warnings}
            metadataWarnings={maybeMetadata()?.warnings ?? []}
            processorSupport={maybeSelection()?.support ?? null}
            maybeProgress={maybeProgress()}
            maybeProcessingMode={maybeProcessingMode()}
            maybeExport={maybeExport()}
            onPreview={() => void handleProcess("preview")}
            onExport={() => void handleProcess("export")}
            onCancel={handleCancel}
          />
        </div>
      </main>

      <BuildInfo />
    </div>
  );
}

function toRenderedVideo(result: ProcessResult): RenderedVideo {
  return {
    url: URL.createObjectURL(result.blob),
    fileName: result.fileName,
    mimeType: result.mimeType,
    durationSeconds: result.durationSeconds,
    frameCount: result.frameCount,
    warnings: result.warnings,
  };
}

function revokeRenderedVideo(maybeRenderedVideo: RenderedVideo | null): void {
  if (maybeRenderedVideo) {
    URL.revokeObjectURL(maybeRenderedVideo.url);
  }
}

function buildPreviewSamplingOptions(settings: TimelapseSettings): { maxFrameCount: number } {
  return {
    maxFrameCount: Math.min(
      PREVIEW_MAX_FRAMES,
      Math.floor(PREVIEW_FRAME_BUDGET_SECONDS * settings.outputFps),
    ),
  };
}

function downloadRenderedVideo(renderedVideo: RenderedVideo): void {
  const link = document.createElement("a");
  link.href = renderedVideo.url;
  link.download = renderedVideo.fileName;
  link.style.display = "none";

  document.body.append(link);
  link.click();
  link.remove();
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}
