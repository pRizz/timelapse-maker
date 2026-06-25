import { render } from "@solidjs/testing-library";
import { describe, expect, it } from "vitest";
import { BuildInfoView, type BuildInfoDetails } from "./BuildInfo";

const linkedBuildInfo: BuildInfoDetails = {
  version: "0.1.0",
  commit: "7be95e6d2b28f2f7d7d4d7d7d7d7d7d7d7d7d7d7",
  commitUrl:
    "https://github.com/pRizz/timelapse-maker/commit/7be95e6d2b28f2f7d7d4d7d7d7d7d7d7d7d7d7d7",
  buildTime: "2026-06-25T03:01:56.135Z",
  buildRunUrl: "https://github.com/pRizz/timelapse-maker/actions/runs/123456789",
};

describe("BuildInfo", () => {
  it("opens linked build provenance and footer attribution in new tabs", () => {
    // Arrange
    const { baseElement } = render(() => <BuildInfoView buildInfo={linkedBuildInfo} />);

    // Act
    const text = baseElement.textContent ?? "";
    const maybeCommitLink = Array.from(baseElement.querySelectorAll("a")).find((link) =>
      link.getAttribute("href")?.includes("/commit/"),
    );
    const maybeBuildLink = Array.from(baseElement.querySelectorAll("a")).find((link) =>
      link.getAttribute("href")?.includes("/actions/runs/"),
    );
    const maybeGitHubLink = Array.from(baseElement.querySelectorAll("a")).find(
      (link) => link.getAttribute("href") === "https://github.com/pRizz/timelapse-maker",
    );
    const maybeOpenLinksLink = Array.from(baseElement.querySelectorAll("a")).find(
      (link) => link.getAttribute("href") === "https://openlinks.us/",
    );

    // Assert
    expect(maybeCommitLink?.textContent).toBe("7be95e6");
    expect(maybeCommitLink).toHaveAttribute("target", "_blank");
    expect(maybeCommitLink).toHaveAttribute("rel", "noopener noreferrer");
    expect(maybeBuildLink?.textContent).toBe(linkedBuildInfo.buildTime);
    expect(maybeBuildLink).toHaveAttribute("target", "_blank");
    expect(maybeBuildLink).toHaveAttribute("rel", "noopener noreferrer");
    expect(text).toContain("Free and open source");
    expect(maybeGitHubLink?.textContent).toBe("GitHub");
    expect(maybeGitHubLink).toHaveAttribute("target", "_blank");
    expect(maybeGitHubLink).toHaveAttribute("rel", "noopener noreferrer");
    expect(maybeGitHubLink?.querySelector('[data-logo="github"]')).toBeInTheDocument();
    expect(maybeOpenLinksLink?.textContent).toBe("By Peter Ryszkiewicz");
    expect(maybeOpenLinksLink).toHaveAttribute("target", "_blank");
    expect(maybeOpenLinksLink).toHaveAttribute("rel", "me noopener noreferrer");
    expect(maybeOpenLinksLink?.querySelector('[data-logo="openlinks"]')).toBeInTheDocument();
  });
});
