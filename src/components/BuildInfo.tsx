import styles from "./BuildInfo.module.css";

export type BuildInfoDetails = {
  version: string;
  commit: string;
  commitUrl: string;
  buildTime: string;
  buildRunUrl: string;
};

const buildInfo: BuildInfoDetails = {
  version: typeof __APP_VERSION__ === "undefined" ? "Unavailable" : __APP_VERSION__,
  commit: typeof __BUILD_COMMIT__ === "undefined" ? "Unavailable" : __BUILD_COMMIT__,
  commitUrl: typeof __BUILD_COMMIT_URL__ === "undefined" ? "" : __BUILD_COMMIT_URL__,
  buildTime: typeof __BUILD_TIME__ === "undefined" ? "Unavailable" : __BUILD_TIME__,
  buildRunUrl: typeof __BUILD_RUN_URL__ === "undefined" ? "" : __BUILD_RUN_URL__,
};

export function BuildInfo() {
  return <BuildInfoView buildInfo={buildInfo} />;
}

export function BuildInfoView(props: { buildInfo: BuildInfoDetails }) {
  const shortCommit =
    props.buildInfo.commit === "Unavailable" ? "Unavailable" : props.buildInfo.commit.slice(0, 7);
  const commit = props.buildInfo.commitUrl ? (
    <a
      href={props.buildInfo.commitUrl}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`View commit ${shortCommit} on GitHub`}
    >
      {shortCommit}
    </a>
  ) : (
    shortCommit
  );
  const buildTime = props.buildInfo.buildRunUrl ? (
    <a
      href={props.buildInfo.buildRunUrl}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="View the GitHub Actions run for this build"
    >
      {props.buildInfo.buildTime}
    </a>
  ) : (
    props.buildInfo.buildTime
  );

  return (
    <footer class={styles.footer}>
      <div class={styles.buildInfo}>
        <span>Version {props.buildInfo.version}</span>
        <span>Commit {commit}</span>
        <span>Build {buildTime}</span>
      </div>
      <a href="https://openlinks.us/" rel="me noopener noreferrer" aria-label="Visit my OpenLinks page">
        OpenLinks
      </a>
    </footer>
  );
}
