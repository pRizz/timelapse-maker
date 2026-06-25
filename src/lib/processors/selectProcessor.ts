import type { TimelapseSettings, ValidationCapabilities } from "../timelapseSettings";
import type { VideoMetadata } from "../videoMetadata";
import { mediaRecorderProcessor } from "./mediaRecorderProcessor";
import {
  canBrowserPreviewH264Mp4,
  canUseFfmpegWasm,
  chooseOutputFormatProfile,
  H264_BASELINE_CODEC_STRING,
  H264_HIGH_CODEC_STRING,
  maybeFirstSupportedMediaRecorderMp4MimeType,
  MP4_MIME_TYPE,
} from "./outputCompatibility";
import type { Processor, ProcessorSelection } from "./types";

export type BrowserProcessorCapabilities = {
  hasWebCodecs: boolean;
  canEncodeMp4WithWebCodecs: boolean;
  maybeMediaRecorderMp4MimeType: string | null;
  canPreviewH264Mp4: boolean;
  canUseFfmpegWasm: boolean;
};

export function chooseProcessor(
  capabilities: BrowserProcessorCapabilities,
): ProcessorSelection {
  const outputProfile = chooseOutputFormatProfile(capabilities);

  if (
    outputProfile.id === "mp4-h264-native" &&
    capabilities.hasWebCodecs &&
    capabilities.canEncodeMp4WithWebCodecs
  ) {
    return {
      processor: lazyWebCodecsProcessor,
      support: {
        id: "webcodecs",
        label: lazyWebCodecsProcessor.label,
        available: true,
        supportsExactFrameSampling: true,
        outputMimeType: lazyWebCodecsProcessor.outputMimeType,
        fileExtension: lazyWebCodecsProcessor.fileExtension,
        outputFormatProfile: outputProfile.id,
        warnings: [],
        errors: [],
      },
    };
  }

  if (outputProfile.id === "mp4-h264-native" && capabilities.maybeMediaRecorderMp4MimeType) {
    return {
      processor: {
        ...mediaRecorderProcessor,
        outputMimeType: capabilities.maybeMediaRecorderMp4MimeType,
      },
      support: {
        id: "media-recorder",
        label: mediaRecorderProcessor.label,
        available: true,
        supportsExactFrameSampling: false,
        outputMimeType: capabilities.maybeMediaRecorderMp4MimeType,
        fileExtension: "mp4",
        outputFormatProfile: outputProfile.id,
        warnings: [
          "Using the fallback renderer. Export runs closer to real time.",
        ],
        errors: [],
      },
    };
  }

  if (outputProfile.id === "mp4-h264-wasm") {
    return {
      processor: lazyFfmpegWasmProcessor,
      support: {
        id: "ffmpeg-wasm",
        label: lazyFfmpegWasmProcessor.label,
        available: true,
        supportsExactFrameSampling: false,
        outputMimeType: MP4_MIME_TYPE,
        fileExtension: "mp4",
        outputFormatProfile: outputProfile.id,
        warnings: outputProfile.warnings,
        errors: [],
      },
    };
  }

  return {
    processor: null,
    support: {
      id: "unsupported",
      label: "No compatible encoder available",
      available: false,
      supportsExactFrameSampling: false,
      outputMimeType: null,
      fileExtension: null,
      outputFormatProfile: outputProfile.id,
      warnings: [],
      errors: outputProfile.errors,
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
    maybeMediaRecorderMp4MimeType: maybeFirstSupportedMediaRecorderMp4MimeType(),
    canPreviewH264Mp4: canBrowserPreviewH264Mp4(),
    canUseFfmpegWasm: canUseFfmpegWasm(),
  };
}

async function canEncodeH264Mp4(width: number, height: number): Promise<boolean> {
  if (await canEncodeH264CodecString(H264_HIGH_CODEC_STRING, width, height)) {
    return true;
  }

  return canEncodeH264CodecString(H264_BASELINE_CODEC_STRING, width, height);
}

async function canEncodeH264CodecString(
  codec: string,
  width: number,
  height: number,
): Promise<boolean> {
  try {
    const support = await VideoEncoder.isConfigSupported({
      codec,
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

const lazyFfmpegWasmProcessor: Processor = {
  id: "ffmpeg-wasm",
  label: "ffmpeg.wasm MP4",
  supportsExactFrameSampling: false,
  outputMimeType: MP4_MIME_TYPE,
  fileExtension: "mp4",
  process: async (input) => {
    const { ffmpegWasmProcessor } = await import("./ffmpegWasmProcessor");
    return ffmpegWasmProcessor.process(input);
  },
};
