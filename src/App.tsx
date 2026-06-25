import { createEffect, createMemo, createSignal, onCleanup } from "solid-js";
import { BuildInfo } from "./components/BuildInfo";
import { ExportPanel } from "./components/ExportPanel";
import { OutputPane } from "./components/OutputPane";
import { SettingsPanel } from "./components/SettingsPanel";
import { VideoUploader } from "./components/VideoUploader";
import type { RenderedVideo } from "./lib/renderedVideo";
import type { ProcessingProgress, ProcessResult } from "./lib/processors/types";
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

export default function App() {
  const [maybeFile, setMaybeFile] = createSignal<File | null>(null);
  const [maybeMetadata, setMaybeMetadata] = createSignal<VideoMetadata | null>(null);
  const [settings, setSettings] = createSignal<TimelapseSettings>(createDefaultSettings());
  const [maybeSelection, setMaybeSelection] = createSignal<ProcessorSelection | null>(null);
  const [isLoadingMetadata, setIsLoadingMetadata] = createSignal(false);
  const [maybeSourceError, setMaybeSourceError] = createSignal<string | null>(null);
  const [maybeExportError, setMaybeExportError] = createSignal<string | null>(null);
  const [maybeOutput, setMaybeOutput] = createSignal<RenderedVideo | null>(null);
  const [maybeProgress, setMaybeProgress] = createSignal<ProcessingProgress | null>(null);
  const [isExporting, setIsExporting] = createSignal(false);
  const [hasExportAttempted, setHasExportAttempted] = createSignal(false);
  const [isOutputStale, setIsOutputStale] = createSignal(false);
  const [maybePendingAutoExportFile, setMaybePendingAutoExportFile] = createSignal<File | null>(
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
          setMaybeExportError(null);
        }
      })
      .catch((error: unknown) => {
        if (isCurrent) {
          setMaybeSelection(null);
          setMaybeExportError(
            error instanceof Error ? error.message : "Browser support detection failed.",
          );
        }
      });

    onCleanup(() => {
      isCurrent = false;
    });
  });

  onCleanup(() => {
    maybeAbortController?.abort();
    revokeRenderedVideo(maybeOutput());
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

  const exportErrors = createMemo(() => {
    const maybeError = maybeExportError();

    return maybeError ? [maybeError, ...validation().errors] : validation().errors;
  });

  const canProcess = createMemo(() => {
    const selection = maybeSelection();

    return (
      Boolean(maybeFile()) &&
      Boolean(maybeMetadata()) &&
      Boolean(selection?.processor) &&
      validation().errors.length === 0 &&
      !isExporting()
    );
  });

  const isExportWorkflowBusy = createMemo(
    () => isLoadingMetadata() || isExporting() || maybePendingAutoExportFile() !== null,
  );

  const handleFileSelected = async (file: File) => {
    maybeAbortController?.abort();
    const abortController = new AbortController();
    maybeAbortController = abortController;

    clearRenderedVideos();
    setMaybeFile(file);
    setMaybePendingAutoExportFile(file);
    setMaybeMetadata(null);
    setMaybeSelection(null);
    setMaybeSourceError(null);
    setMaybeExportError(null);
    setMaybeProgress(null);
    setIsExporting(false);
    setHasExportAttempted(false);
    setIsOutputStale(false);
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

      setMaybePendingAutoExportFile(null);
      setMaybeSourceError(
        error instanceof Error ? error.message : "Could not read the selected video.",
      );
    } finally {
      if (maybeAbortController === abortController) {
        maybeAbortController = null;
        setIsLoadingMetadata(false);
      }
    }
  };

  const handleSettingsChange = (nextSettings: TimelapseSettings) => {
    setSettings(nextSettings);
    setMaybeExportError(null);

    if (maybeOutput()) {
      setIsOutputStale(true);
    }
  };

  const handleExport = async (expectedFile?: File) => {
    const file = maybeFile();
    const metadata = maybeMetadata();
    const selection = maybeSelection();
    const currentSettings = settings();

    if (
      isExporting() ||
      !file ||
      (expectedFile && file !== expectedFile) ||
      !metadata ||
      !selection?.processor ||
      validation().errors.length > 0
    ) {
      return;
    }

    const abortController = new AbortController();
    maybeAbortController = abortController;
    setIsExporting(true);
    setHasExportAttempted(true);
    setMaybeProgress({
      stage: "preparing",
      completedFrames: 0,
      totalFrames: 0,
      message: "Preparing render",
    });
    setMaybeExportError(null);

    const samplingPlan = buildSamplingPlan(metadata, currentSettings);

    try {
      const result = await selection.processor.process({
        file,
        metadata,
        settings: currentSettings,
        samplingPlan,
        mode: "export",
        signal: abortController.signal,
        onProgress: setMaybeProgress,
      });
      const renderedVideo = toRenderedVideo(result);

      revokeRenderedVideo(maybeOutput());
      setMaybeOutput(renderedVideo);
      setIsOutputStale(false);
      downloadRenderedVideo(renderedVideo);
    } catch (error) {
      if (!isAbortError(error)) {
        setMaybeExportError(error instanceof Error ? error.message : "Processing failed.");
      }
    } finally {
      if (maybeAbortController === abortController) {
        maybeAbortController = null;
        setMaybeProgress(null);
        setIsExporting(false);
      }
    }
  };

  const handleCancel = () => {
    maybeAbortController?.abort();
  };

  createEffect(() => {
    const pendingFile = maybePendingAutoExportFile();

    if (!pendingFile) {
      return;
    }

    if (maybeFile() !== pendingFile) {
      setMaybePendingAutoExportFile(null);
      return;
    }

    if (maybeSourceError() || maybeExportError()) {
      setMaybePendingAutoExportFile(null);
      return;
    }

    const metadata = maybeMetadata();
    const selection = maybeSelection();

    if (!metadata || !selection || isExporting()) {
      return;
    }

    if (!selection.processor || validation().errors.length > 0) {
      setMaybePendingAutoExportFile(null);
      return;
    }

    setMaybePendingAutoExportFile(null);
    void handleExport(pendingFile);
  });

  const clearRenderedVideos = () => {
    revokeRenderedVideo(maybeOutput());
    setMaybeOutput(null);
    setIsOutputStale(false);
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
            maybeError={maybeSourceError()}
            onFileSelected={handleFileSelected}
          />
          <OutputPane
            maybeOutput={maybeOutput()}
            isExporting={isExporting()}
            isOutputStale={isOutputStale()}
            maybeProgress={maybeProgress()}
          />
        </div>

        <div class={styles.secondaryColumn}>
          <SettingsPanel
            maybeMetadata={maybeMetadata()}
            settings={settings()}
            isDisabled={isExportWorkflowBusy()}
            supportsExactFrameSampling={maybeSelection()?.support.supportsExactFrameSampling ?? false}
            onSettingsChange={handleSettingsChange}
          />
          <ExportPanel
            canProcess={canProcess()}
            errors={exportErrors()}
            warnings={[...validation().warnings, ...(maybeOutput()?.warnings ?? [])]}
            metadataWarnings={maybeMetadata()?.warnings ?? []}
            processorSupport={maybeSelection()?.support ?? null}
            maybeProgress={maybeProgress()}
            isExporting={isExporting()}
            hasOutput={maybeOutput() !== null}
            isOutputStale={isOutputStale()}
            hasExportAttempted={hasExportAttempted()}
            onExport={() => void handleExport()}
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
