import { describe, it, expect } from "bun:test";
import { getAST } from "@gram-lang/parser";
import { formatGram } from "../src/index";

// Phase F.0.1 of the module-imports RFC (.notes/plan-ajout-imports-recettes.md):
// formatGram runs nine regex rules over the recipe body, none written with
// `@use` in mind — the RFC calls out that a formatter which corrupts a
// user's file is the one part of this feature that can't wait for a later
// version. These are round-trip tests (formatGram(formatGram(x)) ===
// formatGram(x)) plus a parseability check on every directive form, run
// through the real grammar rather than assumed safe.

const FIXTURE = `---
title: Tarte au citron
---

@use "./bases/pate-sablee.gram" as &pate
@use "./bases/creme-citron.gram" as &creme
@use "./bases/oeufs.gram" as { &blancs, &jaunes }
@use "./bases/oeufs.gram" as { &paton as &paton-brisee }
@use "std:fonds/bouillon-legumes" as &bouillon prepared

## Montage

[Foncer] le moule avec &pate{250g}.

[Garnir] avec &creme{400g}.
`;

describe("formatGram and @use directives", () => {
	it("is idempotent on a document with every directive form", () => {
		const once = formatGram(FIXTURE);
		const twice = formatGram(once.content);
		expect(twice.content).toBe(once.content);
	});

	it("keeps the formatted output parseable with the same imports", () => {
		const { content } = formatGram(FIXTURE);
		const stripLoc = (bindings: { exported: string; local: string }[]) =>
			bindings.map(({ exported, local }) => ({ exported, local }));
		const before = getAST(FIXTURE).imports;
		const after = getAST(content).imports;

		expect(after.map((d) => d.specifier)).toEqual(
			before.map((d) => d.specifier),
		);
		expect(after.map((d) => d.mode)).toEqual(before.map((d) => d.mode));
		expect(after.map((d) => stripLoc(d.bindings))).toEqual(
			before.map((d) => stripLoc(d.bindings)),
		);
	});

	it("trims whitespace inside destructured bindings without changing the bindings", () => {
		const source = '@use "./oeufs.gram" as {  &blancs , &jaunes  }\n\nstep\n';
		const { content } = formatGram(source);

		expect(content).toContain("as {&blancs , &jaunes}");
		const ast = getAST(content);
		expect(ast.imports[0]?.bindings.map((b) => b.exported)).toEqual([
			"blancs",
			"jaunes",
		]);
	});

	it("does not touch the module specifier string", () => {
		const source = '@use "./Bases/Pate-Sablee.gram" as &Pate\n\nstep\n';
		const { content } = formatGram(source);
		// Rule 1 (lowercase ingredient IDs) must not reach inside the quoted
		// specifier -- only an actual @ingredient id should ever be lowercased.
		expect(content).toContain('"./Bases/Pate-Sablee.gram"');
	});

	it("leaves a prepared import's modifier intact", () => {
		const source =
			'@use "std:fonds/bouillon-legumes" as &bouillon prepared\n\nstep\n';
		const { content } = formatGram(source);
		expect(getAST(content).imports[0]?.mode).toBe("prepared");
	});
});
