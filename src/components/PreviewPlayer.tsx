import { Show } from "solid-js";
import type { RenderedVideo } from "../lib/renderedVideo";
import type { ProcessingProgress } from "../lib/processors/types";
import { formatDuration } from "../lib/formatters";
import styles from "./PreviewPlayer.module.css";

type PreviewPlayerProps = {
  maybePreview: RenderedVideo | null;
  isGeneratingPreview: boolean;
  maybeProgress: ProcessingProgress | null;
};

export function PreviewPlayer(props: PreviewPlayerProps) {
  return (
    <section class={styles.panel} aria-labelledby="preview-title">
      <div class={styles.heading}>
        <h2 id="preview-title">Preview</h2>
        <p>Preview uses a capped frame plan so large exports remain responsive.</p>
      </div>

      <Show when={props.isGeneratingPreview} fallback={<PreviewContent maybePreview={props.maybePreview} />}>
        <div class={styles.generatingState} role="status" aria-live="polite">
          <span class={styles.spinner} aria-hidden="true" />
          <strong>Preview is generating</strong>
          <p>{props.maybeProgress?.message ?? "Preparing render"}</p>
        </div>
      </Show>
    </section>
  );
}

function PreviewContent(props: { maybePreview: RenderedVideo | null }) {
  return (
    <Show
      when={props.maybePreview}
      fallback={<div class={styles.emptyState}>Generate a preview after choosing a source video.</div>}
    >
      {(preview) => (
        <div class={styles.playerWrap}>
          <video class={styles.video} src={preview().url} controls muted playsinline />
          <dl class={styles.previewMeta}>
            <div>
              <dt>Duration</dt>
              <dd>{formatDuration(preview().durationSeconds)}</dd>
            </div>
            <div>
              <dt>Frames</dt>
              <dd>{preview().frameCount.toLocaleString()}</dd>
            </div>
          </dl>
        </div>
      )}
    </Show>
  );
}
