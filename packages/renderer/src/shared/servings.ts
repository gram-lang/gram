import { fillTemplate, getDictionary } from "@gram-lang/i18n";
import type { RenderableCompilationResult } from "../types";

/**
 * The portions of the recipe in words (`4 servings`), with the scale when the
 * recipe was scaled (`6 servings (×1.5)`). `undefined` when the recipe gives
 * no `portions`.
 */
export function servingsLabel(
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
