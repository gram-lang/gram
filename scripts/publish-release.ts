#!/usr/bin/env bun
// Safe release publisher: verifies git status, extracts release notes from CHANGELOG.md,
// creates the annotated git tag, pushes to origin, and publishes the release on Forgejo via `tea`.

import { execSync, spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";

interface ReleaseOptions {
	dryRun: boolean;
	draft: boolean;
	yes: boolean;
	skipChecks: boolean;
	targetVersion?: string;
}

function parseArgs(): ReleaseOptions {
	const args = process.argv.slice(2);
	return {
		dryRun: args.includes("--dry-run"),
		draft: args.includes("--draft") || args.includes("-d"),
		yes: args.includes("--yes") || args.includes("-y"),
		skipChecks: args.includes("--skip-checks") || args.includes("--skip-ci"),
		targetVersion: args.find((a) => !a.startsWith("-")),
	};
}

function run(cmd: string, options: { stdio?: "inherit" | "pipe" } = { stdio: "pipe" }): string {
	try {
		return execSync(cmd, { encoding: "utf-8", stdio: options.stdio }).trim();
	} catch (error: any) {
		if (options.stdio === "pipe" && error.stderr) {
			console.error(error.stderr.toString());
		}
		throw error;
	}
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

	// 2. Check git branch is main
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

	// 3. Check git worktree is clean
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

	// 4. Run quality checks unless skipped
	if (!options.skipChecks && !options.dryRun) {
		console.log("\n🧪 Running quality gates (lint, typecheck, tests, conformance)...");
		try {
			execSync("bun run ci", { stdio: "inherit" });
			console.log("✓ All quality gates passed.\n");
		} catch {
			console.error("\n❌ Quality gates failed. Aborting release.");
			process.exit(1);
		}
	}

	// 5. Determine version and tag name
	const version = options.targetVersion || await getVersionFromPackages();
	const tag = `v.${version}`;
	console.log(`\n📦 Target version: ${version} (Git tag: ${tag})`);

	// 6. Extract release notes from CHANGELOG.md
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
		console.log(`  1. git tag -a ${tag} -m "chore: release ${tag}"`);
		console.log(`  2. git push origin main --tags`);
		console.log(`  3. tea release create --tag "${tag}" --title "${tag}" --note "<extracted notes>"${options.draft ? " --draft" : ""}`);
		console.log("\nDry run completed successfully. No changes were made.");
		return;
	}

	// 7. Ask for explicit user confirmation
	if (!options.yes) {
		const rl = createInterface({ input: stdin, output: stdout });
		const promptMsg = options.draft
			? `Publish release ${tag} as DRAFT on Forgejo? (y/N): `
			: `Publish release ${tag} on Forgejo? (y/N): `;
		const answer = await rl.question(promptMsg);
		rl.close();

		if (answer.toLowerCase() !== "y") {
			console.log("Release cancelled by user.");
			process.exit(0);
		}
	}

	// 8. Create git tag if it doesn't already exist
	const existingTags = run("git tag -l").split("\n");
	if (!existingTags.includes(tag)) {
		console.log(`🏷️  Creating git tag ${tag}...`);
		run(`git tag -a ${tag} -m "chore: release ${tag}"`);
	} else {
		console.log(`ℹ️  Git tag ${tag} already exists locally.`);
	}

	// 9. Push commit and tags to origin
	console.log("🚀 Pushing to origin...");
	run("git push origin main --tags", { stdio: "inherit" });

	// 10. Create release on Forgejo via tea
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
