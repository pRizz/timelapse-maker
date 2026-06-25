export type RenderedVideo = {
  url: string;
  fileName: string;
  mimeType: string;
  durationSeconds: number;
  frameCount: number;
  warnings: string[];
  canPreview: boolean;
};
