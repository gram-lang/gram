import pLimit from "p-limit";
import { readFile } from "node:fs/promises";
import { getAST, ASTNodeType } from "@gram-lang/parser";
import type {
	RecipeAST,
	SectionAST,
	StepAST,
	IngredientAST,
	AlternativeAST,
} from "@gram-lang/parser";
import { slugify } from "@gram-lang/kitchen";
import type { IngredientData } from "@gram-lang/analyzer";

export interface RecipeSuggestion {
	file: string;
	title: string | null;
	matched: string[];
	missing: string[];
	score: number; // 0–100
}

// Reverse index: slugified form (name or alias) → canonical DB key
function buildAliasIndex(
	db: Record<string, IngredientData>,
): Map<string, string> {
	const index = new Map<string, string>();
	for (const [key, entry] of Object.entries(db)) {
		index.set(slugify(key), key);
		if (entry.name) index.set(slugify(entry.name), key);
		for (const alias of entry.aliases ?? []) {
			index.set(slugify(alias), key);
		}
	}
	return index;
}

function collectIngredientNames(ast: RecipeAST): string[] {
	const names: string[] = [];
	for (const section of ast.children as SectionAST[]) {
		if (section.type !== ASTNodeType.Section) continue;
		for (const step of section.children) {
			if (step.type !== ASTNodeType.Step) continue;
			for (const node of (step as StepAST).children) {
				if (node.type === ASTNodeType.Ingredient) {
					names.push((node as IngredientAST).name);
				} else if (node.type === ASTNodeType.Alternative) {
					for (const opt of (node as AlternativeAST).options) {
						if (opt.type === ASTNodeType.Ingredient)
							names.push((opt as IngredientAST).name);
					}
				}
			}
		}
	}
	return names;
}

export interface SuggestOptions {
	withTerms: string[];
	withoutTerms: string[];
	db: Record<string, IngredientData> | null;
	minMatch: number; // 0–100
	top: number;
}

export async function suggestRecipes(
	files: string[],
	opts: SuggestOptions,
): Promise<RecipeSuggestion[]> {
	const aliasIndex = opts.db ? buildAliasIndex(opts.db) : null;

	function resolve(term: string): string {
		const slug = slugify(term);
		return aliasIndex?.get(slug) ?? slug;
	}

	const withSlugs = opts.withTerms.map(resolve);
	const withoutSlugs = opts.withoutTerms.map(resolve);

	const limit = pLimit(20);
	const results = await Promise.all(
		files.map((file) =>
			limit(async (): Promise<RecipeSuggestion | null> => {
				let src: string;
				try {
					src = await readFile(file, "utf-8");
				} catch {
					return null;
				}

				let ast: RecipeAST;
				try {
					ast = getAST(src);
				} catch {
					return null;
				}

				const title =
					typeof ast.meta?.title === "string" ? ast.meta.title : null;
				const recipeIds = new Set(
					collectIngredientNames(ast).map((n) => resolve(n)),
				);

				// Exclude immediately if any --without ingredient is present
				if (withoutSlugs.some((s) => recipeIds.has(s))) return null;

				const matched: string[] = [];
				const missing: string[] = [];
				for (let i = 0; i < withSlugs.length; i++) {
					(recipeIds.has(withSlugs[i]!) ? matched : missing).push(
						opts.withTerms[i]!,
					);
				}

				const score =
					withSlugs.length > 0
						? Math.round((matched.length / withSlugs.length) * 100)
						: 100;

				if (score < opts.minMatch) return null;

				return { file, title, matched, missing, score };
			}),
		),
	);

	return (results.filter(Boolean) as RecipeSuggestion[])
		.sort(
			(a, b) =>
				b.score - a.score ||
				(a.title ?? a.file).localeCompare(b.title ?? b.file),
		)
		.slice(0, opts.top);
}
