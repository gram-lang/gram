import { describe, expect, it } from "bun:test";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

/*
 * The reference editor configurations of `editors/` (shown as-is on the
 * "Supported editors" docs page) honor the contract of a non-VS Code client:
 * the `gram-language-server --stdio` binary (or `gram lsp`), `views: false`,
 * and the `.gram` extension and `//` comments wherever the format carries them.
 * The Tree-sitter colors of Helix and Neovim build tree-sitter-gram at one
 * pinned commit, the same in both.
 */

const REPO = join(import.meta.dir, "../../..");
const EDITORS_DIR = join(REPO, "editors");
const DOCS = join(REPO, "packages/docs/src/content/docs");
const PAGES = {
	en: join(DOCS, "docs/reference/tooling/editors.mdx"),
	fr: join(DOCS, "fr/docs/reference/tooling/editors.mdx"),
};

const TREE_SITTER_GRAM = "https://github.com/gram-lang/tree-sitter-gram";

// `"gram-language-server", "--stdio"` in a list, Helix's `command` + `args`, or `gram lsp`.
const COMMAND =
	/gram-language-server["']?\s*,?\s*["']--stdio["']|gram-language-server"\s*\nargs\s*=\s*\["--stdio"\]|["']gram["']\s*,?\s*["']lsp["']/;

interface EditorFile {
	/** Path under `editors/`. */
	path: string;
	/** Starts the server (JetBrains: typed in a dialog, described by the docs). */
	command: boolean;
	/** `views` set to false in the editor's own syntax. */
	viewsOff?: RegExp;
	/** Anything else the file must contain (extension, comments...). */
	contains: RegExp[];
	/** Parsed as JSON: the check runs on the value. */
	json?: (value: unknown) => void;
}

const EDITORS: EditorFile[] = [
	{
		path: "neovim/gram.lua",
		command: true,
		viewsOff: /init_options\s*=\s*\{[^}]*\bviews\s*=\s*false/,
		contains: [
			/extension\s*=\s*\{\s*gram\s*=\s*"gram"/,
			/commentstring\s*=\s*"\/\/ %s"/,
			// Snippet completions: `@Wheat flour{}`, cursor between the braces.
			/vim\.lsp\.completion\.enable\(true,\s*client\.id/,
			/completeopt\s*=\s*"menu,menuone,noinsert"/,
		],
	},
	{
		path: "neovim/gram-treesitter.lua",
		command: false,
		contains: [
			/vim\.treesitter\.language\.add\("gram"\)/,
			/vim\.treesitter\.start\(ev\.buf,\s*"gram"\)/,
			/foldexpr\s*=\s*"v:lua\.vim\.treesitter\.foldexpr\(\)"/,
		],
	},
	{
		path: "neovim/build-parser.sh",
		command: false,
		contains: [
			/REV="[0-9a-f]{40}"/,
			/\$NVIM\/parser\/gram\.so/,
			// Neovim's own queries, not those of helix/ or zed/.
			/cp "\$src"\/queries\/\*\.scm "\$NVIM\/queries\/gram\/"/,
		],
	},
	{
		path: "helix/languages.toml",
		command: true,
		viewsOff: /config\s*=\s*\{[^}]*\bviews\s*=\s*false/,
		contains: [
			/file-types\s*=\s*\["gram"\]/,
			/comment-tokens\s*=\s*\["\/\/"\]/,
			/\[\[grammar\]\]\s*\nname\s*=\s*"gram"/,
			/rev\s*=\s*"[0-9a-f]{40}"/,
			// Helix does not install the queries: the comment copies them.
			/grammars\/sources\/gram\/queries\/helix\/\*\.scm ~\/\.config\/helix\/runtime\/queries\/gram\//,
		],
	},
	{
		path: "emacs/gram.el",
		command: true,
		viewsOff: /:initializationOptions\s*\(:views\s+:json-false\)/,
		contains: [
			/\\\\\.gram\\\\'/,
			/comment-start\s+"\/\/ "/,
			/eglot-server-programs/,
		],
	},
	{
		path: "sublime/LSP.sublime-settings",
		command: true,
		contains: [],
		json: (value) => {
			const client = (
				value as { clients: Record<string, Record<string, unknown>> }
			).clients.gram;
			expect(client.command).toEqual(["gram-language-server", "--stdio"]);
			expect(client.selector).toBe("source.gram");
			expect(client.initializationOptions).toEqual({ views: false });
		},
	},
	{
		path: "sublime/Comments.tmPreferences",
		command: false,
		contains: [
			/<string>source\.gram<\/string>/,
			/<string>TM_COMMENT_START<\/string>\s*<key>value<\/key>\s*<string>\/\/ <\/string>/,
		],
	},
	{
		path: "jetbrains/init-options.json",
		command: false,
		contains: [],
		json: (value) => expect(value).toEqual({ views: false }),
	},
];

/**
 * Every configuration under `editors/`, relative and with `/`: neither the
 * README nor the smoke tests of `smoke/`, which no docs page shows.
 */
function editorFiles(): string[] {
	const files: string[] = [];
	const walk = (dir: string) => {
		for (const entry of readdirSync(dir, { withFileTypes: true })) {
			const full = join(dir, entry.name);
			if (entry.isDirectory()) walk(full);
			else files.push(relative(EDITORS_DIR, full).split("\\").join("/"));
		}
	};
	walk(EDITORS_DIR);
	return files
		.filter((file) => file !== "README.md" && !file.startsWith("smoke/"))
		.sort();
}

const read = (path: string) => readFileSync(join(EDITORS_DIR, path), "utf8");

describe("editor configurations", () => {
	it("every file under editors/ has a contract", () => {
		expect(editorFiles()).toEqual(EDITORS.map((editor) => editor.path).sort());
	});

	for (const editor of EDITORS) {
		describe(editor.path, () => {
			const source = read(editor.path);

			if (editor.command) {
				it("starts the server over stdio", () => {
					expect(source).toMatch(COMMAND);
				});
			}

			if (editor.viewsOff) {
				it("asks for no view", () => {
					expect(source).toMatch(editor.viewsOff as RegExp);
				});
			}

			for (const pattern of editor.contains) {
				it(`contains ${pattern}`, () => {
					expect(source).toMatch(pattern);
				});
			}

			if (editor.json) {
				it("holds the expected JSON", () => {
					editor.json?.(JSON.parse(source));
				});
			}
		});
	}

	it("no file asks for views", () => {
		for (const path of editorFiles()) {
			expect(read(path)).not.toMatch(
				/views["']?\s*[=:]\s*true|:views\s+(t|:json-true)\b/,
			);
		}
	});

	it("Helix and Neovim build tree-sitter-gram at the same commit", () => {
		const helix = read("helix/languages.toml");
		const neovim = read("neovim/build-parser.sh");
		expect(helix).toContain(`git = "${TREE_SITTER_GRAM}"`);
		expect(neovim).toContain(`REPO="${TREE_SITTER_GRAM}"`);
		const helixRev = helix.match(/rev\s*=\s*"([0-9a-f]{40})"/)?.[1];
		const neovimRev = neovim.match(/REV="([0-9a-f]{40})"/)?.[1];
		expect(helixRev).toBeDefined();
		expect(neovimRev).toBe(helixRev as string);
	});

	for (const [lang, page] of Object.entries(PAGES)) {
		// Active once the page exists (step B3 of the 1.6 plan).
		it.skipIf(!existsSync(page))(
			`the ${lang} docs page imports every file`,
			() => {
				const mdx = readFileSync(page, "utf8");
				for (const path of editorFiles()) {
					expect(mdx).toContain(`@editors/${path}?raw`);
				}
			},
		);
	}
});
