import type { TimelapseSettings, ValidationCapabilities } from "../timelapseSettings";
import type { VideoMetadata } from "../videoMetadata";
import { mediaRecorderProcessor, maybeFirstSupportedMediaRecorderMimeType } from "./mediaRecorderProcessor";
import type { Processor, ProcessorSelection } from "./types";

export type BrowserProcessorCapabilities = {
  hasWebCodecs: boolean;
  canEncodeMp4WithWebCodecs: boolean;
  maybeMediaRecorderMimeType: string | null;
};

export function chooseProcessor(
  capabilities: BrowserProcessorCapabilities,
): ProcessorSelection {
  if (capabilities.hasWebCodecs && capabilities.canEncodeMp4WithWebCodecs) {
    return {
      processor: lazyWebCodecsProcessor,
      support: {
        id: "webcodecs",
        label: lazyWebCodecsProcessor.label,
        available: true,
        supportsExactFrameSampling: true,
        outputMimeType: lazyWebCodecsProcessor.outputMimeType,
        fileExtension: lazyWebCodecsProcessor.fileExtension,
        warnings: [],
        errors: [],
      },
    };
  }

  if (capabilities.maybeMediaRecorderMimeType) {
    return {
      processor: {
        ...mediaRecorderProcessor,
        outputMimeType: capabilities.maybeMediaRecorderMimeType,
        fileExtension: capabilities.maybeMediaRecorderMimeType.startsWith("video/mp4")
          ? "mp4"
          : "webm",
      },
      support: {
        id: "media-recorder",
        label: mediaRecorderProcessor.label,
        available: true,
        supportsExactFrameSampling: false,
        outputMimeType: capabilities.maybeMediaRecorderMimeType,
        fileExtension: capabilities.maybeMediaRecorderMimeType.startsWith("video/mp4")
          ? "mp4"
          : "webm",
        warnings: [
          "Using the fallback renderer. Export runs closer to real time and may save as WebM.",
        ],
        errors: [],
      },
    };
  }

  return {
    processor: null,
    support: {
      id: "media-recorder",
      label: "No browser encoder available",
      available: false,
      supportsExactFrameSampling: false,
      outputMimeType: null,
      fileExtension: null,
      warnings: [],
      errors: ["This browser does not expose WebCodecs MP4 encoding or MediaRecorder export."],
    },
  };
}

const lazyWebCodecsProcessor: Processor = {
  id: "webcodecs",
  label: "WebCodecs MP4",
  supportsExactFrameSampling: true,
  outputMimeType: "video/mp4",
  fileExtension: "mp4",
  process: async (input) => {
    const { webCodecsProcessor } = await import("./webCodecsProcessor");
    return webCodecsProcessor.process(input);
  },
};

export async function selectProcessor(
  metadata: VideoMetadata,
  _settings: TimelapseSettings,
): Promise<ProcessorSelection> {
  return chooseProcessor(await detectBrowserProcessorCapabilities(metadata));
}

export function toValidationCapabilities(selection: ProcessorSelection): ValidationCapabilities {
  return {
    hasUsableProcessor: selection.processor !== null,
    supportsExactFrameSampling: selection.support.supportsExactFrameSampling,
    maybeFallbackMimeType:
      selection.support.id === "media-recorder" ? selection.support.outputMimeType : null,
  };
}

async function detectBrowserProcessorCapabilities(
  metadata: Pick<VideoMetadata, "width" | "height">,
): Promise<BrowserProcessorCapabilities> {
  const hasWebCodecs = "VideoEncoder" in globalThis && "VideoFrame" in globalThis;
  const canEncodeMp4WithWebCodecs = hasWebCodecs
    ? await canEncodeH264Mp4(metadata.width, metadata.height)
    : false;

  return {
    hasWebCodecs,
    canEncodeMp4WithWebCodecs,
    maybeMediaRecorderMimeType: maybeFirstSupportedMediaRecorderMimeType(),
  };
}

async function canEncodeH264Mp4(width: number, height: number): Promise<boolean> {
  try {
    const support = await VideoEncoder.isConfigSupported({
      codec: "avc1.42E01E",
      width,
      height,
      bitrate: Math.max(1_000_000, width * height * 4),
      framerate: 30,
      hardwareAcceleration: "prefer-hardware",
    });

    return support.supported === true;
  } catch {
    return false;
  }
}
