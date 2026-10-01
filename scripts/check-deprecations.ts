#!/usr/bin/env bun
// Deprecation registry checker for Gram.
//
//   bun run deprecations         report: what is deprecated and what ships in the next major
//   bun run deprecations:check   CI gate: silent when clean, exit 1 on any error
//   ... --json                   machine-readable report (same exit codes)
//
// It cross-checks `deprecations.yaml` against the markers in the source
// (`@deprecated ... (Ref: id)`, `// @remove-in: X.Y.Z [id]`,
// `// @conformance-legacy-fixture [id]`), in both directions, so the registry
// and the code cannot drift apart. See .agents/skills/deprecation-sentinel.

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import yaml from "js-yaml";

const LAYERS = ["syntax", "ast", "compiled-json", "analyzed-json", "api", "cli", "renderer"] as const;
const STATUSES = ["active", "planned", "removed"] as const;

type Layer = (typeof LAYERS)[number];
type Status = (typeof STATUSES)[number];

interface DeprecationEntry {
	id: string;
	layer: Layer;
	deprecatedIn?: string;
	targetRemoval: string;
	status: Status;
	description: string;
	replacement: string;
	/** Compiler warning raised for the deprecated form. Required for an active `syntax` entry. */
	warningCode?: string;
	/** A removal chore users never see (e.g. internal code reading a deprecated field): tracked, but not announced. */
	internal?: boolean;
	/** What rewrites the old form: a `gram migrate` codemod id, or `manual`. Required for an active `syntax` entry. */
	migration?: string;
	files?: string[];
}

interface Semver {
	major: number;
	minor: number;
	patch: number;
	prerelease?: string;
	raw: string;
}

type MarkerKind = "deprecated" | "remove-in" | "legacy-fixture";

interface Marker {
	kind: MarkerKind;
	id: string;
	file: string;
	line: number;
	/** Only for `@remove-in`: the version written in the marker. */
	version?: string;
}

const ROOT = resolve(import.meta.dir, "..");
const ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SKIPPED_DIRS = new Set(["node_modules", "dist", ".vitepress", ".astro", ".turbo", ".git"]);
const SCANNED_EXTENSIONS = /\.(?:ts|tsx|mts|cts)$/;

function parseSemver(v: string): Semver {
	const match = v.trim().match(/^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/);
	if (!match) throw new Error(`invalid semver "${v}"`);
	return {
		major: Number.parseInt(match[1], 10),
		minor: Number.parseInt(match[2], 10),
		patch: Number.parseInt(match[3], 10),
		prerelease: match[4],
		raw: v,
	};
}

/** Orders by major.minor.patch; a prerelease sorts before its release. */
function compareSemver(a: Semver, b: Semver): number {
	if (a.major !== b.major) return a.major - b.major;
	if (a.minor !== b.minor) return a.minor - b.minor;
	if (a.patch !== b.patch) return a.patch - b.patch;
	if (!a.prerelease && b.prerelease) return 1;
	if (a.prerelease && !b.prerelease) return -1;
	return 0;
}

// The monorepo versions its packages in lockstep (`fixed` in .changeset/config.json).
function getCurrentVersion(): Semver {
	const pkg = JSON.parse(readFileSync(join(ROOT, "packages/kitchen/package.json"), "utf-8"));
	return parseSemver(pkg.version);
}

function validateRegistry(raw: unknown, errors: string[]): DeprecationEntry[] {
	if (!raw || typeof raw !== "object") {
		errors.push("deprecations.yaml: empty or not a YAML mapping.");
		return [];
	}
	const doc = raw as { schemaVersion?: unknown; deprecations?: unknown };
	if (doc.schemaVersion !== 1) {
		errors.push(`deprecations.yaml: unsupported schemaVersion ${JSON.stringify(doc.schemaVersion)} (expected 1).`);
	}
	if (!Array.isArray(doc.deprecations)) {
		errors.push("deprecations.yaml: `deprecations` must be a list.");
		return [];
	}

	const valid: DeprecationEntry[] = [];
	const seen = new Set<string>();
	doc.deprecations.forEach((item: unknown, index: number) => {
		const entry = (item ?? {}) as Record<string, unknown>;
		const label = typeof entry.id === "string" ? `"${entry.id}"` : `#${index + 1}`;
		const problems: string[] = [];
		const text = (key: string) => typeof entry[key] === "string" && (entry[key] as string).trim() !== "";

		if (!text("id") || !ID_PATTERN.test(entry.id as string)) problems.push("`id` must be a kebab-case slug");
		else if (seen.has(entry.id as string)) problems.push("duplicate `id`");
		else seen.add(entry.id as string);

		if (!LAYERS.includes(entry.layer as Layer)) problems.push(`\`layer\` must be one of ${LAYERS.join(", ")}`);
		if (!STATUSES.includes(entry.status as Status)) problems.push(`\`status\` must be one of ${STATUSES.join(", ")}`);
		if (!text("description")) problems.push("`description` is required");
		if (!text("replacement")) problems.push("`replacement` is required");

		let target: Semver | undefined;
		try {
			target = parseSemver(String(entry.targetRemoval));
			if (target.minor !== 0 || target.patch !== 0 || target.prerelease) {
				problems.push("`targetRemoval` must be a major (X.0.0)");
			}
		} catch {
			problems.push("`targetRemoval` must be a semver version");
		}

		if (entry.status === "planned") {
			if (entry.deprecatedIn !== undefined) {
				problems.push("a `planned` entry must not set `deprecatedIn` (set it, and `active`, when the deprecation ships)");
			}
		} else if (entry.status === "active" || entry.status === "removed") {
			try {
				const since = parseSemver(String(entry.deprecatedIn));
				if (target && compareSemver(since, target) >= 0) problems.push("`deprecatedIn` must be before `targetRemoval`");
			} catch {
				problems.push(`\`deprecatedIn\` is required for an ${entry.status} entry (a semver version)`);
			}
		}

		if (entry.internal !== undefined) {
			if (typeof entry.internal !== "boolean") problems.push("`internal` must be true or false");
			else if (entry.internal && ["syntax", "ast", "compiled-json", "analyzed-json"].includes(entry.layer as string)) {
				problems.push("`internal` cannot be used on a layer users read directly (syntax, ast, compiled-json, analyzed-json)");
			}
		}

		for (const key of ["warningCode", "migration"] as const) {
			if (entry[key] !== undefined && !text(key)) problems.push(`\`${key}\` must be a non-empty string`);
		}
		// A syntax deprecation is the only layer that reaches users through their own
		// .gram files, so it must also be flagged at runtime (compiler warning, which
		// the language server shows struck through) and say how to migrate.
		if (entry.layer === "syntax" && entry.status === "active") {
			if (entry.warningCode === undefined) problems.push("an active `syntax` entry needs a `warningCode` (the compiler warning that flags it)");
			if (entry.migration === undefined) problems.push("an active `syntax` entry needs a `migration` (a `gram migrate` codemod id, or `manual`)");
		}

		if (entry.files !== undefined && (!Array.isArray(entry.files) || entry.files.some((f) => typeof f !== "string"))) {
			problems.push("`files` must be a list of paths");
		}

		for (const p of problems) errors.push(`${label}: ${p}.`);
		if (problems.length === 0) valid.push(entry as unknown as DeprecationEntry);
	});
	return valid;
}

function* walk(dir: string): Generator<string> {
	if (!existsSync(dir)) return;
	for (const name of readdirSync(dir)) {
		if (SKIPPED_DIRS.has(name)) continue;
		const path = join(dir, name);
		const stats = statSync(path);
		if (stats.isDirectory()) yield* walk(path);
		else if (SCANNED_EXTENSIONS.test(name)) yield path;
	}
}

function scanRoots(): string[] {
	const roots = [join(ROOT, "conformance")];
	for (const pkg of readdirSync(join(ROOT, "packages"))) {
		roots.push(join(ROOT, "packages", pkg, "src"), join(ROOT, "packages", pkg, "tests"));
	}
	return roots;
}

const splitIds = (list: string) =>
	list
		.split(",")
		.map((id) => id.trim())
		.filter(Boolean);

function scanMarkers(errors: string[]): Marker[] {
	const markers: Marker[] = [];
	for (const root of scanRoots()) {
		for (const path of walk(root)) {
			const file = relative(ROOT, path);
			const lines = readFileSync(path, "utf-8").split("\n");
			lines.forEach((text, i) => {
				const line = i + 1;
				const where = `${file}:${line}`;

				if (/@deprecated\b/.test(text)) {
					const ref = text.match(/\(Ref:\s*([^)]*)\)/);
					if (!ref || splitIds(ref[1]).length === 0) {
						errors.push(`[UNTRACKED] ${where}: \`@deprecated\` without \`(Ref: <id>)\` on the same line.`);
					} else {
						for (const id of splitIds(ref[1])) markers.push({ kind: "deprecated", id, file, line });
					}
				}

				if (/@remove-in\b/.test(text)) {
					const m = text.match(/@remove-in:\s*(\d+\.\d+\.\d+)\s*\[([^\]]*)\]/);
					if (!m || splitIds(m[2]).length === 0) {
						errors.push(`[UNTRACKED] ${where}: malformed marker, expected \`@remove-in: X.Y.Z [<id>]\`.`);
					} else {
						for (const id of splitIds(m[2])) markers.push({ kind: "remove-in", id, file, line, version: m[1] });
					}
				}

				if (/@conformance-legacy-fixture\b/.test(text)) {
					const m = text.match(/@conformance-legacy-fixture\s*\[([^\]]*)\]/);
					if (!m || splitIds(m[1]).length === 0) {
						errors.push(`[UNTRACKED] ${where}: malformed marker, expected \`@conformance-legacy-fixture [<id>]\`.`);
					} else {
						for (const id of splitIds(m[1])) markers.push({ kind: "legacy-fixture", id, file, line });
					}
				}
			});
		}
	}
	return markers;
}

/** Warning codes declared as self-named enum members (`NAME = "NAME"`) in the packages. */
function scanWarningCodes(): Set<string> {
	const codes = new Set<string>();
	for (const pkg of readdirSync(join(ROOT, "packages"))) {
		for (const path of walk(join(ROOT, "packages", pkg, "src"))) {
			for (const m of readFileSync(path, "utf-8").matchAll(/^\s*([A-Z][A-Z0-9_]+)\s*=\s*"\1"/gm)) codes.add(m[1]);
		}
	}
	return codes;
}

function main() {
	const args = process.argv.slice(2);
	const asJson = args.includes("--json");
	const quiet = args.includes("--check");

	const errors: string[] = [];
	const warnings: string[] = [];

	const registryPath = join(ROOT, "deprecations.yaml");
	if (!existsSync(registryPath)) {
		console.error(`Registry file not found at: ${registryPath}`);
		process.exit(1);
	}
	const entries = validateRegistry(yaml.load(readFileSync(registryPath, "utf-8")), errors);
	const current = getCurrentVersion();
	const markers = scanMarkers(errors);
	const byId = new Map(entries.map((e) => [e.id, e]));

	// Markers -> registry: nothing in the code may be missing from the registry.
	for (const m of markers) {
		const entry = byId.get(m.id);
		const where = `${m.file}:${m.line}`;
		if (!entry) {
			errors.push(`[ORPHAN MARKER] ${where}: \`${m.id}\` is not in deprecations.yaml.`);
			continue;
		}
		if (m.version && m.version !== entry.targetRemoval) {
			errors.push(`[VERSION MISMATCH] ${where}: \`@remove-in: ${m.version}\` but "${m.id}" targets ${entry.targetRemoval}.`);
		}
		if (entry.status === "removed") {
			errors.push(`[LEAKED CODE] ${where}: "${m.id}" is marked removed, but a ${m.kind} marker is still there.`);
		} else if (entry.status === "planned" && m.kind !== "legacy-fixture") {
			errors.push(`[STATUS] ${where}: "${m.id}" is tagged in the code but still \`planned\`; set it \`active\` with its \`deprecatedIn\`.`);
		} else if (entry.files && m.kind !== "legacy-fixture" && !entry.files.includes(m.file)) {
			warnings.push(`${where}: marker for "${m.id}" is in a file missing from its \`files\` list.`);
		}
	}

	// A warning code named by an active entry must exist, or the runtime signal is a promise.
	const warningCodes = scanWarningCodes();
	for (const entry of entries) {
		if (entry.status === "active" && entry.warningCode && !warningCodes.has(entry.warningCode)) {
			errors.push(`[UNKNOWN WARNING CODE] "${entry.id}": \`${entry.warningCode}\` is not a warning code declared in packages/*/src.`);
		}
	}

	// Registry -> markers, and the removal deadline.
	for (const entry of entries) {
		const own = markers.filter((m) => m.id === entry.id && m.kind !== "legacy-fixture");

		if (entry.status !== "removed") {
			for (const file of entry.files ?? []) {
				if (!existsSync(join(ROOT, file))) {
					errors.push(`[MISSING FILE] "${entry.id}": \`${file}\` does not exist.`);
				} else if (entry.status === "active" && !own.some((m) => m.file === file)) {
					errors.push(`[NO MARKER] "${entry.id}" is active but \`${file}\` carries no marker for it.`);
				}
			}
			if (entry.status === "active" && own.length === 0) {
				errors.push(`[NO MARKER] "${entry.id}" is active but no marker for it exists in the code.`);
			}
		}

		if (entry.status !== "removed" && compareSemver(current, parseSemver(entry.targetRemoval)) >= 0) {
			errors.push(`[OVERDUE] "${entry.id}" was due for removal in v${entry.targetRemoval} (current v${current.raw}) but is still \`${entry.status}\`.`);
		}
	}

	const nextMajor = current.prerelease ? current.major : current.major + 1;
	const pending = entries.filter((e) => e.status !== "removed" && parseSemver(e.targetRemoval).major === nextMajor);
	const removedForNext = entries.filter((e) => e.status === "removed" && parseSemver(e.targetRemoval).major === nextMajor);

	if (asJson) {
		console.log(
			JSON.stringify(
				{
					currentVersion: current.raw,
					nextMajor: `${nextMajor}.0.0`,
					totalTracked: entries.length,
					pendingNextMajorCount: pending.length,
					pendingNextMajor: pending.map((e) => ({
						...e,
						markers: markers.filter((m) => m.id === e.id).length,
					})),
					errors,
					warnings,
				},
				null,
				2,
			),
		);
		process.exit(errors.length > 0 ? 1 : 0);
	}

	if (!quiet) {
		const count = (s: Status) => entries.filter((e) => e.status === s).length;
		console.log(`\nGram deprecations — current v${current.raw}, next major v${nextMajor}.0.0`);
		console.log(
			`${entries.length} tracked: ${count("active")} active, ${count("planned")} planned, ${count("removed")} removed\n`,
		);
		console.log(`Removals for v${nextMajor}.0.0: ${pending.length} pending, ${removedForNext.length} done`);
		if (current.prerelease && pending.length > 0) {
			console.log(`  (prerelease: not blocking, but the stable v${nextMajor}.0.0 will not pass the gate until these are removed)`);
		}
		for (const dep of pending) {
			const tag = dep.status === "active" ? "active " : "planned";
			const n = markers.filter((m) => m.id === dep.id && m.kind !== "legacy-fixture").length;
			console.log(`  [${tag}] ${dep.id} (${dep.layer}${dep.internal ? ", internal" : ""}, ${n} marker${n === 1 ? "" : "s"})`);
			console.log(`      ${dep.description}`);
			console.log(`      -> ${dep.replacement}`);
			if (dep.warningCode || dep.migration) {
				console.log(`      warning: ${dep.warningCode ?? "-"}, migration: ${dep.migration ?? "-"}`);
			}
		}
		console.log("");
	}

	for (const w of warnings) console.warn(`warning: ${w}`);
	if (errors.length > 0) {
		for (const e of errors) console.error(`error: ${e}`);
		console.error(`\nDeprecation check failed (${errors.length} error${errors.length === 1 ? "" : "s"}).`);
		process.exit(1);
	}
	console.log(`deprecations: ${entries.length} tracked, ${markers.length} markers, no drift.`);
}

main();
