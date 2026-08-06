import cliPackageJson from "../../../cli/package.json";

// All fixed/linked packages (see .changeset/config.json) share this version, so
// the CLI's package.json is as good a source as any of them.
export const GRAM_VERSION: string = cliPackageJson.version;
