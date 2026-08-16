import { describe, it, expect } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
	findUnquantifiedIngredients,
	findWrittenIngredients,
} from "../src/core/gram-tokens";
import {
	findLostIngredients,
	collectAnalysisGaps,
	setFrontmatterField,
	injectProvenance,
	injectLanguage,
} from "../src/services/importer";
import { makeDb } from "./helpers";

// A .gram file can lose content and still compile without a single warning.
// `//` comments to end of line, so a marker dropped mid-sentence takes every
// ingredient after it on that line. Two of six spike imports did exactly this,
// losing four ingredients and three; both wrote a clean file and exited 0.
//
// The two fixtures below are the real generated lines, trimmed to the failing
// step. Anything that changes the detector must keep finding them.

const FRONT = "---\ntitle: 'T'\n---\n\n";

const LOST_FOUR = `${FRONT}## Mélanger les secs
Dans un autre #bol{}, combiner @farine{} // TODO: quantité non précisée, @bicarbonate de soude{}, @levure chimique{}, @cannelle{} et @sel{}.
`;

const LOST_THREE = `${FRONT}## Battre
Dans un #grand bocal{}, casser @œufs{6}, ajouter @lait{} // TODO: non spécifiée, @sel{} et @poivre{}.

## Parsemer
Parsemer avec @fromage cheddar râpé{} // TODO: non spécifiée et @fromage mozzarella râpé{}.
`;

describe("findLostIngredients", () => {
	it("catches the four ingredients a mid-sentence // comment swallowed", () => {
		const lost = findLostIngredients(LOST_FOUR);
		expect(lost.map((l) => l.split(" (line")[0])).toEqual([
			"bicarbonate de soude",
			"levure chimique",
			"cannelle",
			"sel",
		]);
	});

	it("catches losses across several steps, and reports the line of each", () => {
		const lost = findLostIngredients(LOST_THREE);
		expect(lost).toHaveLength(3);
		expect(lost[0]).toBe("sel (line 6)");
		expect(lost[2]).toContain("fromage mozzarella râpé");
	});

	it("reports nothing on a healthy recipe", () => {
		const source = `${FRONT}## Steps
Mix @flour{200g}, @sugar{50g} and a pinch of @salt{}.
Fold in the @butter{100g}(softened) and the @egg yolks{2}<@eggs{2}.
`;
		expect(findLostIngredients(source)).toEqual([]);
	});

	it("reports nothing on the repo's own example recipes", () => {
		const examples = join(
			import.meta.dir,
			"../../docs/public/examples/empanadas.gram",
		);
		expect(findLostIngredients(readFileSync(examples, "utf-8"))).toEqual([]);
	});

	it("does not mistake a reference inside a quantity for a declaration", () => {
		// `@&flour` here is a relative quantity, not a new ingredient. Counting it
		// flagged a false loss on conformance case warn-002.
		const source = `${FRONT}## Steps
Add @sugar{50% @&flour}.
`;
		expect(findLostIngredients(source)).toEqual([]);
	});

	it("says nothing about a file that does not compile", () => {
		// A parse failure is reported by validateGram; guessing at lost content in
		// a file the compiler never read would only add noise.
		expect(findLostIngredients("---\nbroken: [\n")).toEqual([]);
	});
});

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
});

describe("collectAnalysisGaps", () => {
	const source = `${FRONT}## Steps
Mix @flour{200g} and @unobtainium{3g}.
`;

	it("is silent without a database — there is nothing to check against", () => {
		expect(collectAnalysisGaps(source, null)).toEqual([]);
	});

	it("names ingredients the database has never heard of", () => {
		const gaps = collectAnalysisGaps(source, makeDb({ flour: {} }));
		expect(gaps.join(" ")).toContain("unobtainium");
	});
});

describe("setFrontmatterField", () => {
	it("replaces an existing field", () => {
		const out = setFrontmatterField(`${FRONT}body`, "title", "'U'");
		expect(out).toContain("title: 'U'");
		expect(out).not.toContain("title: 'T'");
	});

	it("appends a field that is not there yet", () => {
		expect(setFrontmatterField(`${FRONT}body`, "author", "'A'")).toContain(
			"author: 'A'",
		);
	});

	it("removes a field when given null", () => {
		const withAuthor = `---\ntitle: 'T'\nauthor: 'A'\n---\n\nbody`;
		const out = setFrontmatterField(withAuthor, "author", null);
		expect(out).not.toContain("author");
		expect(out).toContain("title: 'T'");
	});

	it("leaves a file without frontmatter alone", () => {
		expect(setFrontmatterField("no frontmatter", "title", "'T'")).toBe(
			"no frontmatter",
		);
	});
});

describe("injectProvenance", () => {
	// The spec prompt shows `source: ['https://example.com/recipe']`, and a model
	// with no URL copies the placeholder: four of six spike imports came back
	// sourced to example.com, with invented authors. Provenance is a fact we
	// hold or do not hold — never something for the model to fill in.
	const hallucinated = `---
title: 'T'
author: 'Chef'
source: ['https://example.com/made-up']
---

body`;

	it("strips an invented source and author when the input had neither", () => {
		const out = injectProvenance(hallucinated, {});
		expect(out).not.toContain("example.com");
		expect(out).not.toContain("Chef");
		expect(out).toContain("title: 'T'");
	});

	it("overwrites them with what the source data actually said", () => {
		const out = injectProvenance(hallucinated, {
			sourceUrl: "https://real.example.org/tarte",
			author: "Auguste Kerflec",
		});
		expect(out).toContain("source: ['https://real.example.org/tarte']");
		expect(out).toContain("author: 'Auguste Kerflec'");
		expect(out).not.toContain("made-up");
	});

	it("writes several authors as a YAML array", () => {
		const out = injectProvenance(hallucinated, { author: ["Ada", "Grace"] });
		expect(out).toContain("author: ['Ada', 'Grace']");
	});

	it("escapes a quote in an author name instead of breaking the YAML", () => {
		const out = injectProvenance(hallucinated, { author: "L'Atelier" });
		expect(out).toContain("author: 'L''Atelier'");
	});

	it("adds provenance to a file that had none", () => {
		const out = injectProvenance(`${FRONT}body`, {
			sourceUrl: "https://x.example/y",
		});
		expect(out).toContain("source: ['https://x.example/y']");
	});
});

describe("injectLanguage", () => {
	it("still behaves as before now that it delegates to setFrontmatterField", () => {
		expect(injectLanguage(`${FRONT}body`, "fr")).toContain("language: 'fr'");
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
			"../../docs/public/examples/empanadas.gram",
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
			"../../docs/public/examples/canneles.gram",
		);
		expect(findUnquantifiedIngredients(readFileSync(path, "utf-8"))).toEqual(
			[],
		);
	});
});
