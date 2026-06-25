export type VideoMetadata = {
  fileName: string;
  fileType: string;
  fileSizeBytes: number;
  durationSeconds: number;
  width: number;
  height: number;
  maybeEstimatedFps: number | null;
  canPlayNatively: boolean;
  warnings: string[];
};

type NativeMetadata = {
  durationSeconds: number;
  width: number;
  height: number;
  canPlayNatively: boolean;
  maybeEstimatedFps: number | null;
};

const FPS_SAMPLE_LIMIT = 24;
const FPS_SAMPLE_TIMEOUT_MS = 1_250;

export async function loadVideoMetadata(
  file: File,
  signal?: AbortSignal,
): Promise<VideoMetadata> {
  const objectUrl = URL.createObjectURL(file);

  try {
    const nativeMetadata = await loadNativeMetadata(file, objectUrl, signal);
    const maybeMediabunnyFps = await maybeEstimateFpsWithMediabunny(file);

    return {
      fileName: file.name,
      fileType: file.type || "Unknown",
      fileSizeBytes: file.size,
      durationSeconds: nativeMetadata.durationSeconds,
      width: nativeMetadata.width,
      height: nativeMetadata.height,
      maybeEstimatedFps: maybeMediabunnyFps ?? nativeMetadata.maybeEstimatedFps,
      canPlayNatively: nativeMetadata.canPlayNatively,
      warnings: buildMetadataWarnings(file, nativeMetadata),
    };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

async function loadNativeMetadata(
  file: File,
  objectUrl: string,
  signal?: AbortSignal,
): Promise<NativeMetadata> {
  const video = document.createElement("video");
  video.preload = "metadata";
  video.muted = true;
  video.playsInline = true;

  const canPlayNatively = Boolean(file.type && video.canPlayType(file.type));
  const metadataLoaded = new Promise<NativeMetadata>((resolve, reject) => {
    const cleanup = () => {
      video.removeEventListener("loadedmetadata", onLoadedMetadata);
      video.removeEventListener("error", onError);
      signal?.removeEventListener("abort", onAbort);
    };

    const onLoadedMetadata = () => {
      cleanup();
      resolve({
        durationSeconds: video.duration,
        width: video.videoWidth,
        height: video.videoHeight,
        canPlayNatively,
        maybeEstimatedFps: null,
      });
    };

    const onError = () => {
      cleanup();
      reject(new Error("The browser could not read this video's metadata."));
    };

    const onAbort = () => {
      cleanup();
      reject(new DOMException("Metadata loading was canceled.", "AbortError"));
    };

    video.addEventListener("loadedmetadata", onLoadedMetadata, { once: true });
    video.addEventListener("error", onError, { once: true });
    signal?.addEventListener("abort", onAbort, { once: true });
  });

  video.src = objectUrl;
  const nativeMetadata = await metadataLoaded;
  const maybeEstimatedFps = await maybeEstimateFpsWithVideoElement(video, signal);

  return {
    ...nativeMetadata,
    maybeEstimatedFps,
  };
}

async function maybeEstimateFpsWithMediabunny(file: File): Promise<number | null> {
  try {
    const { ALL_FORMATS, BlobSource, Input } = await import("mediabunny");
    const input = new Input({
      source: new BlobSource(file),
      formats: ALL_FORMATS,
    });
    const maybeVideoTrack = await input.getPrimaryVideoTrack();

    if (!maybeVideoTrack) {
      return null;
    }

    const packetStats = await maybeVideoTrack.computePacketStats(120, {
      skipLiveWait: true,
    });

    if (!packetStats.averagePacketRate || packetStats.averagePacketRate <= 0) {
      return null;
    }

    return packetStats.averagePacketRate;
  } catch {
    return null;
  }
}

async function maybeEstimateFpsWithVideoElement(
  video: HTMLVideoElement,
  signal?: AbortSignal,
): Promise<number | null> {
  if (!("requestVideoFrameCallback" in video)) {
    return null;
  }

  try {
    await video.play();
  } catch {
    return null;
  }

  return await new Promise<number | null>((resolve) => {
    let frameCount = 0;
    let maybeStartMediaTime: number | null = null;
    let maybeEndMediaTime: number | null = null;
    let resolved = false;

    const finish = () => {
      if (resolved) {
        return;
      }

      resolved = true;
      video.pause();
      signal?.removeEventListener("abort", onAbort);
      window.clearTimeout(timeoutId);

      if (maybeStartMediaTime === null || maybeEndMediaTime === null) {
        resolve(null);
        return;
      }

      const elapsed = maybeEndMediaTime - maybeStartMediaTime;
      if (elapsed <= 0 || frameCount < 2) {
        resolve(null);
        return;
      }

      resolve((frameCount - 1) / elapsed);
    };

    const onAbort = () => {
      finish();
    };

    const timeoutId = window.setTimeout(finish, FPS_SAMPLE_TIMEOUT_MS);

    const onFrame: VideoFrameRequestCallback = (_now, metadata) => {
      if (resolved) {
        return;
      }

      maybeStartMediaTime ??= metadata.mediaTime;
      maybeEndMediaTime = metadata.mediaTime;
      frameCount += 1;

      if (frameCount >= FPS_SAMPLE_LIMIT) {
        finish();
        return;
      }

      video.requestVideoFrameCallback(onFrame);
    };

    signal?.addEventListener("abort", onAbort, { once: true });
    video.requestVideoFrameCallback(onFrame);
  });
}

function buildMetadataWarnings(file: File, metadata: NativeMetadata): string[] {
  const warnings: string[] = [];
  const lowerName = file.name.toLowerCase();
  const isLikelyMov = lowerName.endsWith(".mov") || file.type.includes("quicktime");

  if (!metadata.canPlayNatively) {
    warnings.push("This browser does not report native support for the file type.");
  }

  if (isLikelyMov) {
    warnings.push("MOV and iPhone HEVC videos depend heavily on browser and OS codec support.");
  }

  if (!metadata.maybeEstimatedFps) {
    warnings.push("Exact FPS could not be estimated; frame-based sampling may be approximate.");
  }

  return warnings;
}
