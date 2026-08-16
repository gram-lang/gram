import type {
	IngredientData,
	Macros,
	NutritionMetrics,
} from "@gram-lang/analyzer";
import type { CategoryKey } from "@gram-lang/i18n";
import type { NutritionBasis } from "@gram-lang/renderer";
import { z } from "zod";

export type DiagnosticLevel = "error" | "warning" | "info";

export interface Diagnostic {
	level: DiagnosticLevel;
	category: "Structure" | "Database";
	file: string;
	message: string;
	line?: number;
	col?: number;
}

export interface CheckResult {
	diagnostics: Diagnostic[];
	hasErrors: boolean;
	fileCount: number;
}

export interface BuildResult {
	slug: string;
	file: string;
	data: object;
}

// --- Phase 2 types ---

export interface FuzzyMatch {
	newId: string;
	existingId: string;
	score: number;
}

export interface DbSyncOptions {
	dryRun?: boolean;
	dbPathOverride?: string;
}

export interface DbSyncAnalysis {
	dbPath: string;
	allIds: Map<string, string>;
	exactMatches: string[];
	fuzzyMatches: FuzzyMatch[];
	genuinelyNew: string[];
}

export interface DbSyncResult {
	dbPath: string;
	totalFound: number;
	newIngredients: string[];
	aliasedIngredients: string[];
	existingIngredients: string[];
}

type LintIssueType = "plural" | "duplicate";

export interface LintIssue {
	type: LintIssueType;
	ids: string[];
	suggestion: { keepId: string; aliasIds: string[] };
	hasNutritionConflict: boolean;
}

export interface LintResult {
	dbPath: string;
	issues: LintIssue[];
}

export interface LintOptions {
	report?: boolean;
	dbPathOverride?: string;
}

export interface LintDecision {
	issueIndex: number;
	action: "apply" | "skip";
	keepId?: string;
	keepNutrition?: "keep" | "source";
}

export interface DbIssue {
	level: "error" | "warning";
	category: string;
	ingredient?: string;
	message: string;
}

export interface DbValidateResult {
	dbPath: string;
	ingredientCount: number;
	issues: DbIssue[];
	hasErrors: boolean;
}

export interface ShoppingEntry {
	id: string;
	name: string;
	displayQty: string;
	isEstimate: boolean;
	recipes: string[];
	category: string;
	cannotAggregate: boolean;
}

export interface ShopResult {
	items: ShoppingEntry[];
	byCategory: Map<string, ShoppingEntry[]>;
	warnings: string[];
	recipeCount: number;
}

// --- Phase 3 types ---

export interface RecipeViewModel {
	title: string;
	/** From the recipe's `portions:` frontmatter — see buildRecipeViewModel. */
	servings: number | null;
	/** Recipe language, so the terminal view can localize nutrition labels. */
	lang?: string;
	/** Which nutrition basis the terminal view should print (`--nutrition`). */
	nutritionBasis?: NutritionBasis;
	times: {
		active?: number;
		prep?: number;
		rest?: number;
		total?: number;
	} | null;
	shoppingList: Array<{
		name: string;
		displayQty: string;
		isEstimate: boolean;
	}>;
	sections: Array<{
		title: string | null;
		ingredients: Array<{
			name: string;
			displayQty: string;
			isEstimate: boolean;
			children?: Array<{ name: string; displayQty: string }>;
		}>;
		steps: Array<{
			action?: string;
			text: string;
			timerMinutes?: number;
			_tokens: any[];
		}>;
	}>;
	nutrition: NutritionMetrics | null;
	missingIngredients: string[];
	_registries: {
		ingredients: Record<string, any>;
		cookware: Record<string, any>;
	};
}

export interface ImportResult {
	gramContent: string;
	title: string;
	ingredientCount: number;
	stepCount: number;
	parseWarnings: string[];
	/** Error-severity problems still present after the AI repair loop gave up. */
	unresolvedErrors: string[];
	/** Ingredients written into the file that the compiler never registered — content was swallowed. */
	lostIngredients: string[];
	/** What the analyzer could not resolve against the database. Informational: not the AI's fault, and not worth a retry. */
	analysisGaps: string[];
}

export interface EnrichEntry {
	id: string;
	name: string;
	density?: number;
	unit_weight?: number;
	nutrition?: Macros;
	// A stable key persisted as data (e.g. "vegetables"), never a translated
	// display label — see
	// @gram-lang/i18n's categories.ts for why.
	category?: CategoryKey;
	tagSuggestions: string[];
}

// "Was the database actually written?" used to be a guess the UI made from
// `!dryRun` — a missing/unreadable file
// or an unexpected YAML root silently skipped the write while `enriched`
// stayed populated, so the UI reported "Updated <path> (N enriched)" against
// an unchanged file. This is now a typed fact `applyEnrichDecisions` reports
// directly; `renderEnrichResult` can only claim "Updated" by reading it.
export type EnrichWriteResult =
	| { written: true; path: string; count: number }
	| { written: false; reason: string };

export interface EnrichResult {
	dbPath: string;
	totalIncomplete: number;
	enriched: EnrichEntry[];
	skipped: string[];
	failed: string[];
}

export interface EnrichOptions {
	ingredient?: string;
	field?: "density" | "nutrition" | "tags" | "category" | "all";
	dbPathOverride?: string;
	onBatchDone?: (
		done: number,
		total: number,
		enriched: string[],
		failed: string[],
	) => void;
}

// String ouverte plutôt qu'un booléen llm/user : c'est le point d'extension
// pour une source externe plus tard (openfoodfacts, …) sans redesign.
export type EnrichSource = "llm" | "user"; // extensible plus tard: | "openfoodfacts"

// "accept" et "edit" ont été fusionnés : au niveau du type, les deux
// signifient juste "write" avec des valeurs finales (identiques ou non à
// celles de l'IA). La provenance ne se déduit plus de l'action choisie dans
// le prompt mais d'une comparaison valeur par valeur, faite dans
// applyEnrichDecisions — corrige le bug d'une action "edit" au niveau du
// bloc qui effaçait la provenance IA d'un sous-champ non modifié.
export interface EnrichFieldGroupDecision {
	action: "write" | "skip";
	density?: number;
	unit_weight?: number;
	nutrition?: EnrichEntry["nutrition"];
}

export interface EnrichDecision {
	// Index dans EnrichResult.enriched. applyEnrichDecisions itère sur
	// `decisions` et remonte à l'entrée via cet index — donc une entrée sans
	// décision n'est jamais visitée, donc jamais écrite.
	entryIndex: number;
	physical: EnrichFieldGroupDecision | null;
	nutrition: EnrichFieldGroupDecision | null;
	// `null` = l'entrée n'avait rien de ce groupe à revoir (pas "skip")
}

// Validates `.gram/config.yaml` / `~/.config/gram/config.yaml` at load time (audit
// Phase 3/Chantier 5) — these files can be shared/committed in a team repo, so a
// malformed field should fail with a clear message instead of surfacing as a
// confusing crash somewhere deep in the pipeline.
// The provider list lives here rather than in `core/ai.ts` so that validating a
// `--provider` flag or a config file costs nothing: `core/ai.ts` pulls in all
// four @ai-sdk packages at import time, and every command loads `types.ts`.
export const AI_PROVIDERS = [
	"google",
	"openai",
	"anthropic",
	"ollama",
] as const;
export type AiProvider = (typeof AI_PROVIDERS)[number];

export const GramConfigFileSchema = z.object({
	version: z.number().optional(),
	database: z.string().optional(),
	language: z.string().optional(),
	ai: z
		.object({
			provider: z.enum(AI_PROVIDERS).optional(),
			model: z.string().optional(),
			apiKey: z.string().optional(),
			baseUrl: z.string().optional(),
		})
		.optional(),
});

export type GramConfig = z.infer<typeof GramConfigFileSchema> & {
	/** Absolute path to the project root (.gram/ directory ancestor). Set by loadConfig() — never present in the on-disk config.yaml file. */
	projectRoot?: string;
};

export interface PipelineOptions {
	db?: Record<string, IngredientData> | null;
	skipAnalyzer?: boolean;
	scaleFactor?: number;
	bakersReference?: string;
	bakersMathOnly?: boolean;
	/** Recipe language (from `.gram/config.yaml`'s `language:`), threaded to `analyze()` — see i18n findings F-04/F-07/F-08/F-09. */
	lang?: string;
}

export interface CheckOptions {
	db?: Record<string, IngredientData> | null;
	strict?: boolean;
}

export interface BuildOptions {
	db?: Record<string, IngredientData> | null;
	pretty?: boolean;
	scaleFactor?: number;
	lang?: string;
}
