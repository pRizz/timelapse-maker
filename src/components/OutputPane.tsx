import { For, Show } from "solid-js";
import type { RenderedVideo } from "../lib/renderedVideo";
import type { ProcessingProgress, ProcessorSupport } from "../lib/processors/types";
import { formatDuration } from "../lib/formatters";
import styles from "./OutputPane.module.css";

type OutputPaneProps = {
  maybeOutput: RenderedVideo | null;
  canProcess: boolean;
  errors: string[];
  warnings: string[];
  metadataWarnings: string[];
  processorSupport: ProcessorSupport | null;
  maybeProgress: ProcessingProgress | null;
  isExporting: boolean;
  isOutputStale: boolean;
  hasExportAttempted: boolean;
  onExport: () => void;
  onCancel: () => void;
  onOutputPaneReady?: (element: HTMLElement) => void;
};

export function OutputPane(props: OutputPaneProps) {
  const shouldShowExportAction = () =>
    props.canProcess && !props.isExporting && (!props.maybeOutput || props.isOutputStale);
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
    <section
      class={styles.panel}
      aria-labelledby="output-title"
      ref={(element) => props.onOutputPaneReady?.(element)}
    >
      <div class={styles.heading}>
        <h2 id="output-title">Output</h2>
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

      <OutputContent
        maybeOutput={props.maybeOutput}
        isExporting={props.isExporting}
        isOutputStale={props.isOutputStale}
      />

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

function OutputContent(props: {
  maybeOutput: RenderedVideo | null;
  isExporting: boolean;
  isOutputStale: boolean;
}) {
  return (
    <Show
      when={props.maybeOutput}
      fallback={
        <div class={styles.emptyState}>
          {props.isExporting
            ? "Output will appear here when export finishes."
            : "Drop a video to start the full export."}
        </div>
      }
    >
      {(output) => (
        <div class={styles.playerWrap}>
          <Show when={props.isOutputStale}>
            <div class={styles.staleNotice} role="status">
              Settings changed. Re-export to update this output.
            </div>
          </Show>
          <Show when={props.isExporting}>
            <div class={styles.updateNotice} role="status" aria-live="polite">
              Updating output.
            </div>
          </Show>
          <Show
            when={output().canPreview}
            fallback={
              <div class={styles.previewFallback} role="status">
                This browser cannot preview the finished MP4 here. Use Download to save the same
                output file.
              </div>
            }
          >
            <video class={styles.video} controls playsinline>
              <source src={output().url} type={output().mimeType} />
            </video>
          </Show>
          <dl class={styles.outputMeta}>
            <div>
              <dt>File</dt>
              <dd>{output().fileName}</dd>
            </div>
            <div>
              <dt>Duration</dt>
              <dd>{formatDuration(output().durationSeconds)}</dd>
            </div>
            <div>
              <dt>Frames</dt>
              <dd>{output().frameCount.toLocaleString()}</dd>
            </div>
            <div>
              <dt>Type</dt>
              <dd>{output().mimeType}</dd>
            </div>
          </dl>
          <a class={styles.downloadLink} href={output().url} download={output().fileName}>
            Download
          </a>
        </div>
      )}
    </Show>
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
