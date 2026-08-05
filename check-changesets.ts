#!/usr/bin/env bun
// Read-only pre-release checklist: previews how the pending .changeset/*.md
// files will land in CHANGELOG.md — bump type, cleaned title, and any likely
// duplicates against each other or recent release history — without writing
// anything or touching versions. Run this before `bun run version-packages`,
// fix whatever it flags, then release.

import readChangesets from "@changesets/read";
import { read as readConfig } from "@changesets/config";
import { getPackages } from "@manypkg/get-packages";
import { readFile } from "node:fs/promises";
import {
	parseChangesetSummary,
	findLikelyDuplicates,
	extractRecentChangelogLines,
	filterUnreleasedChangesets,
} from "./changeset-utils";

async function main() {
	const cwd = process.cwd();

	const rawPackages = await getPackages(cwd);
	const packages = {
		...rawPackages,
		root: rawPackages.root || rawPackages.rootPackage || { dir: cwd },
	};
	const allChangesets = await readChangesets(cwd);
	await readConfig(cwd, packages); // validates .changeset/config.json exists and is well-formed

	let preState: { changesets: string[]; tag?: string } | undefined;
	try {
		preState = JSON.parse(await readFile(`${cwd}/.changeset/pre.json`, "utf-8"));
	} catch (e) {
		// not in prerelease mode — nothing to filter out
	}
	const changesets = filterUnreleasedChangesets(allChangesets, preState);

	if (changesets.length === 0) {
		console.log("No pending changesets.");
		return;
	}

	console.log(`${changesets.length} pending changeset${changesets.length === 1 ? "" : "s"}${preState ? ` (${allChangesets.length - changesets.length} already released in a previous ${preState.tag ?? "pre"}-release, excluded)` : ""}:\n`);

	const titles: string[] = [];
	for (const cs of changesets) {
		const bumpType = cs.releases.some((r) => r.type === "major")
			? "major"
			: cs.releases.some((r) => r.type === "minor")
				? "minor"
				: "patch";
		const { head, sections } = parseChangesetSummary(cs.summary);

		console.log(`[${bumpType}] ${cs.id}`);
		console.log(`  ${head || "(no title parsed — check formatting)"}`);
		for (const [sectionName, items] of Object.entries(sections)) {
			console.log(`  ${sectionName}: ${items.length} item${items.length === 1 ? "" : "s"}`);
		}
		console.log("");

		if (head) titles.push(head);
	}

	let existingContent = "";
	try {
		existingContent = await readFile("./CHANGELOG.md", "utf-8");
	} catch (e) {
		// no changelog yet — nothing to compare against
	}

	const warnings = findLikelyDuplicates(titles, extractRecentChangelogLines(existingContent));
	if (warnings.length === 0) {
		console.log("No likely duplicates detected.");
	} else {
		console.log(`⚠️  ${warnings.length} possible duplicate${warnings.length === 1 ? "" : "s"}:\n`);
		for (const w of warnings) {
			console.log(`  - "${w.title}"\n    ~ "${w.matchedAgainst}" (${Math.round(w.similarity * 100)}% word overlap)\n`);
		}
	}
}

main().catch(console.error);
