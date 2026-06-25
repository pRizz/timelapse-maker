# timelapse-maker

<!-- bright-builds-rules-readme-badges:begin -->

<!-- Managed upstream by bright-builds-rules. If this badge block needs a fix, open an upstream PR or issue instead of editing the downstream managed block. Keep repo-local README content outside this managed badge block. -->

[![GitHub Stars](https://img.shields.io/github/stars/pRizz/timelapse-maker)](https://github.com/pRizz/timelapse-maker)
[![License](https://img.shields.io/github/license/pRizz/timelapse-maker?style=flat-square)](./LICENSE)
[![Bright Builds: Rules](https://raw.githubusercontent.com/bright-builds-llc/bright-builds-rules/main/public/badges/bright-builds-rules-flat.svg)](https://github.com/bright-builds-llc/bright-builds-rules)
[![OpenLinks profile](https://img.shields.io/badge/OpenLinks-profile-0F172A)](https://openlinks.us/)

<!-- bright-builds-rules-readme-badges:end -->

Timelapse Maker is a front-end-only browser app that converts local iPhone, MP4,
and MOV videos into downloadable timelapse videos. It samples source frames,
re-encodes the selected frames in the browser, and never uploads the video file.

Live site: <https://prizz.github.io/timelapse-maker/>

## Run Locally

Install dependencies:

```bash
bun install
```

Start the dev server:

```bash
bun run dev
```

Build the production bundle:

```bash
bun run build
```

Preview the production bundle:

```bash
bun run preview
```

Run tests:

```bash
bun test
```

## Deployment

The production bundle is static and is deployed to GitHub Pages on every push to
`main` using GitHub Actions. The Pages build sets Vite's base path to
`/timelapse-maker/`; local dev and preview keep the normal `/` base path.

## Install / Offline

The app is installable as a progressive web app in browsers that support PWA
installation. After the first successful online load, the built app shell and
static assets are cached so the converter can reopen offline at the same URL.

Offline support does not store uploaded source videos or rendered timelapse
outputs. Selected videos stay in the active browser session, and exported files
are still downloaded through the browser. The optional `ffmpeg.wasm` encoder is
loaded on demand and may need a network connection the first time that fallback
is used.

## Privacy

Your video stays on your device. The app uses browser `File`, object URL,
canvas, WebCodecs, MediaRecorder, and an optional `ffmpeg.wasm` fallback when
native browser encoders cannot create previewable MP4 output. There is no
backend, no upload step, and no telemetry.

## Browser Compatibility

The app prefers a WebCodecs + Mediabunny processing path for H.264 MP4 output.
When that is unavailable, it falls back to drawing frames through canvas and
encoding H.264 MP4 with MediaRecorder. If native browser APIs cannot produce a
previewable MP4, the app lazy-loads `ffmpeg.wasm` and encodes the same sampled
frames to H.264 MP4 locally. Browser support differs:

- Chrome and Chromium-based browsers generally provide the broadest WebCodecs
  and MediaRecorder support. Chrome on iPhone uses iOS/WebKit media
  capabilities, so the compatible MP4 path matters there.
- Safari support depends on macOS/iOS codec capabilities, especially for iPhone
  HEVC/H.265 and MOV files.
- Browsers without native MP4 encoding may use the slower `ffmpeg.wasm` fallback
  instead of exporting WebM.

The UI detects available processors and shows warnings when the selected video
or settings may not work in the current browser.

## Known Limitations

- HEVC/H.265 and MOV decoding depends on the browser, operating system, and
  installed codecs.
- Frame-accurate "keep every Nth frame" is best in the WebCodecs path. The
  MediaRecorder fallback needs an FPS estimate and may be approximate.
- Fallback export can run close to real time because MediaRecorder timestamps
  frames from wall-clock time.
- Unmuted timelapse audio is not supported in v1. Exports are silent by default.
- Very large or long videos can hit browser memory, decoding, or encoder limits.

## Future Improvements

- Audio speed-up and muxing pipeline.
- Batch conversion.
- Resumable or chunked processing for very large videos.
- Browser-matrix smoke tests with representative MP4, MOV, H.264, and HEVC
  samples.
