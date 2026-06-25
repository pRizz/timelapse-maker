import { For, Show } from "solid-js";
import type { ProcessingProgress, ProcessorSupport } from "../lib/processors/types";
import styles from "./ExportPanel.module.css";

type ExportPanelProps = {
  canProcess: boolean;
  errors: string[];
  warnings: string[];
  metadataWarnings: string[];
  processorSupport: ProcessorSupport | null;
  maybeProgress: ProcessingProgress | null;
  isExporting: boolean;
  hasOutput: boolean;
  isOutputStale: boolean;
  hasExportAttempted: boolean;
  onExport: () => void;
  onCancel: () => void;
};

export function ExportPanel(props: ExportPanelProps) {
  const shouldShowExportAction = () =>
    props.canProcess && !props.isExporting && (!props.hasOutput || props.isOutputStale);
  const exportActionLabel = () => {
    if (props.isOutputStale) {
      return "Re-export";
    }

    if (props.hasExportAttempted) {
      return "Retry export";
    }

    return "Export video";
  };
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
        <Show when={shouldShowExportAction()}>
          <button class={styles.primaryButton} type="button" onClick={props.onExport}>
            {exportActionLabel()}
          </button>
        </Show>
        <Show when={props.isExporting}>
          <button type="button" onClick={props.onCancel}>
            Cancel
          </button>
        </Show>
      </div>

      <Show when={props.maybeProgress}>
        <div class={styles.progressBlock} role="status" aria-live="polite">
          <div class={styles.progressHeader}>
            <span>Export in progress</span>
            <span>{progressPercent()}%</span>
          </div>
          <progress value={progressPercent()} max={100} />
          <p>{props.maybeProgress?.message}</p>
        </div>
      </Show>

      <MessageList
        title="Errors"
        messages={[...(props.processorSupport?.errors ?? []), ...props.errors]}
        tone="error"
      />
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
