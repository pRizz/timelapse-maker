import { For, Show, createMemo, type JSX } from "solid-js";
import type { VideoMetadata } from "../lib/videoMetadata";
import { formatBytes, formatDuration, formatFps, formatResolution } from "../lib/formatters";
import styles from "./VideoUploader.module.css";

type VideoUploaderProps = {
  maybeMetadata: VideoMetadata | null;
  isLoading: boolean;
  maybeError: string | null;
  onFileSelected: (file: File) => void;
};

export function VideoUploader(props: VideoUploaderProps) {
  const handleDrop: JSX.EventHandler<HTMLLabelElement, DragEvent> = (event) => {
    event.preventDefault();
    const maybeFile = event.dataTransfer?.files.item(0) ?? null;

    if (maybeFile) {
      props.onFileSelected(maybeFile);
    }
  };

  const handleChange: JSX.EventHandler<HTMLInputElement, Event> = (event) => {
    const maybeFile = event.currentTarget.files?.item(0) ?? null;

    if (maybeFile) {
      props.onFileSelected(maybeFile);
      event.currentTarget.value = "";
    }
  };

  return (
    <section class={styles.panel} aria-labelledby="upload-title">
      <div class={styles.headingRow}>
        <div>
          <h2 id="upload-title">Source video</h2>
          <p>Your video stays on your device.</p>
        </div>
        <span class={styles.privacyBadge}>No upload</span>
      </div>

      <label
        class={styles.dropZone}
        onDragOver={(event) => event.preventDefault()}
        onDrop={handleDrop}
      >
        <input
          class={styles.fileInput}
          type="file"
          accept="video/mp4,video/quicktime,video/x-m4v,.mp4,.mov,.m4v"
          onChange={handleChange}
        />
        <span class={styles.dropTitle}>Drop an iPhone, MP4, or MOV video</span>
        <span class={styles.dropText}>or choose a file from this device</span>
      </label>

      {props.isLoading ? <p class={styles.loading}>Reading video metadata...</p> : null}
      {props.maybeError ? <p class={styles.error}>{props.maybeError}</p> : null}

      {props.maybeMetadata ? (
        <MetadataGrid metadata={props.maybeMetadata} />
      ) : null}
    </section>
  );
}

type MetadataRow = {
  label: string;
  value: string;
};

function MetadataGrid(props: { metadata: VideoMetadata }) {
  const rows = createMemo(() =>
    [
      maybeMetadataRow("Duration", maybeFormatDuration(props.metadata.durationSeconds)),
      maybeMetadataRow("Resolution", maybeFormatResolution(props.metadata.width, props.metadata.height)),
      maybeMetadataRow("Estimated FPS", maybeFormatFps(props.metadata.maybeEstimatedFps)),
      maybeMetadataRow("File size", maybeFormatBytes(props.metadata.fileSizeBytes)),
    ].filter((maybeRow): maybeRow is MetadataRow => maybeRow !== null),
  );

  return (
    <Show when={rows().length > 0}>
      <dl class={styles.metadataGrid} aria-label="Video metadata">
        <For each={rows()}>
          {(row) => (
            <div>
              <dt>{row.label}</dt>
              <dd>{row.value}</dd>
            </div>
          )}
        </For>
      </dl>
    </Show>
  );
}

function maybeMetadataRow(label: string, maybeValue: string | null): MetadataRow | null {
  if (!maybeValue) {
    return null;
  }

  return { label, value: maybeValue };
}

function maybeFormatBytes(bytes: number): string | null {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return null;
  }

  return formatBytes(bytes);
}

function maybeFormatDuration(seconds: number): string | null {
  if (!Number.isFinite(seconds) || seconds < 0) {
    return null;
  }

  return formatDuration(seconds);
}

function maybeFormatFps(maybeFps: number | null | undefined): string | null {
  if (!maybeFps || !Number.isFinite(maybeFps)) {
    return null;
  }

  return formatFps(maybeFps);
}

function maybeFormatResolution(width: number, height: number): string | null {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return null;
  }

  return formatResolution(width, height);
}
