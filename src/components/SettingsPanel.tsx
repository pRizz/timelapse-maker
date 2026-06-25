import { For, createMemo } from "solid-js";
import {
  OUTPUT_FPS_OPTIONS,
  SPEED_MULTIPLIERS,
  applySpeedMultiplier,
  buildSamplingPlan,
  isTargetDurationSampling,
  type SamplingMode,
  type SpeedMultiplier,
  type TimelapseSettings,
} from "../lib/timelapseSettings";
import type { VideoMetadata } from "../lib/videoMetadata";
import { formatDuration } from "../lib/formatters";
import styles from "./SettingsPanel.module.css";

type SettingsPanelProps = {
  maybeMetadata: VideoMetadata | null;
  settings: TimelapseSettings;
  supportsExactFrameSampling: boolean;
  onSettingsChange: (settings: TimelapseSettings) => void;
};

export function SettingsPanel(props: SettingsPanelProps) {
  const disabled = () => !props.maybeMetadata;
  const maybePlan = createMemo(() =>
    props.maybeMetadata ? buildSamplingPlan(props.maybeMetadata, props.settings) : null,
  );
  const canUseNthFrame = () =>
    Boolean(props.maybeMetadata?.maybeEstimatedFps) || props.supportsExactFrameSampling || disabled();

  const updateSamplingMode = (mode: SamplingMode) => {
    const metadata = props.maybeMetadata;

    if (!metadata) {
      return;
    }

    if (mode === "nth-frame") {
      props.onSettingsChange({
        ...props.settings,
        sampling: { mode, everyNthFrame: 10 },
      });
      return;
    }

    if (mode === "interval-seconds") {
      props.onSettingsChange({
        ...props.settings,
        sampling: { mode, intervalSeconds: 1 },
      });
      return;
    }

    props.onSettingsChange({
      ...props.settings,
      sampling: {
        mode,
        targetDurationSeconds: Math.max(0.2, metadata.durationSeconds / props.settings.speedMultiplier),
      },
    });
  };

  const updateSpeedMultiplier = (speedMultiplier: SpeedMultiplier) => {
    if (!props.maybeMetadata) {
      return;
    }

    props.onSettingsChange(applySpeedMultiplier(props.settings, props.maybeMetadata, speedMultiplier));
  };

  return (
    <section class={styles.panel} aria-labelledby="settings-title">
      <div class={styles.heading}>
        <h2 id="settings-title">Timelapse settings</h2>
        <p>Choose how frames are sampled, then export at the playback FPS you need.</p>
      </div>

      <fieldset class={styles.fieldset} disabled={disabled()}>
        <label class={styles.field}>
          <span>Sampling mode</span>
          <select
            value={props.settings.sampling.mode}
            onChange={(event) => updateSamplingMode(event.currentTarget.value as SamplingMode)}
          >
            <option value="nth-frame" disabled={!canUseNthFrame()}>
              Keep every Nth frame
            </option>
            <option value="interval-seconds">Sample every X seconds</option>
            <option value="target-duration">Target output duration</option>
          </select>
        </label>

        {props.settings.sampling.mode === "nth-frame" ? (
          <label class={styles.field}>
            <span>Keep every</span>
            <div class={styles.inlineInput}>
              <input
                type="number"
                min={2}
                step={1}
                value={props.settings.sampling.everyNthFrame}
                onChange={(event) =>
                  props.onSettingsChange({
                    ...props.settings,
                    sampling: {
                      mode: "nth-frame",
                      everyNthFrame: Number(event.currentTarget.value),
                    },
                  })
                }
              />
              <span>frames</span>
            </div>
          </label>
        ) : null}

        {props.settings.sampling.mode === "interval-seconds" ? (
          <label class={styles.field}>
            <span>Sample every</span>
            <div class={styles.inlineInput}>
              <input
                type="number"
                min={0.1}
                step={0.1}
                value={props.settings.sampling.intervalSeconds}
                onChange={(event) =>
                  props.onSettingsChange({
                    ...props.settings,
                    sampling: {
                      mode: "interval-seconds",
                      intervalSeconds: Number(event.currentTarget.value),
                    },
                  })
                }
              />
              <span>seconds</span>
            </div>
          </label>
        ) : null}

        {isTargetDurationSampling(props.settings.sampling) ? (
          <label class={styles.field}>
            <span>Target duration</span>
            <div class={styles.inlineInput}>
              <input
                type="number"
                min={0.2}
                step={0.1}
                value={props.settings.sampling.targetDurationSeconds}
                onChange={(event) =>
                  props.onSettingsChange({
                    ...props.settings,
                    sampling: {
                      mode: "target-duration",
                      targetDurationSeconds: Number(event.currentTarget.value),
                    },
                  })
                }
              />
              <span>seconds</span>
            </div>
          </label>
        ) : null}

        <div class={styles.speedGroup} aria-label="Speed multiplier preview">
          <span>Speed preview</span>
          <div class={styles.segmented}>
            <For each={SPEED_MULTIPLIERS}>
              {(speedMultiplier) => (
              <button
                class={props.settings.speedMultiplier === speedMultiplier ? styles.activeSegment : ""}
                type="button"
                disabled={disabled()}
                onClick={() => updateSpeedMultiplier(speedMultiplier)}
              >
                {speedMultiplier}x
              </button>
              )}
            </For>
          </div>
        </div>

        <label class={styles.field}>
          <span>Output FPS</span>
          <select
            value={props.settings.outputFps}
            onChange={(event) =>
              props.onSettingsChange({
                ...props.settings,
                outputFps: Number(event.currentTarget.value) as TimelapseSettings["outputFps"],
              })
            }
          >
            <For each={OUTPUT_FPS_OPTIONS}>{(fps) => <option value={fps}>{fps} fps</option>}</For>
          </select>
        </label>

        <label class={styles.field}>
          <span>Output size</span>
          <select
            value={props.settings.resolution.mode}
            onChange={(event) => {
              const mode = event.currentTarget.value as TimelapseSettings["resolution"]["mode"];
              props.onSettingsChange({
                ...props.settings,
                resolution:
                  mode === "custom-width"
                    ? { mode, customWidth: props.maybeMetadata?.width ?? 1280 }
                    : { mode },
              });
            }}
          >
            <option value="original">Original</option>
            <option value="1080p">1080p</option>
            <option value="720p">720p</option>
            <option value="custom-width">Custom width</option>
          </select>
        </label>

        {props.settings.resolution.mode === "custom-width" ? (
          <label class={styles.field}>
            <span>Custom width</span>
            <div class={styles.inlineInput}>
              <input
                type="number"
                min={64}
                max={props.maybeMetadata?.width ?? undefined}
                step={2}
                value={props.settings.resolution.customWidth}
                onChange={(event) =>
                  props.onSettingsChange({
                    ...props.settings,
                    resolution: {
                      mode: "custom-width",
                      customWidth: Number(event.currentTarget.value),
                    },
                  })
                }
              />
              <span>px</span>
            </div>
          </label>
        ) : null}

        <label class={styles.checkbox}>
          <input type="checkbox" checked={props.settings.muteAudio} disabled={true} />
          <span>Mute audio</span>
        </label>
      </fieldset>

      <dl class={styles.estimateGrid}>
        <div>
          <dt>Estimated output</dt>
          <dd>
            {maybePlan() ? formatDuration(maybePlan()!.estimatedOutputDurationSeconds) : "Unavailable"}
          </dd>
        </div>
        <div>
          <dt>Frames</dt>
          <dd>{maybePlan() ? maybePlan()!.frameCount.toLocaleString() : "Unavailable"}</dd>
        </div>
        <div>
          <dt>Effective speed</dt>
          <dd>
            {maybePlan()?.maybeEffectiveSpeed
              ? `${maybePlan()!.maybeEffectiveSpeed!.toFixed(1)}x`
              : "Unavailable"}
          </dd>
        </div>
      </dl>
    </section>
  );
}
