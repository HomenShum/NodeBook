import { captureMessage } from "@sentry/nextjs";
import Image from "next/image";
import { useEffect, useState } from "react";

import { env } from "@/app/envFrontend";

import styles from "./Loader.module.css";

const Loader = () => {
  const newBuild = useNewBuild();
  return (
    <div className={styles.LoaderContainer}>
      <div className={styles.Logo}>
        <Image src="/logo.svg" alt="Logo" fill sizes="100%" />
      </div>
      {newBuild ? "Loading new version" : " "}
      <div className={styles.Beta}>BETA</div>
    </div>
  );
};

/**
 * Returns true if the build id has changed since the last time the user
 * loaded the app.
 *
 * The build id is injected at build time. See `next.config.mjs` (or whatever the next config file is).
 *
 * For details, see: https://linear.app/ideaflow/issue/ENT-3862/app-reloads-mid-session#comment-08a27abd
 */
function useNewBuild() {
  const [isNewBuild, setIsNewBuild] = useState(false);
  useEffect(() => {
    const prevBuildId = localStorage.getItem("buildId");

    if (prevBuildId !== env.buildId) {
      setIsNewBuild(true);
      localStorage.setItem("buildId", env.buildId ?? "null");
    }
    // Telemetry added as part of ENT-3862. Can be removed once we understand the issue.
    captureMessage("Loading", { level: "info", extra: { buildId: env.buildId, prevBuildId } });
  }, []);

  return isNewBuild;
}

export default Loader;
