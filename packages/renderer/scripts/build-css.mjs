// `dist/gram.css`, the stylesheet of every view on screen: the shared
// stylesheets, then the `screen.css` of each view of the registry, in its
// order. Read from the registry, so a view added to it is styled on every
// surface with no list to keep here. Run by `build` and `dev` (`--watch`), after tsup: edit the
// stylesheets in `src/`, never the generated file.
//
// The stylesheets stay out of the JavaScript bundle on purpose: every surface
// loads them as a file, and none needs them as a string at run time.
import { readFileSync, watch, writeFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";

const SRC = new URL("../src/", import.meta.url);

/** What every view on screen needs: the tokens, the frame and icons, the floating tooltip. */
export const SHARED_STYLESHEETS = [
	"shared/tokens.css",
	"shared/base.css",
	"shared/tooltip.css",
];

/** The folder of a view: its id in kebab case (`runSheet` lives in `views/run-sheet/`). */
export const folderOf = (id) =>
	id.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);

/** The screen stylesheet of a view, by its id. */
export const screenStylesheetOf = (id) => `views/${folderOf(id)}/screen.css`;

/** The whole stylesheet, for the views of `viewIds`, in that order. */
export function gramCss(viewIds) {
	return [...SHARED_STYLESHEETS, ...viewIds.map(screenStylesheetOf)]
		.map((path) => readFileSync(new URL(path, SRC), "utf8"))
		.join("\n");
}

/** Writes `dist/gram.css` for the views of the built registry. */
function writeGramCss(viewIds) {
	const header =
		"/* @gram-lang/renderer: generated from src/shared/*.css and each view's screen.css. Do not edit. */\n";
	writeFileSync(
		fileURLToPath(new URL("../dist/gram.css", import.meta.url)),
		header + gramCss(viewIds),
	);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
	const { views } = await import("../dist/index.js");
	const viewIds = views.map((view) => view.id);
	writeGramCss(viewIds);

	// `--watch`: rewrite the file whenever a stylesheet of `src/` changes, so a
	// dev server importing it reloads the styles live. A change of the registry
	// itself goes through the JavaScript build, which starts this script again.
	if (process.argv.includes("--watch")) {
		let timer;
		const onChange = (_event, file) => {
			if (!file?.endsWith(".css")) return;
			clearTimeout(timer);
			timer = setTimeout(() => {
				try {
					writeGramCss(viewIds);
					console.log(`gram.css rebuilt (${file})`);
				} catch (error) {
					console.error(`gram.css not rebuilt: ${error.message}`);
				}
			}, 30);
		};
		// One watch per folder, not a recursive one: an editor saves by replacing
		// the file, which a recursive watch on Linux can stop reporting.
		const folders = new Set(
			[...SHARED_STYLESHEETS, ...viewIds.map(screenStylesheetOf)].map((path) =>
				fileURLToPath(new URL(".", new URL(path, SRC))),
			),
		);
		for (const folder of folders) watch(folder, onChange);
	}
}
