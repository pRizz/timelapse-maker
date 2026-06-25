import type { JSX } from "solid-js";
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
        <dl class={styles.metadataGrid} aria-label="Video metadata">
          <div>
            <dt>Duration</dt>
            <dd>{formatDuration(props.maybeMetadata.durationSeconds)}</dd>
          </div>
          <div>
            <dt>Resolution</dt>
            <dd>{formatResolution(props.maybeMetadata.width, props.maybeMetadata.height)}</dd>
          </div>
          <div>
            <dt>Estimated FPS</dt>
            <dd>{formatFps(props.maybeMetadata.maybeEstimatedFps)}</dd>
          </div>
          <div>
            <dt>File size</dt>
            <dd>{formatBytes(props.maybeMetadata.fileSizeBytes)}</dd>
          </div>
        </dl>
      ) : null}
    </section>
  );
}
