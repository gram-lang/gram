import readChangesets from "@changesets/read";
import { read as readConfig } from "@changesets/config";
// @ts-ignore
import assembleReleasePlan from "@changesets/assemble-release-plan";
import { getPackages } from "@manypkg/get-packages";
import { writeFile, readFile } from "node:fs/promises";
import fs from "node:fs";

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

    const config = await readConfig(cwd, packages);
    const releasePlan = assembleReleasePlan(changesets, packages, config, []);

    // 2. Safely resolve the clean version number
    const mainRelease = releasePlan.releases.find(r => r.name === "gram-lang") || releasePlan.releases[0];
    let nextVersion = mainRelease?.newVersion || "0.0.0";

    // 2.b Filter changesets already published in previous pre-releases
    let changesetsForNote = changesets;
    try {
        const preJson = JSON.parse(await readFile(`${cwd}/.changeset/pre.json`, "utf-8"));
        nextVersion = nextVersion.replace("-undefined.", `-${preJson.tag}.`);
        const releasedChangesets = new Set(preJson.changesets);
        changesetsForNote = changesets.filter(cs => !releasedChangesets.has(cs.id));
    } catch (e) {
        // ignore
    }

    // 3. Initialize the markdown block
    let newReleaseMarkdown = `## [${nextVersion}] - ${new Date().toLocaleDateString('en-US')}\n\n`;

    const majorChanges: string[] = [];
    const minorChanges: string[] = [];
    const patchChanges: string[] = [];

    // Extracted sections mapping
    const extractedSections: Record<string, string[]> = {};

    // 4. Categorize based on the *individual changeset intent* rather than the global package bump type
    for (const cs of changesetsForNote) {
        const types = cs.releases.map(r => r.type);
        const bumpType = types.includes("major") ? "major" : types.includes("minor") ? "minor" : "patch";

        const lines = cs.summary.trim().split("\n");
        let currentSection = "";
        let titleParts: string[] = [];

        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;

            const headingMatch = trimmed.match(/^\*\*([^\*]+)\*\*[:]*\s*$/);
            if (headingMatch) {
                let sectionName = headingMatch[1].trim().replace(/:$/, '').trim();
                // Normalize some common names
                if (sectionName.match(/breaking/i)) sectionName = "Breaking";
                else if (sectionName.match(/fixed/i) || sectionName.match(/^fix$/i)) sectionName = "Fixed";
                
                currentSection = sectionName;
                if (!extractedSections[currentSection]) extractedSections[currentSection] = [];
            } else {
                if (!currentSection) {
                    titleParts.push(trimmed);
                } else {
                    let item = trimmed;
                    if (!item.startsWith("- ")) {
                        item = item.replace(/^[-*]\s*/, ""); // strip existing bullet if any
                        item = `- ${item}`;
                    }
                    extractedSections[currentSection].push(item);
                }
            }
        }

        const title = titleParts.join(" ");
        if (title) {
            let formattedTitle = title.startsWith("-") ? title : `- ${title}`;
            if (bumpType === "major") majorChanges.push(formattedTitle);
            else if (bumpType === "minor") minorChanges.push(formattedTitle);
            else patchChanges.push(formattedTitle);
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