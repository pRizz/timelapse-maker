import styles from "./BuildInfo.module.css";

const buildInfo = {
  version: typeof __APP_VERSION__ === "undefined" ? "Unavailable" : __APP_VERSION__,
  commit: typeof __BUILD_COMMIT__ === "undefined" ? "Unavailable" : __BUILD_COMMIT__,
  buildTime: typeof __BUILD_TIME__ === "undefined" ? "Unavailable" : __BUILD_TIME__,
};

export function BuildInfo() {
  const shortCommit =
    buildInfo.commit === "Unavailable" ? "Unavailable" : buildInfo.commit.slice(0, 7);

  return (
    <footer class={styles.footer}>
      <div class={styles.buildInfo}>
        <span>Version {buildInfo.version}</span>
        <span>Commit {shortCommit}</span>
        <span>Build {buildInfo.buildTime}</span>
      </div>
      <a href="https://openlinks.us/" rel="me noopener noreferrer" aria-label="Visit my OpenLinks page">
        OpenLinks
      </a>
    </footer>
  );
}
