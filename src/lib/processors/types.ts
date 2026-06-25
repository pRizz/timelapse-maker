import type { SamplingPlan, TimelapseSettings } from "../timelapseSettings";
import type { VideoMetadata } from "../videoMetadata";

export type ProcessingMode = "preview" | "export";
export type ProcessorId = "webcodecs" | "media-recorder";

export type ProcessingProgress = {
  stage: "preparing" | "decoding" | "encoding" | "muxing" | "finalizing";
  completedFrames: number;
  totalFrames: number;
  message: string;
};

export type ProcessInput = {
  file: File;
  metadata: VideoMetadata;
  settings: TimelapseSettings;
  samplingPlan: SamplingPlan;
  mode: ProcessingMode;
  signal: AbortSignal;
  onProgress: (progress: ProcessingProgress) => void;
};

export type ProcessResult = {
  blob: Blob;
  mimeType: string;
  fileName: string;
  durationSeconds: number;
  frameCount: number;
  warnings: string[];
};

export type Processor = {
  id: ProcessorId;
  label: string;
  supportsExactFrameSampling: boolean;
  outputMimeType: string;
  fileExtension: "mp4" | "webm";
  process: (input: ProcessInput) => Promise<ProcessResult>;
};

export type ProcessorSupport = {
  id: ProcessorId;
  label: string;
  available: boolean;
  supportsExactFrameSampling: boolean;
  outputMimeType: string | null;
  fileExtension: "mp4" | "webm" | null;
  warnings: string[];
  errors: string[];
};

export type ProcessorSelection = {
  processor: Processor | null;
  support: ProcessorSupport;
};
