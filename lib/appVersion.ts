import packageJson from "../package.json";

export const APP_SEMVER = packageJson.version;
export const APP_VERSION = APP_SEMVER.replace(/\.0$/, "");
