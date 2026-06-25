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
const sourceRepositoryUrl = "https://github.com/pRizz/timelapse-maker";
const openLinksUrl = "https://openlinks.us/";

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
      <div class={styles.footerLinks}>
        <a
          class={styles.footerLink}
          href={sourceRepositoryUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="View Timelapse Maker source on GitHub"
        >
          <GitHubLogo />
          <span>GitHub</span>
        </a>
        <span class={styles.footerNote}>Free and open source</span>
        <a
          class={styles.footerLink}
          href={openLinksUrl}
          target="_blank"
          rel="me noopener noreferrer"
          aria-label="Visit Peter Ryszkiewicz on OpenLinks"
        >
          <OpenLinksLogo />
          <span>By Peter Ryszkiewicz</span>
        </a>
      </div>
    </footer>
  );
}

function GitHubLogo() {
  return (
    <svg
      class={styles.footerIcon}
      aria-hidden="true"
      data-logo="github"
      viewBox="0 0 16 16"
      fill="currentColor"
    >
      <path d="M8 0C3.58 0 0 3.67 0 8.2c0 3.62 2.29 6.7 5.47 7.78.4.08.55-.18.55-.4 0-.19-.01-.84-.01-1.53-2.01.38-2.53-.5-2.69-.96-.09-.23-.48-.96-.82-1.16-.28-.15-.68-.53-.01-.54.63-.01 1.08.59 1.23.83.72 1.24 1.87.89 2.33.68.07-.53.28-.89.51-1.09-1.78-.21-3.64-.91-3.64-4.04 0-.89.31-1.62.82-2.19-.08-.21-.36-1.04.08-2.16 0 0 .67-.22 2.2.84A7.42 7.42 0 0 1 8 3.99c.68 0 1.36.09 2 .27 1.52-1.06 2.19-.84 2.19-.84.44 1.12.16 1.95.08 2.16.51.57.82 1.3.82 2.19 0 3.14-1.87 3.83-3.65 4.04.29.26.54.76.54 1.54 0 1.1-.01 1.99-.01 2.26 0 .22.14.48.55.4A8.2 8.2 0 0 0 16 8.2C16 3.67 12.42 0 8 0Z" />
    </svg>
  );
}

function OpenLinksLogo() {
  return (
    <svg
      class={styles.footerIcon}
      aria-hidden="true"
      data-logo="openlinks"
      viewBox="0 0 100 100"
      fill="none"
    >
      <circle cx="50" cy="50" r="38" stroke="currentColor" stroke-width="8.5" />
      <path
        d="M38.5961 27.1921 V72.8079 H61.4039"
        stroke="currentColor"
        stroke-width="8.5"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </svg>
  );
}
