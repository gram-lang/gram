import readChangesets from "@changesets/read";
import { read as readConfig } from "@changesets/config";
// @ts-ignore
import assembleReleasePlan from "@changesets/assemble-release-plan";
import { getPackages } from "@manypkg/get-packages";
import { writeFile, readFile } from "node:fs/promises";

async function main() {
    const cwd = process.cwd();

    // 1. Read all packages in the monorepo and pending changesets
    const packages = await getPackages(cwd);
    const changesets = await readChangesets(cwd);

    if (changesets.length === 0) {
        console.log("⚠️ No pending changesets found.");
        return;
    }

    const config = await readConfig(cwd, packages);
    const releasePlan = assembleReleasePlan(changesets, packages, config, []);

    // 2. Safely resolve the clean version number
    // We target your main package and clean up any pre-release leftovers if present
    const compilerRelease = releasePlan.releases.find(r => r.name === "@gram/compiler");
    let nextVersion = compilerRelease?.newVersion || "0.0.0";
    if (nextVersion.includes("-")) {
        nextVersion = nextVersion.split("-")[0]; // Cleans "0.9.0-undefined.0" -> "0.9.0"
    }

    // 3. Initialize the markdown block
    let newReleaseMarkdown = `## [${nextVersion}] - ${new Date().toLocaleDateString('en-US')}\n\n`;

    const majorChanges: string[] = [];
    const minorChanges: string[] = [];
    const patchChanges: string[] = [];

    // 4. Categorize based on the *individual changeset intent* rather than the global package bump type
    for (const cs of changesets) {
        const cleanSummary = cs.summary.trim();

        // Find the highest release type inside this specific changeset's releases array
        const types = cs.releases.map(r => r.type);

        if (types.includes("major")) {
            majorChanges.push(`- ${cleanSummary}`);
        } else if (types.includes("minor")) {
            minorChanges.push(`- ${cleanSummary}`);
        } else {
            patchChanges.push(`- ${cleanSummary}`);
        }
    }

    // 5. Structure the release content hierarchically
    if (majorChanges.length > 0) {
        newReleaseMarkdown += `### 🚨 Major Changes (Breaking Changes)\n${majorChanges.join("\n")}\n\n`;
    }
    if (minorChanges.length > 0) {
        newReleaseMarkdown += `### ✨ New Features\n${minorChanges.join("\n")}\n\n`;
    }
    if (patchChanges.length > 0) {
        newReleaseMarkdown += `### 🐛 Bug Fixes & Improvements\n${patchChanges.join("\n")}\n\n`;
    }

    // 6. Handle global root CHANGELOG history (Prepend mechanism)
    const changelogPath = "./CHANGELOG.md";
    let existingContent = "";

    try {
        existingContent = await readFile(changelogPath, "utf-8");
        existingContent = existingContent.replace("# Changelog\n\n", "");
    } catch (e) {
        existingContent = "";
    }

    const finalChangelogContent = `# Changelog\n\n${newReleaseMarkdown}---\n\n${existingContent}`.trim() + "\n";

    await writeFile(changelogPath, finalChangelogContent, "utf-8");
    console.log(`✨ Version [${nextVersion}] successfully prepended to the root CHANGELOG.md!`);
}

main().catch(console.error);