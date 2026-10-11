import { getDictionary } from "@gram-lang/i18n";
import type { ProcessedStep } from "@gram-lang/kitchen";
import type { RenderableCompilationResult } from "./types";
import { formatDecimalToFraction, getQty } from "./utils";

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

/** One thing to take out before a passage. */
export interface KitItem {
	kind: "ingredient" | "prepared" | "cookware";
	/** Plain text: each output escapes it its own way. */
	name: string;
	/** "90 g", the sum over the passage. */
	quantity?: string;
	/** What the sum is made of, "60 + 30", when more than one section needs it. */
	detail?: string;
	/** "made Thursday", "in stock". */
	note?: string;
}

export interface PassageKitOptions {
	lang?: string;
	/**
	 * What to say of an intermediate that an earlier passage makes: "made
	 * Thursday". `maker` is the section that produces it. Without an answer the
	 * preparation is listed with no note.
	 */
	madeBefore?: (intermediate: string, maker: number) => string | undefined;
}

const SUM_EPS = 1e-9;

const unitSuffix = (unit?: string | null) => (unit ? ` ${unit}` : "");

/**
 * What to take out for a passage, from the sections that have work in it:
 * the ingredients (the same one asked by two sections is summed, with the
 * detail of the sum), then the preparations an earlier passage made (named by
 * the section that makes them), then the cookware, without duplicates.
 *
 * An intermediate made inside the passage is not listed: it is not taken from
 * anywhere. An ingredient standing for a `--stock`ed import is marked "in
 * stock". Everything is read from the compiled recipe: nothing is invented.
 */
export function passageKit(
	data: RenderableCompilationResult,
	sections: number[],
	options: PassageKitOptions = {},
): KitItem[] {
	const t = getDictionary(options.lang).renderer;
	const registry = data.registry;
	const makers = intermediateMakers(data);
	const here = new Set(sections);

	interface Line {
		id: string;
		unit: string;
		numbers: number[];
		text?: string;
	}
	const lines: Line[] = [];
	const byKey = new Map<string, Line>();
	const prepared: KitItem[] = [];
	const preparedSeen = new Set<string>();
	const cookwareIds: string[] = [];

	for (const index of [...sections].sort((a, b) => a - b)) {
		const section = data.sections?.[index];
		if (!section) continue;
		for (const usage of section.ingredients as unknown as Record<
			string,
			unknown
		>[]) {
			const id = String(usage.id ?? "");
			if (usage.type === "reference") {
				const maker = makers.get(normalize(id));
				const entry = registry?.ingredients?.[id];
				if (maker === undefined && entry?.is_module_synthetic) {
					// A base kept in stock: nothing makes it in this recipe.
					if (preparedSeen.has(id)) continue;
					preparedSeen.add(id);
					prepared.push({
						kind: "prepared",
						name: String(usage.name ?? entry.name ?? id),
						note: t.workPlanInStock,
					});
					continue;
				}
				if (maker === undefined || here.has(maker)) continue;
				if (preparedSeen.has(id)) continue;
				preparedSeen.add(id);
				const title =
					data.sections?.[maker]?.title ||
					String(usage.name ?? registry?.ingredients?.[id]?.name ?? id);
				const note = options.madeBefore?.(id, maker);
				prepared.push({
					kind: "prepared",
					name: title,
					...(note !== undefined && { note }),
				});
				continue;
			}
			const unit = typeof usage.unit === "string" ? usage.unit : "";
			const qty = getQty(usage);
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
				lines.push({
					id,
					unit,
					numbers: [],
					...(qty?.text !== undefined && { text: qty.text }),
				});
			}
		}
		for (const usage of section.cookware) {
			if (!cookwareIds.includes(usage.id)) cookwareIds.push(usage.id);
		}
	}

	const ingredients: KitItem[] = lines.map((line) => {
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

	const cookware: KitItem[] = cookwareIds.map((id) => ({
		kind: "cookware",
		name: registry?.cookware?.[id]?.name ?? id,
	}));

	return [...ingredients, ...prepared, ...cookware];
}

/** One step of a section's programme: only what it brings to the plan. */
export interface ProgramStep {
	/** Its number in the section, as the recipe view numbers it (comments excluded). */
	n: number;
	action?: string;
	/** "180 °C", "medium heat". */
	temperatures: string[];
	/** "12 to 48 h": the written range, not what the plan chose. */
	timers: string[];
}

/** What one section asks for in a passage, in a few words, and where to read the rest. */
export interface SectionProgram {
	section: number;
	title: string;
	/** The file an imported section comes from, "biscuit-pistache.gram". */
	origin?: string;
	/** First and last step number the passage covers, and how many steps. */
	from: number;
	to: number;
	/** The steps that bring an action, a temperature or a timer; the others only count in `from`..`to`. */
	steps: ProgramStep[];
}

const baseName = (uri: string) => uri.split(/[\\/]/).pop() || uri;

/**
 * The programme of a section for a passage: for each of the steps it has
 * there, in order, the action in brackets, the temperatures and the timers,
 * as written in the recipe. A step with none of the three is left out of the
 * list but stays counted in `from`..`to`, so the renvoi to the recipe is exact.
 * An imported section carries the name of its file.
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
	const picked = [...new Set(stepIndexes)]
		.filter((i) => numbering.has(i))
		.sort((a, b) => a - b);
	const steps: ProgramStep[] = [];
	for (const index of picked) {
		const step = source.steps[index] as ProcessedStep;
		const temperatures: string[] = [];
		const timers: string[] = [];
		for (const raw of step.content) {
			if (typeof raw !== "object" || raw === null || !("type" in raw)) {
				continue;
			}
			const token = raw as Record<string, any>;
			if (token.type === "temperature") {
				const q = token.quantity;
				if (q && q.value !== undefined) {
					temperatures.push(`${q.text ?? q.value}${unitSuffix(token.unit)}`);
				} else if (token.text) temperatures.push(token.text);
			} else if (token.type === "timer") {
				const q = token.quantity as
					| {
							type?: string;
							text?: string;
							value?: unknown;
							range?: { min: number; max: number };
					  }
					| undefined;
				const value =
					q?.type === "range" && q.range
						? t.workPlanRange
								.replace("{min}", String(q.range.min))
								.replace("{max}", String(q.range.max))
						: String(q?.text ?? q?.value ?? "");
				if (value) timers.push(`${value}${unitSuffix(token.unit)}`);
			}
		}
		if (!step.action && temperatures.length === 0 && timers.length === 0) {
			continue;
		}
		steps.push({
			n: numbering.get(index)!,
			...(step.action && { action: step.action }),
			temperatures,
			timers,
		});
	}
	const numbers = picked.map((i) => numbering.get(i)!);
	if (numbers.length === 0) return undefined;
	return {
		section,
		title: source.title || t.runSheetUnnamedSection,
		...(source.module && { origin: baseName(source.module.uri) }),
		from: numbers[0]!,
		to: numbers.at(-1)!,
		steps,
	};
}
