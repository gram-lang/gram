import {
	type CompletionItem,
	CompletionItemKind,
	InsertTextFormat,
	type Position,
} from "vscode-languageserver";
import {
	isAlternative,
	isCookware,
	isSection,
	isStep,
	isTemperature,
	isTimer,
	type RecipeAST,
	type StepAST,
} from "@gram-lang/parser";

/** `#` cookware, `^` a temperature, `~` a timer, `~_` a passive timer (a named track). */
export type NameSigil = "#" | "^" | "~" | "~_";

export interface NamePrefix {
	sigil: NameSigil;
	/** The part of the name typed so far (it may hold spaces). */
	typed: string;
}

// The characters a name never holds (the grammar's sigils and brackets).
const NAME_CHAR = String.raw`[^\s~@#^&{}()[\]]`;
const NAME_PREFIX = new RegExp(
	String.raw`(?:^|[\s([,;:.!?"'])(#|\^|~_?)(${NAME_CHAR}*(?:[ \t]+${NAME_CHAR}+)*)$`,
	"u",
);

/**
 * The sigil and the name being typed when the cursor follows `#`, `^`, `~`
 * or `~_` in a step, or null. Never on a section heading (`## …`, whose `#`
 * are not cookware) nor after `//`. The caller rules out braces first.
 */
export function matchNamePrefix(prefix: string): NamePrefix | null {
	if (/^\s*##/.test(prefix)) return null;
	const m = NAME_PREFIX.exec(prefix);
	if (!m || prefix.slice(0, m.index).includes("//")) return null;
	return { sigil: m[1] as NameSigil, typed: m[2] ?? "" };
}

function* allSteps(ast: RecipeAST): Generator<StepAST> {
	for (const child of ast.children) {
		if (isSection(child)) {
			for (const block of child.children) if (isStep(block)) yield block;
		} else if (isStep(child)) {
			yield child;
		}
	}
}

/**
 * The names the recipe already gives after `sigil`, each with how many
 * times it is written: cookware (an alternative's options included),
 * temperatures, timers (`~`: all of them) or passive timers (`~_`, the
 * tracks the scheduler shares out).
 */
export function collectNames(
	ast: RecipeAST,
	sigil: NameSigil,
): Map<string, number> {
	const names = new Map<string, number>();
	const add = (name: string | null | undefined) => {
		if (name) names.set(name, (names.get(name) ?? 0) + 1);
	};
	for (const step of allSteps(ast)) {
		for (const child of step.children) {
			if (sigil === "#") {
				if (isCookware(child)) add(child.name);
				else if (isAlternative(child)) {
					for (const opt of child.options) if (isCookware(opt)) add(opt.name);
				}
			} else if (sigil === "^") {
				if (isTemperature(child)) add(child.name);
			} else if (isTimer(child) && (sigil === "~" || child.isPassive)) {
				add(child.name);
			}
		}
	}
	return names;
}

const DETAIL: Record<NameSigil, (name: string) => string> = {
	"#": (name) => `cookware: #${name}`,
	"^": (name) => `temperature: ^${name}`,
	"~": (name) => `timer: ~${name}`,
	"~_": (name) => `track: ~_${name}`,
};

/**
 * The names of the recipe after `#`, `^`, `~` or `~_`, so a track or a
 * cookware is written the same way each time. The text that replaces the
 * typed name is explicit (it starts right after the sigil, `_` included,
 * and may hold spaces). A timer and a temperature always take braces, the
 * cursor between them when the client expands snippets; a multi-word
 * cookware takes them too.
 */
export function provideNameCompletions(
	ast: RecipeAST,
	match: NamePrefix,
	position: Position,
	snippets: boolean,
): CompletionItem[] {
	const range = {
		start: {
			line: position.line,
			character: position.character - match.typed.length,
		},
		end: position,
	};
	const braces = match.sigil !== "#";
	const items: CompletionItem[] = [];
	for (const [name, count] of collectNames(ast, match.sigil)) {
		// The name being typed is in the (debounced) AST already: written
		// once, it is that very name, not one to suggest.
		if (name === match.typed && count === 1) continue;
		const needsBraces = braces || name.includes(" ");
		const snippet = needsBraces && snippets;
		items.push({
			label: name,
			kind:
				match.sigil === "#"
					? CompletionItemKind.Field
					: CompletionItemKind.Constant,
			detail: DETAIL[match.sigil](name),
			textEdit: {
				range,
				newText: snippet
					? `${name.replace(/[\\$}]/g, "\\$&")}{$0}`
					: needsBraces
						? `${name}{}`
						: name,
			},
			...(snippet ? { insertTextFormat: InsertTextFormat.Snippet } : {}),
		});
	}
	return items;
}
