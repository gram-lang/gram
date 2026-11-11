import { fillTemplate, getDictionary } from "@gram-lang/i18n";
import type { RenderableCompilationResult } from "../types";

/**
 * The portions of the recipe in words (`4 portions`), with the scale when the
 * recipe was scaled (`6 portions (×1.5)`). `undefined` when the recipe gives
 * no `portions`.
 */
export function portionsLabel(
	data: RenderableCompilationResult,
	lang?: string,
): string | undefined {
	const portions = (data.meta as Record<string, unknown> | undefined)?.portions;
	if (portions === undefined || portions === null || String(portions) === "") {
		return undefined;
	}
	const t = getDictionary(lang).renderer;
	const scale = data.scaleFactor;
	if (typeof scale === "number" && Math.abs(scale - 1) > 1e-6) {
		return fillTemplate(t.servingsScaled, {
			count: String(portions),
			factor: new Intl.NumberFormat(lang || "en", {
				maximumFractionDigits: 2,
			}).format(scale),
		});
	}
	return fillTemplate(t.servings, { count: String(portions) });
}

/**
 * The word for the portions alone, after a number written next to it
 * ("portions", "portion"), in the plural form the count takes in that language:
 * French says "1,5 portion", English "1.5 portions".
 */
export function portionsUnit(count: unknown, lang?: string): string {
	const units = getDictionary(lang).renderer.portionsUnit;
	const n =
		typeof count === "number" ? count : Number.parseFloat(String(count));
	if (Number.isNaN(n)) return units.other;
	const category = new Intl.PluralRules(lang || "en").select(n);
	return category === "one" ? units.one : units.other;
}

/** A scale factor as the hero bar shows it: "×1.5", "×0,5". */
export function formatScaleFactor(factor: number, lang?: string): string {
	return `×${new Intl.NumberFormat(lang || "en", { maximumFractionDigits: 2 }).format(factor)}`;
}
