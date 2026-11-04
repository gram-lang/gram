import { getDictionary } from "@gram-lang/i18n";
import { formatElement } from "./formatters/element";
import type { RenderableCompilationResult, RenderContext } from "./types";
import {
	escapeHtml,
	escapeMarkdownHtml,
	formatDecimalToFraction,
	getQty,
	joinStepTokens,
} from "./utils";

/** A reference id and an intermediate's name are the same thing written two ways. */
const normalize = (value: string) =>
	value
		.normalize("NFD")
		.replace(/[̀-ͯ]/g, "")
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-|-$/g, "");

/**
 * The section that makes each intermediate (`->&dough`): the one that declares
 * it as a whole, else the one holding the step that declares it.
 */
export function intermediateMakers(
	data: RenderableCompilationResult,
): Map<string, number> {
	const makers = new Map<string, number>();
	(data.sections ?? []).forEach((section, index) => {
		if (section.intermediate_preparation) {
			makers.set(normalize(section.intermediate_preparation), index);
		}
		for (const step of section.steps) {
			if (step.type !== "step") continue;
			for (const token of step.content) {
				if (
					typeof token === "object" &&
					token !== null &&
					"type" in token &&
					token.type === "declaration"
				) {
					makers.set(normalize(token.id), index);
				}
			}
		}
	});
	return makers;
}

/** One thing to take out before a visit. */
export interface KitItem {
	kind: "ingredient" | "prepared" | "cookware";
	/** Plain text: each output escapes it its own way. */
	name: string;
	/** "90 g", the sum over the visit. */
	quantity?: string;
	/** What the sum is made of, "60 + 30", when more than one section needs it. */
	detail?: string;
	/** "made Thursday", "in stock". */
	note?: string;
}

export interface VisitKitOptions {
	lang?: string;
	/**
	 * What to say of an intermediate that an earlier visit makes: "made
	 * Thursday". `maker` is the section that produces it. Without an answer the
	 * preparation is listed with no note.
	 */
	madeBefore?: (intermediate: string, maker: number) => string | undefined;
}

const SUM_EPS = 1e-9;

const unitSuffix = (unit?: string | null) => (unit ? ` ${unit}` : "");

const sortedSections = (sections: Iterable<number>) =>
	[...new Set(sections)].sort((a, b) => a - b);

/**
 * The raw ingredients the given sections use, the same one asked twice summed
 * with the detail of the sum. A preparation (`&dough`) is not an ingredient
 * here: `kitPrepared` lists it.
 */
export function kitIngredients(
	data: RenderableCompilationResult,
	sections: number[],
	options: { lang?: string } = {},
): KitItem[] {
	const t = getDictionary(options.lang).renderer;
	const registry = data.registry;
	interface Line {
		id: string;
		unit: string;
		numbers: number[];
		text?: string;
	}
	const lines: Line[] = [];
	const byKey = new Map<string, Line>();
	for (const index of sortedSections(sections)) {
		const section = data.sections?.[index];
		if (!section) continue;
		for (const usage of section.ingredients as unknown as Record<
			string,
			unknown
		>[]) {
			if (usage.type === "reference") continue;
			const id = String(usage.id ?? "");
			const unit = typeof usage.unit === "string" ? usage.unit : "";
			if (typeof usage.qty === "number") {
				const key = `${id}|${unit}`;
				let line = byKey.get(key);
				if (!line) {
					line = { id, unit, numbers: [] };
					byKey.set(key, line);
					lines.push(line);
				}
				line.numbers.push(usage.qty);
			} else {
				const qty = getQty(usage);
				lines.push({
					id,
					unit,
					numbers: [],
					...(qty?.text !== undefined && { text: qty.text }),
				});
			}
		}
	}
	return lines.map((line) => {
		const entry = registry?.ingredients?.[line.id];
		const name = entry?.name ?? line.id;
		const total = line.numbers.reduce((sum, n) => sum + n, 0);
		const hasNumbers = line.numbers.length > 0;
		const quantity = hasNumbers
			? `${formatDecimalToFraction(total, line.unit)}${unitSuffix(line.unit)}`
			: line.text !== undefined
				? `${line.text}${unitSuffix(line.unit)}`
				: undefined;
		const many = line.numbers.length > 1 && Math.abs(total) > SUM_EPS;
		return {
			kind: "ingredient",
			name,
			...(quantity !== undefined && { quantity }),
			...(many && {
				detail: line.numbers
					.map((n) => formatDecimalToFraction(n, line.unit))
					.join(" + "),
			}),
			...(entry?.is_module_synthetic && { note: t.workPlanInStock }),
		};
	});
}

/**
 * The preparations the given sections use, each once: an intermediate made by
 * another section (named by the section that makes it) or a base kept in stock.
 * One that a section in `present` makes is left out: it is not taken from
 * anywhere.
 */
export function kitPrepared(
	data: RenderableCompilationResult,
	sections: number[],
	options: VisitKitOptions & { present?: Iterable<number> } = {},
): KitItem[] {
	const t = getDictionary(options.lang).renderer;
	const registry = data.registry;
	const makers = intermediateMakers(data);
	const present = new Set(options.present ?? sections);
	const seen = new Set<string>();
	const prepared: KitItem[] = [];
	for (const index of sortedSections(sections)) {
		const section = data.sections?.[index];
		if (!section) continue;
		for (const usage of section.ingredients as unknown as Record<
			string,
			unknown
		>[]) {
			if (usage.type !== "reference") continue;
			const id = String(usage.id ?? "");
			const maker = makers.get(normalize(id));
			const entry = registry?.ingredients?.[id];
			if (maker === undefined && entry?.is_module_synthetic) {
				// A base kept in stock: nothing makes it in this recipe.
				if (seen.has(id)) continue;
				seen.add(id);
				prepared.push({
					kind: "prepared",
					name: String(usage.name ?? entry.name ?? id),
					note: t.workPlanInStock,
				});
				continue;
			}
			if (maker === undefined || present.has(maker)) continue;
			if (seen.has(id)) continue;
			seen.add(id);
			const title =
				data.sections?.[maker]?.title ||
				String(usage.name ?? registry?.ingredients?.[id]?.name ?? id);
			const note = options.madeBefore?.(id, maker);
			prepared.push({
				kind: "prepared",
				name: title,
				...(note !== undefined && { note }),
			});
		}
	}
	return prepared;
}

/** The cookware the given sections use, without duplicates. */
export function kitCookware(
	data: RenderableCompilationResult,
	sections: number[],
): KitItem[] {
	const ids: string[] = [];
	for (const index of sortedSections(sections)) {
		for (const usage of data.sections?.[index]?.cookware ?? []) {
			if (!ids.includes(usage.id)) ids.push(usage.id);
		}
	}
	return ids.map((id) => ({
		kind: "cookware",
		name: data.registry?.cookware?.[id]?.name ?? id,
	}));
}

/**
 * What to take out for a visit, from the sections that have work in it:
 * the ingredients (the same one asked by two sections is summed, with the
 * detail of the sum), then the preparations an earlier visit made (named by
 * the section that makes them), then the cookware, without duplicates.
 *
 * An intermediate made inside the visit is not listed: it is not taken from
 * anywhere. An ingredient standing for a `--stock`ed import is marked "in
 * stock". Everything is read from the compiled recipe: nothing is invented.
 */
export function visitKit(
	data: RenderableCompilationResult,
	sections: number[],
	options: VisitKitOptions = {},
): KitItem[] {
	return [
		...kitIngredients(data, sections, options),
		...kitPrepared(data, sections, { ...options, present: sections }),
		...kitCookware(data, sections),
	];
}

/** What one section asks for in a visit: where to read it in the recipe. */
export interface SectionProgram {
	section: number;
	title: string;
	/** The file an imported section comes from, "biscuit-pistache.gram". */
	origin?: string;
	/** First and last step number the visit covers, as the recipe view numbers them. */
	from: number;
	to: number;
}

const baseName = (uri: string) => uri.split(/[\\/]/).pop() || uri;

/**
 * The programme of a section for a visit: its title and the range of steps
 * the visit covers, from the first to the last, numbered as the recipe view
 * numbers them (comments excluded). An imported section carries the name of
 * its file.
 *
 * `stepIndexes` are indexes in the section's `steps`, comments included.
 */
export function sectionProgram(
	data: RenderableCompilationResult,
	section: number,
	stepIndexes: number[],
	options: { lang?: string } = {},
): SectionProgram | undefined {
	const t = getDictionary(options.lang).renderer;
	const source = data.sections?.[section];
	if (!source) return undefined;
	const numbering = new Map<number, number>();
	let n = 0;
	source.steps.forEach((s, i) => {
		if (s.type === "step") numbering.set(i, ++n);
	});
	const numbers = [...new Set(stepIndexes)]
		.filter((i) => numbering.has(i))
		.sort((a, b) => a - b)
		.map((i) => numbering.get(i)!);
	if (numbers.length === 0) return undefined;
	return {
		section,
		title: source.title || t.runSheetUnnamedSection,
		...(source.module && { origin: baseName(source.module.uri) }),
		from: numbers[0]!,
		to: numbers.at(-1)!,
	};
}

/** One line of a section's steps in a visit: a step as the recipe numbers it, or a standalone note. */
export interface ProgramStep {
	/** The number the recipe view gives the step; absent for a note. */
	number?: number;
	/** The explicit action of the step (`[Mix]`), when it has one. */
	action?: string;
	/** True for a standalone comment: shown, never numbered. */
	comment?: boolean;
	/** The tokens as HTML: no icons, nothing that a printed sheet cannot show. */
	html: string;
	/** The same line as Markdown, without the action. */
	md: string;
	/** The same line as plain text, without the action. */
	text: string;
}

const entities: Record<string, string> = {
	"&amp;": "&",
	"&lt;": "<",
	"&gt;": ">",
	"&quot;": '"',
	"&#039;": "'",
};

/** The text of an HTML fragment this renderer wrote: tags dropped, entities back, spaces folded. */
const htmlToText = (html: string) =>
	html
		.replace(/<[^>]*>/g, "")
		.replace(/&(?:amp|lt|gt|quot|#039);/g, (m) => entities[m] ?? m)
		.replace(/\s+/g, " ")
		.replace(/\s+([.,!?:;)])/g, "$1")
		.trim();

/**
 * The steps a section does in a visit, written out: for the work plan, which
 * is read on paper. Each step is as the recipe view numbers it (comments
 * excluded) and says the same thing; only the icons are left out, since a
 * printed sheet has no use for them.
 *
 * A standalone comment goes with the step that follows it, so a note that
 * warns about a step is read in the visit where the step is done; one at the
 * very end goes with the step before it.
 *
 * `stepIndexes` are indexes in the section's `steps`, comments included.
 */
export function sectionSteps(
	data: RenderableCompilationResult,
	section: number,
	stepIndexes: number[],
	options: { lang?: string } = {},
): ProgramStep[] {
	const source = data.sections?.[section];
	if (!source) return [];
	const wanted = new Set(stepIndexes);
	const context: RenderContext = {
		lang: options.lang,
		registry: data.registry,
		hideIngredientQty: true,
		icons: {
			timer: "",
			hourglass: "",
			thermometer: "",
			caretRight: "",
			arrowRight: "",
			arrowElbowDownRight: "",
		},
	};
	const out: ProgramStep[] = [];
	let pending: ProgramStep[] = [];
	let number = 0;
	let lastWasKept = false;
	source.steps.forEach((item, index) => {
		if (item.type === "comment") {
			const value = String(item.value ?? "").trim();
			if (!value) return;
			const note: ProgramStep = {
				comment: true,
				html: escapeHtml(value),
				md: escapeMarkdownHtml(value),
				text: value,
			};
			// A note after the last kept step and before the next one waits for it.
			pending.push(note);
			return;
		}
		number++;
		if (!wanted.has(index)) {
			pending = [];
			lastWasKept = false;
			return;
		}
		out.push(...pending);
		pending = [];
		lastWasKept = true;
		const tokens = item.content ?? [];
		const isDeclaration = (c: (typeof tokens)[number]) =>
			typeof c === "object" && c.type === "declaration";
		const inline = tokens.filter((c) => !isDeclaration(c));
		const declarations = tokens.filter(isDeclaration);
		const spaceable = (c: unknown, skipDeclaration: boolean) =>
			!!c &&
			typeof c === "object" &&
			(c as { type?: string }).type !== "comment" &&
			(!skipDeclaration || (c as { type?: string }).type !== "declaration");
		const html =
			joinStepTokens(
				inline,
				(c) => formatElement(c, "html", context),
				(c) => spaceable(c, true),
			) +
			joinStepTokens(
				declarations,
				(c) => formatElement(c, "html", context),
				(c) => spaceable(c, true),
			);
		const md = joinStepTokens(
			tokens,
			(c) => formatElement(c, "md", context),
			(c) => spaceable(c, false),
		);
		out.push({
			number,
			...(item.action && { action: item.action }),
			html: html.trim(),
			md: md.trim(),
			text: htmlToText(html),
		});
	});
	// What is left after the last step: it follows that step into the visit.
	if (lastWasKept) out.push(...pending);
	return out;
}
