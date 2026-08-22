import { defineCommand, runMain } from "citty";
import { log, note } from "@clack/prompts";
import { GramCLIError, ExitCode, setVerbose, isVerbose } from "./errors";
import { version } from "../package.json";
import { findProjectRoot } from "./core/workspace";
import { loadConfig } from "./core/config";
import {
	checkForUpdateInBackground,
	getPendingNotification,
} from "./services/update-checker";
import { join } from "node:path";

// Bun auto-loads `.env`, Node doesn't — `gram init`/`gram config set` both
// write API keys to `.env`
// (services/config-manager.ts), so every npm-installed user (the published
// binary's shebang is `#!/usr/bin/env node`) hit "Missing API key" after
// following the documented onboarding flow, while it worked for whoever
// happened to run it under Bun. `process.loadEnvFile` never overrides an
// already-set `process.env` value, matching how `.env` files are expected to
// behave everywhere else. Silently ignored if there's no `.env` (the normal
// case) or if the current runtime doesn't support the call at all (Bun
// already loads `.env` natively, so a failure here costs nothing under Bun).
try {
	const projectRoot = await findProjectRoot();
	process.loadEnvFile(join(projectRoot, ".env"));
} catch {}

// --verbose/--debug is a global flag handled here rather than as a citty arg on
// every subcommand, since citty has no first-class "shared across all
// subcommands" mechanism. Stripped from argv before citty ever parses it, so
// it can't collide with any subcommand's own arg definitions.
// Deliberately no `-v` shorthand: citty already reserves it as the `--version`
// shortcut, and stripping it here would silently break `gram -v`.
const rawArgs = process.argv.slice(2);
const verboseFlags = new Set(["--verbose", "--debug"]);
const filteredArgs = rawArgs.filter((a) => !verboseFlags.has(a));
if (filteredArgs.length !== rawArgs.length) setVerbose(true);

// The passive "update available" notice: `upgrade` already does its own
// explicit check, CI/non-TTY runs shouldn't get interactive-looking noise,
// and `GRAM_NO_UPDATE_CHECK`/`updateCheck: false` are the escape hatches.
// A broken/invalid config here shouldn't block the CLI from starting — the
// command itself will report that more usefully — so default to enabled.
async function isUpdateCheckEnabled(): Promise<boolean> {
	if (process.env.CI || process.env.GRAM_NO_UPDATE_CHECK) return false;
	if (!process.stdout.isTTY) return false;
	try {
		const config = await loadConfig();
		return config.updateCheck !== false;
	} catch {
		return true;
	}
}

const updateCheckEnabled =
	filteredArgs[0] !== "upgrade" && (await isUpdateCheckEnabled());
if (updateCheckEnabled) void checkForUpdateInBackground();

const main = defineCommand({
	meta: {
		name: "gram",
		version,
		description:
			"CLI for the Gram recipe language. Pass --verbose/--debug (any command) to print full stack traces on error.",
	},
	subCommands: {
		init: () => import("./commands/init").then((m) => m.default),
		check: () => import("./commands/check").then((m) => m.default),
		build: () => import("./commands/build").then((m) => m.default),
		view: () => import("./commands/view").then((m) => m.default),
		import: () => import("./commands/import").then((m) => m.default),
		db: () => import("./commands/db").then((m) => m.default),
		shop: () => import("./commands/shop").then((m) => m.default),
		watch: () => import("./commands/watch").then((m) => m.default),
		scale: () => import("./commands/scale").then((m) => m.default),
		diff: () => import("./commands/diff").then((m) => m.default),
		cook: () => import("./commands/cook").then((m) => m.default),
		config: () => import("./commands/config").then((m) => m.default),
		format: () => import("./commands/format").then((m) => m.default),
		export: () => import("./commands/export").then((m) => m.default),
		print: () => import("./commands/print").then((m) => m.default),
		suggest: () => import("./commands/suggest").then((m) => m.default),
		upgrade: () => import("./commands/upgrade").then((m) => m.default),
	},
});

try {
	await runMain(main, { rawArgs: filteredArgs });
	if (updateCheckEnabled) {
		const pending = await getPendingNotification(version);
		if (pending) {
			note(
				`Update available: ${version} → ${pending.latest}\nRun: npm install -g @gram-lang/cli@latest`,
				"gram update available",
			);
		}
	}
} catch (err) {
	// citty's own runMain() catches and process.exit()s internally on any error
	// thrown from a command's run(), so in practice this only runs for errors
	// thrown before/around that call (e.g. in the argv handling above) — most
	// commands report --verbose-aware errors themselves via reportError().
	if (err instanceof GramCLIError) {
		log.error(err.message);
		if (isVerbose() && err.stack) console.error(err.stack);
		process.exit(err.exitCode);
	}
	log.error("An unexpected internal error occurred.");
	console.error(err);
	process.exit(ExitCode.InternalError);
}
