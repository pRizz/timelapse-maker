import { For, Show } from "solid-js";
import type { RenderedVideo } from "../lib/renderedVideo";
import type { ProcessingMode, ProcessingProgress, ProcessorSupport } from "../lib/processors/types";
import { formatDuration } from "../lib/formatters";
import styles from "./ExportPanel.module.css";

type ExportPanelProps = {
  canProcess: boolean;
  errors: string[];
  warnings: string[];
  metadataWarnings: string[];
  processorSupport: ProcessorSupport | null;
  maybeProgress: ProcessingProgress | null;
  maybeProcessingMode: ProcessingMode | null;
  maybeExport: RenderedVideo | null;
  onPreview: () => void;
  onExport: () => void;
  onCancel: () => void;
};

export function ExportPanel(props: ExportPanelProps) {
  const isProcessing = () => props.maybeProcessingMode !== null;
  const progressPercent = () =>
    props.maybeProgress && props.maybeProgress.totalFrames > 0
      ? Math.round((props.maybeProgress.completedFrames / props.maybeProgress.totalFrames) * 100)
      : 0;

  return (
    <section class={styles.panel} aria-labelledby="export-title">
      <div class={styles.heading}>
        <h2 id="export-title">Export</h2>
        <p>
          Processor:{" "}
          <strong>{props.processorSupport?.available ? props.processorSupport.label : "Unavailable"}</strong>
        </p>
      </div>

      <div class={styles.actions}>
        <button type="button" onClick={props.onPreview} disabled={!props.canProcess || isProcessing()}>
          Generate preview
        </button>
        <button
          class={styles.primaryButton}
          type="button"
          onClick={props.onExport}
          disabled={!props.canProcess || isProcessing()}
        >
          Export video
        </button>
        <Show when={isProcessing()}>
          <button type="button" onClick={props.onCancel}>
            Cancel
          </button>
        </Show>
      </div>

      <Show when={props.maybeProgress}>
        <div class={styles.progressBlock} role="status" aria-live="polite">
          <div class={styles.progressHeader}>
            <span>{props.maybeProcessingMode === "preview" ? "Preview" : "Export"} in progress</span>
            <span>{progressPercent()}%</span>
          </div>
          <progress value={progressPercent()} max={100} />
          <p>{props.maybeProgress?.message}</p>
        </div>
      </Show>

      <Show when={props.maybeExport}>
        {(exportedVideo) => (
        <div class={styles.downloadPanel}>
          <div>
            <strong>{exportedVideo().fileName}</strong>
            <p>
              {exportedVideo().mimeType} - {formatDuration(exportedVideo().durationSeconds)} -{" "}
              {exportedVideo().frameCount.toLocaleString()} frames
            </p>
          </div>
          <a href={exportedVideo().url} download={exportedVideo().fileName}>
            Download
          </a>
        </div>
        )}
      </Show>

      <MessageList title="Errors" messages={props.errors} tone="error" />
      <MessageList
        title="Warnings"
        messages={[
          ...props.metadataWarnings,
          ...(props.processorSupport?.warnings ?? []),
          ...props.warnings,
        ]}
        tone="warning"
      />
    </section>
  );
}

function MessageList(props: {
  title: string;
  messages: string[];
  tone: "error" | "warning";
}) {
  if (props.messages.length === 0) {
    return null;
  }

  return (
    <div class={props.tone === "error" ? styles.errorList : styles.warningList}>
      <strong>{props.title}</strong>
      <ul>
        <For each={Array.from(new Set(props.messages))}>{(message) => <li>{message}</li>}</For>
      </ul>
    </div>
  );
}
