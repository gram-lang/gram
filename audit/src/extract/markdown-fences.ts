import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import {
	AI_GENERATION_NOTES_FILES,
	DOCS_EXCLUDE_DIRS,
	DOCS_ROOTS,
	REPO_ROOT,
	TRUSTED_SYNTAX_FILES,
} from "../config";
import type { Snippet, SourceKind } from "../types";

interface Fence {
	content: string;
	line: number;
}

function extractFences(text: string): Fence[] {
	const lines = text.split("\n");
	const fences: Fence[] = [];
	let inFence = false;
	let fenceStart = 0;
	let buffer: string[] = [];

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i]!;
		if (!inFence && line.trim().startsWith("```gram")) {
			inFence = true;
			fenceStart = i + 2; // fence body starts on the next line (1-indexed)
			buffer = [];
			continue;
		}
		if (inFence && line.trim() === "```") {
			inFence = false;
			fences.push({ content: `${buffer.join("\n")}\n`, line: fenceStart });
			continue;
		}
		if (inFence) buffer.push(line);
	}
	return fences;
}

function walkMarkdownFiles(root: string): string[] {
	const absRoot = join(REPO_ROOT, root);
	if (!existsSync(absRoot)) return [];
	const stat = statSync(absRoot);
	if (stat.isFile()) return absRoot.endsWith(".md") ? [absRoot] : [];

	const results: string[] = [];
	const stack = [absRoot];
	while (stack.length > 0) {
		const dir = stack.pop()!;
		if (DOCS_EXCLUDE_DIRS.some((excluded) => dir.includes(excluded))) continue;
		for (const entry of readdirSync(dir, { withFileTypes: true })) {
			const full = join(dir, entry.name);
			if (entry.isDirectory()) {
				if (DOCS_EXCLUDE_DIRS.some((excluded) => full.includes(excluded))) continue;
				stack.push(full);
			} else if (entry.name.endsWith(".md")) {
				results.push(full);
			}
		}
	}
	return results;
}

// Trusted-corpus fences (reference/syntax/*.md, EN+FR, excluding
// ai-generation-notes.md which is handled by extract/self-test-cases.ts) —
// the known-good vocabulary source for checks/vocabulary + calibration.
export function extractTrustedCorpusFences(): Snippet[] {
	return extractFromFileList(TRUSTED_SYNTAX_FILES, "trusted-corpus");
}

function extractFromFileList(relFiles: string[], sourceKind: SourceKind): Snippet[] {
	const snippets: Snippet[] = [];
	for (const relPath of relFiles) {
		const absPath = join(REPO_ROOT, relPath);
		if (!existsSync(absPath)) continue;
		const text = readFileSync(absPath, "utf-8");
		for (const fence of extractFences(text)) {
			snippets.push({
				id: `${relPath}:${fence.line}`,
				sourceKind,
				file: relPath,
				line: fence.line,
				content: fence.content,
				expectation: "must-parse",
			});
		}
	}
	return snippets;
}

// Every other ```gram fence in the docs (+ root README.md) — audit targets,
// not trust sources. Anything already claimed by the trusted corpus or the
// ai-generation-notes.md self-test set is skipped so it isn't double-counted.
export function extractNonTrustedDocsFences(): Snippet[] {
	const excluded = new Set([...TRUSTED_SYNTAX_FILES, ...AI_GENERATION_NOTES_FILES]);
	const snippets: Snippet[] = [];

	for (const root of DOCS_ROOTS) {
		for (const absPath of walkMarkdownFiles(root)) {
			const relPath = relative(REPO_ROOT, absPath);
			if (excluded.has(relPath)) continue;
			const text = readFileSync(absPath, "utf-8");
			for (const fence of extractFences(text)) {
				snippets.push({
					id: `${relPath}:${fence.line}`,
					sourceKind: "docs-fence-nontrusted",
					file: relPath,
					line: fence.line,
					content: fence.content,
					expectation: "must-parse",
				});
			}
		}
	}
	return snippets;
}
