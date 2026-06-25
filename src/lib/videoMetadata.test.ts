import { describe, expect, it } from "vitest";
import { resolveMetadataDuration } from "./videoMetadata";

describe("video metadata", () => {
  it("prefers computed duration when native metadata materially disagrees", () => {
    // Arrange
    const nativeDurationSeconds = 0.82;
    const computedDurationSeconds = 24.66;

    // Act
    const durationSeconds = resolveMetadataDuration(
      nativeDurationSeconds,
      computedDurationSeconds,
    );

    // Assert
    expect(durationSeconds).toBe(computedDurationSeconds);
  });

  it("keeps native duration when computed duration is close", () => {
    // Arrange
    const nativeDurationSeconds = 196.48;
    const computedDurationSeconds = 196.54;

    // Act
    const durationSeconds = resolveMetadataDuration(
      nativeDurationSeconds,
      computedDurationSeconds,
    );

    // Assert
    expect(durationSeconds).toBe(nativeDurationSeconds);
  });
});
