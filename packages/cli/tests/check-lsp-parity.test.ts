import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { EDITOR_HIDDEN_CODES } from "@gram-lang/modules/lint";
import { Client } from "../../language-server/tests/helpers/lsp-client";

/*
 * The editor and `gram check` read the same `lintDocument` list: on one
 * file, with a `@use` dependency, an ingredient database named by
 * `database:` and `lint.rules` in `.gram/config.yaml`, the language server
 * (the real `dist/server.cjs`, over stdio) and `gram check --format json`
 * (the real CLI) give the same codes, severities and positions. The only
 * difference is the editor's: it hides the codes with no position listed in
 * `EDITOR_HIDDEN_CODES`.
 */

const ENTRY = join(import.meta.dir, "..", "src", "index.ts");

const CONFIG = `database: data/ingredients.yaml
lint:
  rules:
    UNKNOWN_INGREDIENT: warning
    SUSPECT_INGREDIENT_NAME: "off"
`;

const DB = `flour:
  name: Flour
sugar:
  name: Sugar
butter:
  name: Butter
`;

const BASE = "## Dough ->&dough\n\nMix @flour{1 cup 5 tbsp}.\n";

const RECIPE = `---
servings: 4
---

@use "./bases/dough.gram" as &dough

## Garnish

Mélanger 🧈 @sugr{50 g} et &dough, puis @butter{20 g} // ou @lard{20 g}.

Attendre ~{15%min}.
[Bake] &crumble.

Mix @dark chocolate, chopped{200 g}.
`;

let project: string;
let recipe: string;

beforeAll(async () => {
	project = await mkdtemp(join(tmpdir(), "gram-check-parity-"));
	await mkdir(join(project, ".gram"), { recursive: true });
	await mkdir(join(project, "data"), { recursive: true });
	await mkdir(join(project, "bases"), { recursive: true });
	await writeFile(join(project, ".gram", "config.yaml"), CONFIG);
	await writeFile(join(project, "data", "ingredients.yaml"), DB);
	await writeFile(join(project, "bases", "dough.gram"), BASE);
	recipe = join(project, "tarte.gram");
	await writeFile(recipe, RECIPE);
});

afterAll(async () => {
	await rm(project, { recursive: true, force: true });
});

const SEVERITIES = ["", "error", "warning", "info", "hint"];

interface LspDiagnostic {
	code: string;
	severity: number;
	range: {
		start: { line: number; character: number };
		end: { line: number; character: number };
	};
}

interface JsonDiagnostic {
	code: string;
	severity: string;
	line?: number;
	col?: number;
	endLine?: number;
	endCol?: number;
}

/** `CODE severity line:col-line:col`, from 0, as the editor places it. */
const fromLsp = (d: LspDiagnostic) =>
	`${d.code} ${SEVERITIES[d.severity]} ${d.range.start.line}:${d.range.start.character}-${d.range.end.line}:${d.range.end.character}`;

/** The same, from the JSON report (from 1); no position is the top of the file. */
const fromJson = (d: JsonDiagnostic) =>
	d.line === undefined
		? `${d.code} ${d.severity} 0:0-0:1`
		: `${d.code} ${d.severity} ${d.line - 1}:${d.col! - 1}-${d.endLine! - 1}:${d.endCol! - 1}`;

describe("gram check and the language server", () => {
	it("give the same codes, severities and positions on one file", async () => {
		const run = Bun.spawnSync(
			[process.execPath, ENTRY, "check", "tarte.gram", "--format", "json"],
			{ cwd: project },
		);
		const report = JSON.parse(new TextDecoder().decode(run.stdout));
		const cli = (report.diagnostics as JsonDiagnostic[])
			.filter((d) => d.line !== undefined || !EDITOR_HIDDEN_CODES.has(d.code))
			.map(fromJson)
			.sort();

		const uri = pathToFileURL(recipe).href;
		const client = new Client();
		try {
			await client.start(
				{ views: false },
				{ capabilities: {}, root: pathToFileURL(project).href, rootOnly: true },
			);
			client.open(await readFile(recipe, "utf-8"), uri);
			const lsp = (
				(await client.diagnosticsOf(
					uri,
					(d) => d.length > 0,
				)) as unknown as LspDiagnostic[]
			)
				.map(fromLsp)
				.sort();

			// The fixture exercises what can tell them apart.
			const codes = new Set(cli.map((d) => d.split(" ")[0]));
			for (const code of [
				"UNKNOWN_INGREDIENT", // the database, by `database:`
				"INVALID_UNIT", // raised in the dependency, on the @use line
				"LOST_INGREDIENT",
				"MERGED_STEP_LINE",
				"DEPRECATED_FRONTMATTER_KEY",
				"MISSING_TITLE", // no position
			])
				expect(codes).toContain(code);
			expect(cli.some((d) => d.startsWith("UNKNOWN_INGREDIENT warning"))).toBe(
				true,
			);
			expect(codes).not.toContain("SUSPECT_INGREDIENT_NAME");

			expect(lsp).toEqual(cli);
		} finally {
			await client.shutdown();
		}
	}, 20_000);
});
