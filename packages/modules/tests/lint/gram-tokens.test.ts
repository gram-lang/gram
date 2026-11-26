import { describe, it, expect } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { getAST } from "@gram-lang/parser";
import { compile } from "@gram-lang/kitchen";
import {
	findUnquantifiedIngredients,
	findWrittenIngredients,
	lostFrom,
} from "../../src/lint";

// Moved from packages/cli/tests/import-integrity.test.ts with the scanner
// itself (packages/cli/src/core/gram-tokens.ts). The importer's own tests,
// which check what `gram import` reports, stayed in the CLI.

const FRONT = "---\ntitle: 'T'\n---\n\n";

/** Names lost between the text and the compiled registry. */
const lost = (source: string) =>
	lostFrom(compile(getAST(source)), findWrittenIngredients(source)).map(
		(w) => w.name,
	);

describe("findWrittenIngredients", () => {
	it("ignores ingredients inside a deliberate block comment", () => {
		const source = `${FRONT}## Steps
Mix @flour{200g}. /* could also use @rye flour{200g} */
`;
		expect(findWrittenIngredients(source).map((w) => w.name)).toEqual([
			"flour",
		]);
	});

	it("ignores a whole-line // comment, but not one mid-sentence", () => {
		const source = `${FRONT}// note: @rye flour{} is an option
Mix @flour{200g}. // or @spelt{200g}
`;
		expect(findWrittenIngredients(source).map((w) => w.name)).toEqual([
			"flour",
			"spelt",
		]);
	});

	it("reads modifiers, aliases, preparations and composite parents", () => {
		const source = `${FRONT}## Steps
Take @?optional herb{1}, @-omitted{1}, @tomatoes:toms{2}(diced) and @zest{1}<@unwaxed lemon{1}.
`;
		expect(findWrittenIngredients(source).map((w) => w.name)).toEqual([
			"optional herb",
			"omitted",
			"tomatoes",
			"zest",
			"unwaxed lemon",
		]);
	});

	it("reads a bare ingredient with no quantity", () => {
		expect(
			findWrittenIngredients(`${FRONT}Season with @salt and serve.\n`).map(
				(w) => w.name,
			),
		).toEqual(["salt"]);
	});

	it("stops a bare ingredient before a target state", () => {
		expect(
			findWrittenIngredients(
				`${FRONT}Sweat with @oil until ={translucent}.\n`,
			).map((w) => ({ name: w.name, quantified: w.quantified })),
		).toEqual([{ name: "oil", quantified: false }]);
	});
});

// How much of an import is still to fill in by hand. Not a defect: `@salt{}`
// is idiomatic Gram for "to taste", and the compiler says nothing about it.
// But on a video import it is the sharpest quality signal available — a Short
// came back with 11 ingredients and not one amount, where a long narrated
// video left only 3 of 15 blank.
describe("findUnquantifiedIngredients", () => {
	it("lists an ingredient that never gets a quantity, at its first mention", () => {
		const source = `${FRONT}## Steps
Mix @flour{200g} with @sugar{}.
Season with @salt{}.
`;
		expect(findUnquantifiedIngredients(source)).toEqual([
			{ name: "sugar", line: 6 },
			{ name: "salt", line: 7 },
		]);
	});

	it("ignores a back-reference that correctly carries no amount of its own", () => {
		// `@&butter{}` is a second draw on butter, not a missing quantity. Judging
		// each mention on its own would report every well-written recipe as
		// incomplete.
		const source = `${FRONT}## Steps
Melt @butter{100g} in the pan.
Finish the sauce with @&butter{}.
`;
		expect(findUnquantifiedIngredients(source)).toEqual([]);
	});

	it("counts an ingredient once however often it is left blank", () => {
		const source = `${FRONT}## Steps
Beat @egg{} and @egg{} together.
`;
		expect(findUnquantifiedIngredients(source)).toEqual([
			{ name: "egg", line: 6 },
		]);
	});

	it("treats a bare mention with no braces as unquantified", () => {
		expect(
			findUnquantifiedIngredients(`${FRONT}Season with @pepper and serve.\n`),
		).toEqual([{ name: "pepper", line: 5 }]);
	});

	it("accepts a relative quantity as a quantity", () => {
		const source = `${FRONT}## Steps
Add @flour{200g}, then @water{60% @&flour}.
`;
		expect(findUnquantifiedIngredients(source)).toEqual([]);
	});

	it("finds exactly the two the repo's own empanadas recipe leaves open", () => {
		// Independently established: the spike's self-test derived the same pair
		// from the compiled shopping list, by a completely different route.
		const path = join(
			import.meta.dir,
			"../../../docs/public/examples/empanadas.gram",
		);
		expect(
			findUnquantifiedIngredients(readFileSync(path, "utf-8")).map(
				(u) => u.name,
			),
		).toEqual(["oil", "green olives"]);
	});

	it("reports nothing on a fully quantified recipe", () => {
		const path = join(
			import.meta.dir,
			"../../../docs/public/examples/canneles.gram",
		);
		expect(findUnquantifiedIngredients(readFileSync(path, "utf-8"))).toEqual(
			[],
		);
	});
});

// The scanner reads recipe text, and frontmatter is not recipe text — the
// compiler parses it as YAML and registers nothing from it. Reading it anyway
// turned an ordinary metadata value into a phantom lost ingredient, and since
// a lost ingredient refuses the whole import, an email address or a channel
// handle in `author:` was enough to reject a perfectly good recipe. Video
// imports write `author:` straight from YouTube, so this is not hypothetical.
describe("the frontmatter is not scanned for ingredients", () => {
	const body = "\n## Steps\nMix @flour{200g}.\n";

	it.each([
		["author: 'contact@example.com'", "an email address"],
		["author: '@ChefJohn'", "a channel handle"],
		["source: ['https://x.test/u@v']", "an @ in the source URL"],
		["title: 'Pasta @ Home'", "an @ in the title"],
	])("ignores %s (%s)", (field) => {
		const source = `---\ntitle: 'T'\n${field}\n---\n${body}`;
		expect(lost(source)).toEqual([]);
		expect(findUnquantifiedIngredients(source)).toEqual([]);
		expect(findWrittenIngredients(source).map((w) => w.name)).toEqual([
			"flour",
		]);
	});

	it("still reads a `---` that appears in the body", () => {
		const source = `---\ntitle: 'T'\n---\n\n## Steps\nMix @flour{200g}.\n\n---\n\nAdd @salt{}.\n`;
		expect(findWrittenIngredients(source).map((w) => w.name)).toEqual([
			"flour",
			"salt",
		]);
	});
});

// `start`/`end` are what LOST_INGREDIENT will anchor on: UTF-16 offsets, the
// same units as Ohm.js and the LSP, starting at the `@` like an AST `loc`.
describe("findWrittenIngredients offsets", () => {
	const spans = (source: string) =>
		findWrittenIngredients(source).map((w) => source.slice(w.start, w.end));

	it("spans the token from its @ to the end of its quantity", () => {
		const source = `${FRONT}## Steps

Take @?optional herb{1}, @tomatoes:toms{2}(diced) and @zest{1}<@unwaxed lemon{1}.
`;
		expect(spans(source)).toEqual([
			"@?optional herb{1}",
			"@tomatoes:toms{2}",
			"@zest{1}",
			"@unwaxed lemon{1}",
		]);
	});

	it("spans a bare ingredient up to the end of its word", () => {
		expect(
			spans(`${FRONT}Season with @salt, then @oil until ={done}.\n`),
		).toEqual(["@salt", "@oil"]);
	});

	it("counts UTF-16 code units, so an emoji counts for two", () => {
		const source = `${FRONT}🥛🥛 Add @crème fraîche{1} and @sel.\n`;
		const [creme, sel] = findWrittenIngredients(source);
		expect(source.slice(creme?.start, creme?.end)).toBe("@crème fraîche{1}");
		expect(creme?.start).toBe(source.indexOf("@crème"));
		expect(source.slice(sel?.start, sel?.end)).toBe("@sel");
	});

	it("keeps the offsets of the original text despite masked comments", () => {
		const source = `${FRONT}// a note with @nothing{1}
/* and @nothing{2} */ Mix @flour{200g}.
`;
		const [flour] = findWrittenIngredients(source);
		expect(flour?.start).toBe(source.indexOf("@flour"));
		expect(source.slice(flour?.start, flour?.end)).toBe("@flour{200g}");
	});
});

describe("lostFrom", () => {
	it("returns the swallowed tokens, once each, at their first mention", () => {
		const source = `${FRONT}## Steps

Mix @flour{} // TODO: @sugar{}, @salt{} and @sugar{}.

Season with @salt{}.
`;
		const result = lostFrom(
			compile(getAST(source)),
			findWrittenIngredients(source),
		);
		expect(result.map((w) => [w.name, w.line])).toEqual([["sugar", 7]]);
		expect(source.slice(result[0]?.start, result[0]?.end)).toBe("@sugar{}");
	});

	it("needs only the registry of the compiled recipe", () => {
		const written = findWrittenIngredients(
			`${FRONT}Mix @flour{1} and @salt.\n`,
		);
		const registry = { ingredients: { flour: {} } } as never;
		expect(lostFrom({ registry }, written).map((w) => w.id)).toEqual(["salt"]);
	});

	it("reports nothing on a healthy recipe", () => {
		const source = `${FRONT}## Steps

Mix @flour{200g}, @sugar{50% @&flour} and @zest{1}<@lemon{1}.
`;
		expect(lost(source)).toEqual([]);
	});
});
