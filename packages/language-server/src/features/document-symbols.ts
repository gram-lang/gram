import {
	type DocumentSymbol,
	SymbolKind,
	type Range,
} from "vscode-languageserver";
import type { DocumentState } from "../document-state";
import { locToRange } from "../utils/position";
import {
	type StepAST,
	type IntermediateDecl,
	isIntermediateDecl,
	isStep,
	isSection,
} from "@gram-lang/parser";

const ZERO_RANGE: Range = {
	start: { line: 0, character: 0 },
	end: { line: 0, character: 0 },
};

function getDeclSymbol(
	decl: IntermediateDecl,
	lineStarts: number[],
): DocumentSymbol {
	const range = decl.loc ? locToRange(lineStarts, decl.loc) : ZERO_RANGE;
	return {
		name: `->&${decl.name}`,
		kind: SymbolKind.Variable,
		range,
		selectionRange: range,
	};
}

function getStepSymbol(
	step: StepAST,
	index: number,
	lineStarts: number[],
): DocumentSymbol {
	const range = step.loc ? locToRange(lineStarts, step.loc) : ZERO_RANGE;
	const name = step.action ?? `Step ${index + 1}`;

	// Inline ->&decl inside this step become children
	const children: DocumentSymbol[] = [];
	for (const child of step.children) {
		if (isIntermediateDecl(child)) {
			children.push(getDeclSymbol(child, lineStarts));
		}
	}

	const symbol: DocumentSymbol = {
		name,
		kind: SymbolKind.Event,
		range,
		selectionRange: range,
	};
	if (children.length > 0) symbol.children = children;
	return symbol;
}

export function provideDocumentSymbols(state: DocumentState): DocumentSymbol[] {
	if (!state.ast) return [];

	// Audit 2026-07-22, parser finding I3(1): `RecipeAST.children` isn't
	// always `SectionAST[]` — a recipe with no `## Section` header anywhere,
	// or leading content before the first header, places `Step`/`Comment`
	// nodes directly under `Recipe`. The old `.map((section: SectionAST) =>
	// ...)` annotation lied about that and would have crashed on a bare
	// top-level Comment (`.children` doesn't exist on `CommentAST`).
	const symbols: DocumentSymbol[] = [];
	let bareStepIndex = 0;

	for (const child of state.ast.children) {
		if (isSection(child)) {
			const sectionRange = child.loc
				? locToRange(state.lineStarts, child.loc)
				: ZERO_RANGE;
			const children: DocumentSymbol[] = [];

			// Section-level intermediate declaration (from header: ## Title ->&decl)
			if (child.intermediateDecl) {
				children.push(getDeclSymbol(child.intermediateDecl, state.lineStarts));
			}

			// Steps (with their inline ->&decl as children)
			let stepIndex = 0;
			for (const block of child.children) {
				if (!isStep(block)) continue;
				children.push(getStepSymbol(block, stepIndex, state.lineStarts));
				stepIndex++;
			}

			const symbol: DocumentSymbol = {
				name: child.title ?? "(section)",
				kind: SymbolKind.Module,
				range: sectionRange,
				selectionRange: sectionRange,
			};
			if (children.length > 0) symbol.children = children;
			symbols.push(symbol);
		} else if (isStep(child)) {
			symbols.push(getStepSymbol(child, bareStepIndex, state.lineStarts));
			bareStepIndex++;
		}
		// A bare top-level Comment has no useful outline entry of its own.
	}

	return symbols;
}
