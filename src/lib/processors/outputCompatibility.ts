import type { OutputFormatProfileId } from "./types";

export const H264_HIGH_CODEC_STRING = "avc1.640028";
export const H264_BASELINE_CODEC_STRING = "avc1.42E01E";
export const H264_HIGH_MP4_MIME_TYPE = `video/mp4;codecs="${H264_HIGH_CODEC_STRING}"`;
export const H264_BASELINE_MP4_MIME_TYPE = `video/mp4;codecs="${H264_BASELINE_CODEC_STRING}"`;
export const MP4_MIME_TYPE = "video/mp4";

const H264_MP4_PLAYBACK_MIME_TYPES = [
  H264_HIGH_MP4_MIME_TYPE,
  H264_BASELINE_MP4_MIME_TYPE,
  MP4_MIME_TYPE,
] as const;

const MEDIA_RECORDER_MP4_MIME_CANDIDATES = [
  H264_HIGH_MP4_MIME_TYPE,
  H264_BASELINE_MP4_MIME_TYPE,
  MP4_MIME_TYPE,
] as const;

const DEFAULT_VIDEO_PROBE_TIMEOUT_MS = 4_000;

export type OutputFormatProfile = {
  id: OutputFormatProfileId;
  mimeType: string | null;
  fileExtension: "mp4" | null;
  warnings: string[];
  errors: string[];
};

export type OutputFormatProfileInput = {
  canPreviewH264Mp4: boolean;
  canEncodeMp4WithWebCodecs: boolean;
  maybeMediaRecorderMp4MimeType: string | null;
  canUseFfmpegWasm: boolean;
};

export function chooseOutputFormatProfile(
  input: OutputFormatProfileInput,
): OutputFormatProfile {
  if (!input.canPreviewH264Mp4) {
    return {
      id: "unsupported",
      mimeType: null,
      fileExtension: null,
      warnings: [],
      errors: ["This browser cannot preview H.264 MP4 output."],
    };
  }

  if (input.canEncodeMp4WithWebCodecs || input.maybeMediaRecorderMp4MimeType) {
    return {
      id: "mp4-h264-native",
      mimeType: MP4_MIME_TYPE,
      fileExtension: "mp4",
      warnings: [],
      errors: [],
    };
  }

  if (input.canUseFfmpegWasm) {
    return {
      id: "mp4-h264-wasm",
      mimeType: MP4_MIME_TYPE,
      fileExtension: "mp4",
      warnings: [
        "Using the ffmpeg.wasm fallback. Export may be slower and use more memory, but the video stays on this device.",
      ],
      errors: [],
    };
  }

  return {
    id: "unsupported",
    mimeType: null,
    fileExtension: null,
    warnings: [],
    errors: ["This browser cannot encode previewable H.264 MP4 output."],
  };
}

export function canBrowserPreviewH264Mp4(): boolean {
  return H264_MP4_PLAYBACK_MIME_TYPES.some(canVideoElementPlayMimeType);
}

export function maybeFirstSupportedMediaRecorderMp4MimeType(): string | null {
  if (!("MediaRecorder" in globalThis)) {
    return null;
  }

  return (
    MEDIA_RECORDER_MP4_MIME_CANDIDATES.find((mimeType) =>
      MediaRecorder.isTypeSupported(mimeType),
    ) ?? null
  );
}

export function canUseFfmpegWasm(): boolean {
  return (
    "Worker" in globalThis &&
    "WebAssembly" in globalThis &&
    typeof URL.createObjectURL === "function"
  );
}

export async function probeVideoUrlPreviewability(
  url: string,
  mimeType: string,
  signal: AbortSignal,
  timeoutMs = DEFAULT_VIDEO_PROBE_TIMEOUT_MS,
): Promise<boolean> {
  assertNotAborted(signal);

  if (!canVideoElementPlayMimeType(mimeType)) {
    return false;
  }

  const video = document.createElement("video");
  video.preload = "metadata";
  video.muted = true;
  video.playsInline = true;

  return new Promise((resolve, reject) => {
    const timeoutId = window.setTimeout(() => {
      cleanup();
      resolve(false);
    }, timeoutMs);

    const cleanup = () => {
      window.clearTimeout(timeoutId);
      video.removeEventListener("loadedmetadata", onLoadedMetadata);
      video.removeEventListener("canplay", onCanPlay);
      video.removeEventListener("error", onError);
      signal.removeEventListener("abort", onAbort);
      video.removeAttribute("src");
      video.load();
    };

    const resolvePreviewable = () => {
      cleanup();
      resolve(true);
    };

    const onLoadedMetadata = () => resolvePreviewable();
    const onCanPlay = () => resolvePreviewable();
    const onError = () => {
      cleanup();
      resolve(false);
    };
    const onAbort = () => {
      cleanup();
      reject(new DOMException("Processing was canceled.", "AbortError"));
    };

    video.addEventListener("loadedmetadata", onLoadedMetadata, { once: true });
    video.addEventListener("canplay", onCanPlay, { once: true });
    video.addEventListener("error", onError, { once: true });
    signal.addEventListener("abort", onAbort, { once: true });
    video.src = url;
  });
}

export function canVideoElementPlayMimeType(mimeType: string): boolean {
  if (typeof document === "undefined") {
    return false;
  }

  const video = document.createElement("video");
  return video.canPlayType(mimeType) !== "";
}

function assertNotAborted(signal: AbortSignal): void {
  if (signal.aborted) {
    throw new DOMException("Processing was canceled.", "AbortError");
  }
}
