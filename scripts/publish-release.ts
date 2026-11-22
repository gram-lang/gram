#!/usr/bin/env bun
// Safe release publisher: verifies git status, checks npm and Open VSX auth, publishes packages
// to npm (with interactive 2FA), packages the VS Code extension and publishes it to Open VSX,
// extracts release notes from CHANGELOG.md, creates the annotated git tag, pushes to origin,
// and publishes the release on Forgejo via `tea`.

import { execSync, spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";

interface ReleaseOptions {
	dryRun: boolean;
	draft: boolean;
	yes: boolean;
	skipChecks: boolean;
	skipNpm: boolean;
	skipOvsx: boolean;
	targetVersion?: string;
}

function parseArgs(): ReleaseOptions {
	const args = process.argv.slice(2);
	return {
		dryRun: args.includes("--dry-run"),
		draft: args.includes("--draft") || args.includes("-d"),
		yes: args.includes("--yes") || args.includes("-y"),
		skipChecks: args.includes("--skip-checks") || args.includes("--skip-ci"),
		skipNpm: args.includes("--skip-npm"),
		skipOvsx: args.includes("--skip-ovsx"),
		targetVersion: args.find((a) => !a.startsWith("-")),
	};
}

function run(cmd: string, options: { stdio?: "inherit" | "pipe" } = { stdio: "pipe" }): string {
	try {
		// With stdio "inherit" execSync returns null (output goes straight to the terminal).
		return (execSync(cmd, { encoding: "utf-8", stdio: options.stdio }) ?? "").trim();
	} catch (error: any) {
		if (options.stdio === "pipe" && error.stderr) {
			console.error(error.stderr.toString());
		}
		throw error;
	}
}

// Open VSX (Cursor, Windsurf, VSCodium, Positron...). Pinned: `bunx` runs it without adding
// its dependency tree to the lockfile.
const OVSX = "ovsx@1.4.0";
const OVSX_NAMESPACE = "gram-lang";
const EXTENSION_DIR = "packages/vscode-extension";

/**
 * The Open VSX token, never stored in the repo: `OVSX_PAT` if set, otherwise the system keyring
 * (libsecret), filled once with
 * `secret-tool store --label="Open VSX token" service open-vsx account gram-lang`.
 */
function resolveOvsxToken(): string | undefined {
	const fromEnv = process.env.OVSX_PAT?.trim();
	if (fromEnv) return fromEnv;
	const lookup = spawnSync("secret-tool", ["lookup", "service", "open-vsx", "account", OVSX_NAMESPACE], {
		encoding: "utf-8",
	});
	const fromKeyring = lookup.status === 0 ? lookup.stdout.trim() : "";
	return fromKeyring || undefined;
}

/** Runs ovsx with the token in its environment, never on the command line (visible in `ps`). */
function runOvsx(args: string[], token: string) {
	return spawnSync("bunx", [OVSX, ...args], {
		stdio: "inherit",
		env: { ...process.env, OVSX_PAT: token },
	});
}

async function getVersionFromPackages(): Promise<string> {
	try {
		const kitchenPkg = JSON.parse(await readFile("./packages/kitchen/package.json", "utf-8"));
		return kitchenPkg.version;
	} catch {
		const rootPkg = JSON.parse(await readFile("./package.json", "utf-8"));
		return rootPkg.version;
	}
}

export function extractReleaseNotes(changelog: string, version: string): string {
	// Look for ## [version] or ## [version](...)
	const escapedVer = version.replace(/\./g, "\\.");
	const versionRegex = new RegExp(`^##\\s+\\[${escapedVer}\\][^\\n]*\\n`, "m");
	const match = changelog.match(versionRegex);

	if (!match || match.index === undefined) {
		throw new Error(`Could not find release notes for version [${version}] in CHANGELOG.md`);
	}

	const startIndex = match.index + match[0].length;
	const remaining = changelog.slice(startIndex);

	// Find the end of this release section (either '---' separator or the next '## [' heading)
	const endMatch = remaining.match(/\n---\s*\n|\n##\s+\[/);
	const rawNotes = endMatch && endMatch.index !== undefined
		? remaining.slice(0, endMatch.index)
		: remaining;

	return rawNotes.trim();
}

async function main() {
	const options = parseArgs();

	console.log("🔍 Running pre-flight checks...\n");

	// 1. Check tea is installed and configured
	try {
		const teaVersion = run("tea --version");
		console.log(`✓ tea CLI detected (${teaVersion.split("\t")[0]})`);
	} catch {
		console.error("❌ `tea` CLI is not installed or not available in PATH.");
		console.error("Please install tea: https://gitea.com/gitea/tea");
		process.exit(1);
	}

	// 2. Check npm login status if publishing to npm
	if (!options.skipNpm && !options.dryRun) {
		try {
			const npmUser = run("npm whoami");
			console.log(`✓ npm authenticated as '${npmUser}'`);
		} catch {
			console.error("❌ Not logged into npm. Run `npm login` first, or pass `--skip-npm`.");
			process.exit(1);
		}
	}

	// 2b. Check the Open VSX token can publish to the namespace
	let ovsxToken: string | undefined;
	if (!options.skipOvsx && !options.dryRun) {
		ovsxToken = resolveOvsxToken();
		if (!ovsxToken) {
			console.error("❌ No Open VSX token. Store it once in the keyring:");
			console.error(`   secret-tool store --label="Open VSX token" service open-vsx account ${OVSX_NAMESPACE}`);
			console.error("   (or export OVSX_PAT), or pass `--skip-ovsx`.");
			process.exit(1);
		}
		const verify = runOvsx(["verify-pat", OVSX_NAMESPACE], ovsxToken);
		if (verify.status !== 0) {
			console.error(`❌ The Open VSX token cannot publish to '${OVSX_NAMESPACE}'. Pass \`--skip-ovsx\` to skip it.`);
			process.exit(1);
		}
		console.log(`✓ Open VSX token can publish to '${OVSX_NAMESPACE}'`);
	}

	// 3. Check git branch is main
	const currentBranch = run("git rev-parse --abbrev-ref HEAD");
	if (currentBranch !== "main") {
		console.warn(`⚠️  Current branch is '${currentBranch}', not 'main'.`);
		if (!options.dryRun && !options.yes) {
			const rl = createInterface({ input: stdin, output: stdout });
			const answer = await rl.question("Do you want to continue anyway? (y/N): ");
			rl.close();
			if (answer.toLowerCase() !== "y") {
				console.log("Aborted.");
				process.exit(0);
			}
		}
	} else {
		console.log("✓ Git branch is 'main'");
	}

	// 4. Check git worktree is clean
	const gitStatus = run("git status --porcelain");
	if (gitStatus.length > 0) {
		if (options.dryRun) {
			console.warn("⚠️  [DRY RUN] Git working directory is not clean (ignored in dry-run mode):");
			console.warn(gitStatus);
		} else {
			console.error("❌ Git working directory is not clean. Commit or stash all changes first.");
			console.error(gitStatus);
			process.exit(1);
		}
	} else {
		console.log("✓ Git working tree is clean");
	}

	// 5. Run quality checks unless skipped
	if (!options.skipChecks && !options.dryRun) {
		console.log("\n🧪 Running quality gates (lint, typecheck, tests, conformance)...");
		try {
			execSync("bun run ci", { stdio: "inherit" });
			execSync("bun run conformance", { stdio: "inherit" });
			console.log("✓ All quality gates passed.\n");
		} catch {
			console.error("\n❌ Quality gates failed. Aborting release.");
			process.exit(1);
		}
	}

	// 6. Determine version and tag name
	const version = options.targetVersion || await getVersionFromPackages();
	const tag = `v.${version}`;
	console.log(`\n📦 Target version: ${version} (Git tag: ${tag})`);

	// 7. Extract release notes from CHANGELOG.md
	const changelogContent = await readFile("./CHANGELOG.md", "utf-8");
	let notes: string;
	try {
		notes = extractReleaseNotes(changelogContent, version);
	} catch (err: any) {
		console.error(`❌ ${err.message}`);
		process.exit(1);
	}

	console.log("\n--- Extracted Release Notes Preview ---");
	console.log(notes);
	console.log("---------------------------------------\n");

	if (options.dryRun) {
		console.log("✨ [DRY RUN] Would perform:");
		const steps: string[] = [];
		if (!options.skipNpm) {
			steps.push(
				"Resolve workspace versions on disk (node scripts/resolve-workspace-versions.cjs)",
				"Publish packages to npm (npx changeset publish) [interactive 2FA]",
				"Restore workspace dependencies in package.json (git checkout -- packages/*/package.json)",
			);
		}
		if (!options.skipOvsx) {
			steps.push(
				`Package the VS Code extension (bun run --cwd ${EXTENSION_DIR} package)`,
				`Publish ${EXTENSION_DIR}/gram-lang-${version}.vsix to Open VSX (bunx ${OVSX} publish --skip-duplicate)`,
			);
		}
		steps.push(
			`git tag -a ${tag} -m "chore: release ${tag}"`,
			"git push origin main --tags",
			`tea release create --tag "${tag}" --title "${tag}" --note "<extracted notes>"${options.draft ? " --draft" : ""}`,
		);
		steps.forEach((step, i) => console.log(`  ${i + 1}. ${step}`));
		console.log("\nDry run completed successfully. No changes were made.");
		return;
	}

	// 8. Ask for explicit user confirmation
	if (!options.yes) {
		const rl = createInterface({ input: stdin, output: stdout });
		const targets = [
			...(options.skipNpm ? [] : ["publish to npm (interactive 2FA)"]),
			...(options.skipOvsx ? [] : ["publish the extension to Open VSX"]),
		];
		const actionDesc = targets.length > 0
			? `${targets.join(", ")} and create release ${tag} on Forgejo`
			: `create release ${tag} on Forgejo (skipping npm and Open VSX)`;
		const promptMsg = options.draft
			? `Proceed to ${actionDesc} as DRAFT? (y/N): `
			: `Proceed to ${actionDesc}? (y/N): `;
		const answer = await rl.question(promptMsg);
		rl.close();

		if (answer.toLowerCase() !== "y") {
			console.log("Release cancelled by user.");
			process.exit(0);
		}
	}

	// 9. Publish packages to npm via changeset
	if (!options.skipNpm) {
		console.log("\n📦 Publishing packages to npm via changeset...");
		let publishStatus = 0;

		try {
			console.log("   Resolving workspace:* versions in package.json manifests...");
			run("node scripts/resolve-workspace-versions.cjs");

			console.log("   Running changeset publish (enter 2FA code / WebAuthn if prompted)...");
			const publishResult = spawnSync("npx", ["changeset", "publish"], { stdio: "inherit" });
			publishStatus = publishResult.status ?? 1;
		} catch (err) {
			console.error("❌ Could not prepare or run the npm publication:", err);
			publishStatus = 1;
		} finally {
			// Always restore workspace:* ranges on disk so git worktree stays clean.
			// (Never call process.exit inside the try: it would skip this block.)
			console.log("   Restoring package.json workspace dependencies...");
			run("git checkout -- packages/*/package.json");
		}

		if (publishStatus !== 0) {
			console.error(`\n❌ npm publication failed (exit code ${publishStatus}).`);
			console.error("Aborting release: git tag was not pushed and Forgejo release was not created.");
			console.error("Already published packages are skipped on re-run: fix the cause and run `bun run release` again.");
			process.exit(publishStatus);
		}
		console.log("✓ Successfully published packages to npm.");
	} else {
		console.log("\n⏭️  Skipping npm publish (--skip-npm).");
	}

	// 9b. Package the VS Code extension and publish it to Open VSX. Before the tag, like npm:
	// a failure aborts, and a re-run skips a version already published (--skip-duplicate).
	if (!options.skipOvsx && ovsxToken) {
		console.log("\n🧩 Publishing the VS Code extension to Open VSX...");
		const extensionPkg = JSON.parse(await readFile(`./${EXTENSION_DIR}/package.json`, "utf-8"));
		if (extensionPkg.version !== version) {
			console.error(`❌ The extension is at ${extensionPkg.version}, not ${version}. Aborting before the tag.`);
			process.exit(1);
		}
		const vsix = `${EXTENSION_DIR}/gram-lang-${version}.vsix`;
		const packaged = spawnSync("bun", ["run", "--cwd", EXTENSION_DIR, "package"], { stdio: "inherit" });
		if (packaged.status !== 0) {
			console.error("❌ Could not package the extension. Aborting before the tag.");
			process.exit(packaged.status ?? 1);
		}
		const published = runOvsx(["publish", "--packagePath", vsix, "--skip-duplicate"], ovsxToken);
		if (published.status !== 0) {
			console.error("❌ Open VSX publication failed. Aborting: git tag was not pushed and Forgejo release was not created.");
			console.error("npm packages and an Open VSX version already published are skipped on re-run: run `bun run release` again.");
			process.exit(published.status ?? 1);
		}
		console.log(`✓ Published ${vsix} to Open VSX.`);
		console.log("ℹ️  The VS Code Marketplace is still published by hand from this same .vsix.");
	} else if (options.skipOvsx) {
		console.log("\n⏭️  Skipping Open VSX publish (--skip-ovsx).");
	}

	// 10. Create git tag if it doesn't already exist
	const existingTags = run("git tag -l").split("\n");
	if (!existingTags.includes(tag)) {
		console.log(`🏷️  Creating git tag ${tag}...`);
		run(`git tag -a ${tag} -m "chore: release ${tag}"`);
	} else {
		console.log(`ℹ️  Git tag ${tag} already exists locally.`);
	}

	// 11. Push commit and tags to origin
	console.log("🚀 Pushing to origin...");
	run("git push origin main --tags", { stdio: "inherit" });

	// 12. Create release on Forgejo via tea
	console.log("📢 Creating release on Forgejo via `tea`...");
	const teaArgs = [
		"release",
		"create",
		"--tag", tag,
		"--title", tag,
		"--note", notes,
	];
	if (options.draft) {
		teaArgs.push("--draft");
	}

	const teaResult = spawnSync("tea", teaArgs, { stdio: "inherit" });
	if (teaResult.status !== 0) {
		console.error("❌ Failed to create release via tea.");
		process.exit(teaResult.status ?? 1);
	}

	console.log(`\n🎉 Successfully published release ${tag} on Forgejo!`);
	console.log("📡 Forgejo workflow 'mirror-release.yml' will automatically sync the release to GitHub and Codeberg.");
}

if (import.meta.main) {
	main().catch((err) => {
		console.error("Unexpected error during release:", err);
		process.exit(1);
	});
}
