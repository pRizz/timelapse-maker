import { render } from "@solidjs/testing-library";
import { describe, expect, it } from "vitest";
import App from "./App";

describe("App", () => {
  it("renders the utility with disabled processing before upload", () => {
    // Arrange
    const { baseElement } = render(() => <App />);

    // Act
    const text = baseElement.textContent ?? "";
    const buttons = Array.from(baseElement.querySelectorAll("button"));
    const maybePreviewButton = buttons.find((button) => /generate preview/i.test(button.textContent ?? ""));
    const maybeExportButton = buttons.find((button) => /export video/i.test(button.textContent ?? ""));

    // Assert
    expect(text).toContain("Timelapse Maker");
    expect(text).toContain("Your video stays on your device");
    expect(text).not.toContain("Client-side video utility");
    expect(text).not.toContain("Copy build info");
    expect(maybePreviewButton?.disabled).toBe(true);
    expect(maybeExportButton?.disabled).toBe(true);
  });
});
