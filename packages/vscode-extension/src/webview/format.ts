import type {
	Session,
	SessionChoices,
	SessionStrings,
} from "../views/protocol";

/**
 * `template` with each `{name}` replaced from `values`; an unknown name is left
 * as is. The same as `fillTemplate` of `@gram-lang/i18n`, copied rather than
 * imported: this page script is a browser bundle that imports no Gram package.
 */
export function fill(template: string, values: Record<string, string>): string {
	return template.replace(/\{(\w+)\}/g, (whole, key: string) =>
		key in values ? (values[key] as string) : whole,
	);
}

/** A scale factor as the percent the field shows: 1.5 → "150". */
export const percentOf = (factor: number): string =>
	String(Math.round(factor * 10000) / 100);

/** What the session controls say is active, after their title: "· 200 % · 1 in stock". */
export function sessionSummary(
	session: Session,
	choices: SessionChoices | null,
	s: SessionStrings,
): string {
	const parts: string[] = [];
	const scale = session.scale;
	if (scale?.type === "factor") {
		parts.push(fill(s.scaled, { factor: percentOf(scale.value) }));
	} else if (scale?.type === "target") {
		const item = choices?.ingredients.find((i) => i.id === scale.id);
		parts.push(
			`${scale.qty}${scale.unit ? ` ${scale.unit}` : ""} ${item?.name ?? scale.id}`,
		);
	}
	if (session.bakersReference) {
		parts.push(`${s.bakersReference} : ${session.bakersReference}`);
	}
	const stocked = session.stock?.length ?? 0;
	if (stocked > 0) parts.push(fill(s.inStock, { n: String(stocked) }));
	return parts.length > 0 ? `· ${parts.join(" · ")}` : "";
}
