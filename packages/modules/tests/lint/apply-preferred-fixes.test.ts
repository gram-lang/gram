import { describe, expect, it } from "bun:test";
import {
	applyPreferredFixes,
	type FileEdit,
	type LintDiagnostic,
	type LintFix,
} from "../../src/lint";

const URI = "/recipe.gram";

const patch = (
	start: number,
	end: number,
	replacement: string,
	uri = URI,
): FileEdit => ({ kind: "patch", uri, patches: [{ start, end, replacement }] });

const preferred = (...edits: FileEdit[]): LintFix => ({
	title: "fix",
	edits,
	isPreferred: true,
});

const diag = (code: string, ...fixes: LintFix[]): LintDiagnostic => ({
	code,
	severity: "warning",
	uri: URI,
	message: code,
	fixes,
});

describe("applyPreferredFixes", () => {
	it("applies only preferred fixes, from the end back so no offset moves", () => {
		const text = "abcdefghij";
		const { text: out, applied } = applyPreferredFixes(text, URI, [
			diag("A", preferred(patch(1, 2, "BB"))),
			diag("B", preferred(patch(6, 8, ""))),
			diag("C", { title: "not preferred", edits: [patch(9, 10, "J")] }),
		]);
		expect(out).toBe("aBBcdefij");
		expect(applied.map((a) => a.diagnostic.code)).toEqual(["A", "B"]);
		expect(applied[0]!.fix.title).toBe("fix");
	});

	it("leaves out whole a fix that overlaps one already kept, in text order", () => {
		const text = "0123456789";
		const { text: out, applied } = applyPreferredFixes(text, URI, [
			// Given second but starting first: kept, so the result never
			// depends on the order of the diagnostics.
			diag("LATE", preferred(patch(4, 7, "x"))),
			diag("EARLY", preferred(patch(2, 5, "y"))),
			// Two patches, one of them clear of the others: still left out whole.
			diag("BOTH", preferred(patch(8, 9, "z"), patch(3, 4, "w"))),
		]);
		expect(applied.map((a) => a.diagnostic.code)).toEqual(["EARLY"]);
		expect(out).toBe("01y56789");
	});

	it("keeps two replacements that only meet", () => {
		const { text } = applyPreferredFixes("abcd", URI, [
			diag("A", preferred(patch(0, 2, "X"))),
			diag("B", preferred(patch(2, 4, "Y"))),
		]);
		expect(text).toBe("XY");
	});

	it("counts two insertions at one point, or one at a replacement's edge, as an overlap", () => {
		const same = applyPreferredFixes("abcd", URI, [
			diag("A", preferred(patch(2, 2, "1"))),
			diag("B", preferred(patch(2, 2, "2"))),
		]);
		expect(same.text).toBe("ab1cd");
		expect(same.applied.map((a) => a.diagnostic.code)).toEqual(["A"]);

		const edge = applyPreferredFixes("abcd", URI, [
			diag("R", preferred(patch(1, 3, "X"))),
			diag("I", preferred(patch(3, 3, "!"))),
		]);
		expect(edge.applied.map((a) => a.diagnostic.code)).toEqual(["R"]);
		expect(edge.text).toBe("aXd");
	});

	it("never creates a file: a fix with a createFile is left out whole", () => {
		const text = "abcd";
		const { text: out, applied } = applyPreferredFixes(text, URI, [
			diag(
				"A",
				preferred(patch(0, 1, "X"), {
					kind: "createFile",
					uri: "/.gram/ingredients.yaml",
					content: "flour: {}\n",
				}),
			),
		]);
		expect(applied).toEqual([]);
		expect(out).toBe(text);
	});

	it("never edits another file: a fix touching another uri is left out whole", () => {
		const text = "abcd";
		const { text: out, applied } = applyPreferredFixes(text, URI, [
			diag("A", preferred(patch(0, 1, "X"), patch(2, 3, "Y", "/base.gram"))),
			{ ...diag("B", preferred(patch(2, 3, "Z"))), uri: "/base.gram" },
		]);
		expect(applied).toEqual([]);
		expect(out).toBe(text);
	});

	it("leaves out a fix with no patch, or a patch outside the text", () => {
		const text = "abcd";
		const empty: FileEdit = { kind: "patch", uri: URI, patches: [] };
		const { text: out, applied } = applyPreferredFixes(text, URI, [
			diag("NONE", preferred()),
			diag("EMPTY", preferred(empty)),
			diag("NEG", preferred(patch(-1, 1, "X"))),
			diag("BACK", preferred(patch(3, 2, "X"))),
			diag("PAST", preferred(patch(3, 5, "X"))),
		]);
		expect(applied).toEqual([]);
		expect(out).toBe(text);
	});
});
