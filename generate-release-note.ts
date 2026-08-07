import readChangesets from "@changesets/read";
import { read as readConfig } from "@changesets/config";
// @ts-ignore
import assembleReleasePlan from "@changesets/assemble-release-plan";
import { getPackages } from "@manypkg/get-packages";
import { writeFile, readFile } from "node:fs/promises";
import fs from "node:fs";
import { execSync } from "node:child_process";
import { parseChangesetSummary, findLikelyDuplicates, extractRecentChangelogLines, filterUnreleasedChangesets } from "./changeset-utils";

const REPO_COMPARE_URL = "https://git.gram-lang.org/gram-lang/gram/compare";

function getPreviousTag(): string | undefined {
    try {
        return execSync("git describe --tags --abbrev=0", { encoding: "utf-8" }).trim();
    } catch (e) {
        return undefined;
    }
}

async function main() {
    const cwd = process.cwd();

    // 1. Read all packages in the monorepo and pending changesets
    const rawPackages = await getPackages(cwd);
    const packages = {
        ...rawPackages,
        root: rawPackages.root || rawPackages.rootPackage || { dir: cwd }
    };
    const changesets = await readChangesets(cwd);

    if (changesets.length === 0) {
        console.log("⚠️ No pending changesets found.");
        return;
    }

    let preState: any = undefined;
    try {
        preState = JSON.parse(await readFile(`${cwd}/.changeset/pre.json`, "utf-8"));
    } catch (e) {
        // ignore
    }

    const config = await readConfig(cwd, packages);
    const releasePlan = assembleReleasePlan(changesets, packages, config, preState);

    // 2. Safely resolve the clean version number
    const mainRelease = releasePlan.releases.find(r => r.name === "@gram-lang/kitchen") || releasePlan.releases.find(r => r.name === "gram-lang") || releasePlan.releases[0];
    let nextVersion = mainRelease?.newVersion || "0.0.0";

    // 2.b Filter changesets already published in previous pre-releases
    const changesetsForNote = filterUnreleasedChangesets(changesets, preState);

    // 2.c Read the existing CHANGELOG.md once — used both for duplicate
    // detection against recent history and for the final prepend.
    const changelogPath = "./CHANGELOG.md";
    let existingContent = "";
    try {
        existingContent = await readFile(changelogPath, "utf-8");
        existingContent = existingContent.replace("# Changelog\n\n", "");
    } catch (e) {
        existingContent = "";
    }

    // 3. Initialize the markdown block. The heading links to a compare view
    // against the previous tag, so readers can see the exact commit range —
    // there's no PR-based workflow here to link back to instead.
    const previousTag = getPreviousTag();
    const newTag = `v.${nextVersion}`;
    const versionHeading = previousTag
        ? `[${nextVersion}](${REPO_COMPARE_URL}/${previousTag}...${newTag})`
        : `[${nextVersion}]`;
    let newReleaseMarkdown = `## ${versionHeading} - ${new Date().toISOString().split('T')[0]}\n\n`;

    const majorChanges: string[] = [];
    const minorChanges: string[] = [];
    const patchChanges: string[] = [];
    const newTitlesForDupeCheck: string[] = [];

    // Extracted sections mapping
    const extractedSections: Record<string, string[]> = {};

    // 4. Categorize based on the *individual changeset intent* rather than the global package bump type
    for (const cs of changesetsForNote) {
        const types = cs.releases.map(r => r.type);
        const bumpType = types.includes("major") ? "major" : types.includes("minor") ? "minor" : "patch";

        const { formattedEntry, head, sections } = parseChangesetSummary(cs.summary);

        for (const [sectionName, items] of Object.entries(sections)) {
            if (!extractedSections[sectionName]) extractedSections[sectionName] = [];
            extractedSections[sectionName].push(...items);
        }

        if (formattedEntry) {
            newTitlesForDupeCheck.push(head);
            if (bumpType === "major") majorChanges.push(formattedEntry);
            else if (bumpType === "minor") minorChanges.push(formattedEntry);
            else patchChanges.push(formattedEntry);
        }
    }

    // 4.b Flag likely duplicates against this batch and recent release history,
    // so overlapping changesets can be merged before they're locked into
    // CHANGELOG.md — much easier here than after the fact.
    const duplicateWarnings = findLikelyDuplicates(
        newTitlesForDupeCheck,
        extractRecentChangelogLines(existingContent),
    );
    if (duplicateWarnings.length > 0) {
        console.warn(`\n⚠️  ${duplicateWarnings.length} possible duplicate changelog entr${duplicateWarnings.length === 1 ? "y" : "ies"} detected — review before publishing:\n`);
        for (const w of duplicateWarnings) {
            console.warn(`  - "${w.title}"\n    ~ "${w.matchedAgainst}" (${Math.round(w.similarity * 100)}% word overlap)\n`);
        }
    }

    // 5. Structure the release content hierarchically
    if (majorChanges.length > 0) {
        newReleaseMarkdown += `### 🚨 Major Changes\n${majorChanges.join("\n")}\n\n`;
    }
    if (minorChanges.length > 0) {
        newReleaseMarkdown += `### ✨ New Features\n${minorChanges.join("\n")}\n\n`;
    }
    if (patchChanges.length > 0) {
        newReleaseMarkdown += `### 🐛 Bug Fixes & Improvements\n${patchChanges.join("\n")}\n\n`;
    }

    // Append unified sections
    const prioritySections = ["Breaking", "Fixed", "New syntax", "Kitchen", "Analyzer", "Docs"];
    const allSections = Object.keys(extractedSections);
    
    // Sort sections: priority ones first, then alphabetical
    allSections.sort((a, b) => {
        const indexA = prioritySections.indexOf(a);
        const indexB = prioritySections.indexOf(b);
        if (indexA !== -1 && indexB !== -1) return indexA - indexB;
        if (indexA !== -1) return -1;
        if (indexB !== -1) return 1;
        return a.localeCompare(b);
    });

    for (const sec of allSections) {
        if (extractedSections[sec].length > 0) {
            const emoji = sec === "Breaking" ? "💥" : sec === "Fixed" ? "🛠️" : "📌";
            newReleaseMarkdown += `#### ${emoji} ${sec}\n${extractedSections[sec].join("\n")}\n\n`;
        }
    }

    // 6. Prepend to the root CHANGELOG.md (existingContent was read in step 2.c)
    const finalChangelogContent = `# Changelog\n\n${newReleaseMarkdown}---\n\n${existingContent}`.trim() + "\n";

    await writeFile(changelogPath, finalChangelogContent, "utf-8");
    console.log(`✨ Version [${nextVersion}] successfully prepended to the root CHANGELOG.md!`);
}

main().catch(console.error);