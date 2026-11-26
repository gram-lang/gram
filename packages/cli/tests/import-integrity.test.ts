import { describe, it, expect } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
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

	it("does not mistake an @ in the frontmatter for a lost ingredient", () => {
		// The scanner itself is tested in packages/modules/tests/lint; this keeps
		// the importer's end of it covered: a channel handle in `author:` must
		// not refuse a good import.
		const source = `---\ntitle: 'T'\nauthor: '@ChefJohn'\n---\n\n## Steps\nMix @flour{200g}.\n`;
		expect(findLostIngredients(source)).toEqual([]);
	});

	it("says nothing about a file that does not compile", () => {
		// A parse failure is reported by validateGram; guessing at lost content in
		// a file the compiler never read would only add noise.
		expect(findLostIngredients("---\nbroken: [\n")).toEqual([]);
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

describe("setFrontmatterField with a multi-line YAML value", () => {
	// `source:` as a block sequence is valid YAML the model may well emit,
	// whatever the spec prompt illustrates. Removing only the key line left the
	// indented item orphaned and the frontmatter unparseable — at the very end
	// of an import, after every token had been spent.
	const blockStyle = `---
title: T
source:
  - 'https://example.com/x'
author: 'A'
---

body`;

	it("removes the continuation lines along with the key", () => {
		const out = injectProvenance(blockStyle, {});
		expect(out).not.toContain("example.com");
		expect(out).not.toContain("- '");
		expect(out).toContain("title: T");
	});

	it("replaces a block value wholesale rather than leaving an orphan", () => {
		const out = injectProvenance(blockStyle, {
			sourceUrl: "https://real.test/r",
		});
		expect(out).toContain("source: ['https://real.test/r']");
		expect(out).not.toContain("example.com");
	});

	it("leaves the following key untouched", () => {
		expect(setFrontmatterField(blockStyle, "source", null)).toContain(
			"author: 'A'",
		);
	});
});
