import ts from "typescript";
import type { Expectation } from "./types";

const TEST_BODY_WRAPPERS = new Set([
	"it",
	"test",
	"describe",
	"beforeEach",
	"beforeAll",
	"afterEach",
	"afterAll",
]);

// Walks up from a raw-Gram-source call (getAST(...)/parseDocument(...)) to
// decide whether the surrounding test expects it to throw. Recognizes the
// `expect(() => call(...)).toThrow(...)` shape and its negation
// `.not.toThrow()` (and their `formatGram`/`parseDocument` equivalents) —
// anything else that wraps the call (a custom helper, `.toBeDefined()`, etc.)
// is reported as "unclear" rather than guessed, so it surfaces in its own
// report section for manual classification.
export function classifyCallExpectation(node: ts.CallExpression): Expectation {
	let current: ts.Node = node;
	let innerFn: ts.ArrowFunction | ts.FunctionExpression | undefined;

	while (current.parent) {
		if (ts.isArrowFunction(current.parent) || ts.isFunctionExpression(current.parent)) {
			innerFn = current.parent;
			break;
		}
		current = current.parent;
	}

	// No wrapping function at all — a bare `const ast = getAST(x)` (or
	// similar), unambiguously expected to parse cleanly.
	if (!innerFn) return "must-parse";

	const wrappingCall = innerFn.parent;
	if (!wrappingCall || !ts.isCallExpression(wrappingCall)) return "must-parse";

	const callee = wrappingCall.expression;

	if (ts.isIdentifier(callee) && callee.text === "expect") {
		let propAccess = wrappingCall.parent;
		if (
			propAccess &&
			ts.isPropertyAccessExpression(propAccess) &&
			propAccess.expression === wrappingCall &&
			propAccess.name.text === "not"
		) {
			// expect(fn).not.<something> — step past `.not` to see what follows.
			const notAccess = propAccess;
			propAccess = notAccess.parent;
			if (
				propAccess &&
				ts.isPropertyAccessExpression(propAccess) &&
				propAccess.expression === notAccess &&
				propAccess.name.text === "toThrow" &&
				propAccess.parent &&
				ts.isCallExpression(propAccess.parent) &&
				propAccess.parent.expression === propAccess
			) {
				return "must-parse"; // .not.toThrow() explicitly expects success
			}
			return "unclear";
		}
		if (
			propAccess &&
			ts.isPropertyAccessExpression(propAccess) &&
			propAccess.expression === wrappingCall &&
			propAccess.name.text === "toThrow" &&
			propAccess.parent &&
			ts.isCallExpression(propAccess.parent) &&
			propAccess.parent.expression === propAccess
		) {
			return "must-throw";
		}
		// expect(() => call(...)) not immediately chained with .toThrow/.not.toThrow
		// — could be `.toBeDefined()`, etc. Don't guess.
		return "unclear";
	}

	if (ts.isIdentifier(callee) && TEST_BODY_WRAPPERS.has(callee.text)) {
		// The arrow is just the test/hook body (it("...", () => { ... })), not a
		// throw-assertion wrapper.
		return "must-parse";
	}

	// Wrapped in something else entirely (a custom test helper) — ambiguous.
	return "unclear";
}
