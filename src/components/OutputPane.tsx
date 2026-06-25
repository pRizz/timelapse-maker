import { For, Show } from "solid-js";
import type { RenderedVideo } from "../lib/renderedVideo";
import type { ProcessingProgress } from "../lib/processors/types";
import { formatDuration } from "../lib/formatters";
import styles from "./OutputPane.module.css";

type OutputPaneProps = {
  maybeOutput: RenderedVideo | null;
  isExporting: boolean;
  isOutputStale: boolean;
  maybeProgress: ProcessingProgress | null;
};

export function OutputPane(props: OutputPaneProps) {
  return (
    <section class={styles.panel} aria-labelledby="output-title">
      <div class={styles.heading}>
        <h2 id="output-title">Output</h2>
        <p>Final exported timelapse.</p>
      </div>

      <Show
        when={props.isExporting && !props.maybeOutput}
        fallback={
          <OutputContent
            maybeOutput={props.maybeOutput}
            isExporting={props.isExporting}
            isOutputStale={props.isOutputStale}
            maybeProgress={props.maybeProgress}
          />
        }
      >
        <div class={styles.generatingState} role="status" aria-live="polite">
          <span class={styles.spinner} aria-hidden="true" />
          <strong>Export in progress</strong>
          <p>{props.maybeProgress?.message ?? "Preparing render"}</p>
        </div>
      </Show>
    </section>
  );
}

function OutputContent(props: {
  maybeOutput: RenderedVideo | null;
  isExporting: boolean;
  isOutputStale: boolean;
  maybeProgress: ProcessingProgress | null;
}) {
  return (
    <Show
      when={props.maybeOutput}
      fallback={<div class={styles.emptyState}>Drop a video to start the full export.</div>}
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
              Updating output: {props.maybeProgress?.message ?? "Preparing render"}
            </div>
          </Show>
          <video class={styles.video} src={output().url} controls playsinline />
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
          <Show when={output().warnings.length > 0}>
            <div class={styles.warningList}>
              <strong>Warnings</strong>
              <ul>
                <For each={Array.from(new Set(output().warnings))}>{(warning) => <li>{warning}</li>}</For>
              </ul>
            </div>
          </Show>
        </div>
      )}
    </Show>
  );
}
