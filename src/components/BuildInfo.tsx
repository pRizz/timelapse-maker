import styles from "./BuildInfo.module.css";

const buildInfo = {
  version: typeof __APP_VERSION__ === "undefined" ? "Unavailable" : __APP_VERSION__,
  commit: typeof __BUILD_COMMIT__ === "undefined" ? "Unavailable" : __BUILD_COMMIT__,
  commitUrl: typeof __BUILD_COMMIT_URL__ === "undefined" ? "" : __BUILD_COMMIT_URL__,
  buildTime: typeof __BUILD_TIME__ === "undefined" ? "Unavailable" : __BUILD_TIME__,
  buildRunUrl: typeof __BUILD_RUN_URL__ === "undefined" ? "" : __BUILD_RUN_URL__,
};

export function BuildInfo() {
  const shortCommit =
    buildInfo.commit === "Unavailable" ? "Unavailable" : buildInfo.commit.slice(0, 7);
  const commit = buildInfo.commitUrl ? (
    <a href={buildInfo.commitUrl} rel="noopener noreferrer" aria-label={`View commit ${shortCommit} on GitHub`}>
      {shortCommit}
    </a>
  ) : (
    shortCommit
  );
  const buildTime = buildInfo.buildRunUrl ? (
    <a href={buildInfo.buildRunUrl} rel="noopener noreferrer" aria-label="View the GitHub Actions run for this build">
      {buildInfo.buildTime}
    </a>
  ) : (
    buildInfo.buildTime
  );

  return (
    <footer class={styles.footer}>
      <div class={styles.buildInfo}>
        <span>Version {buildInfo.version}</span>
        <span>Commit {commit}</span>
        <span>Build {buildTime}</span>
      </div>
      <a href="https://openlinks.us/" rel="me noopener noreferrer" aria-label="Visit my OpenLinks page">
        OpenLinks
      </a>
    </footer>
  );
}
