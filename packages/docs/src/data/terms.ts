import { getDictionary } from "@gram-lang/i18n";

/**
 * The terms of Gram that the docs name with `<Term id="…" />`: the first
 * mention of one on a page is bold and links to the page that explains it, so
 * that a reader sees, even in a long paragraph, that it is a thing of Gram and
 * not an ordinary expression.
 *
 * A term that is a view takes its name from the renderer's dictionary
 * (`renderer.outputs`), so a renamed view is renamed in the docs too. Other
 * terms give their words here, in every language of the docs.
 */
type Locale = "en" | "fr";

interface Term {
	/** The id of a view of the renderer: the name comes from `renderer.outputs`. */
	view?: string;
	/** The name in each language, for a term that is not a view. */
	words?: Record<Locale, string>;
	/** The page that explains the term, without the locale prefix. */
	href: string;
}

export const TERMS = {
	runSheet: { view: "runSheet", href: "/docs/how-to/plan-a-meal/" },
} satisfies Record<string, Term>;

export type TermId = keyof typeof TERMS;

/** The term's name as a label ("Run sheet", "Plan de marche"). */
export function termLabel(id: TermId, locale: Locale): string {
	const term: Term = TERMS[id];
	if (term.words) return term.words[locale];
	const outputs = getDictionary(locale).renderer.outputs as Record<
		string,
		string
	>;
	const label = term.view ? outputs[term.view] : undefined;
	if (!label) throw new Error(`No name for the term "${id}" in ${locale}.`);
	return label;
}

/** The term's link, in the reader's language. */
export function termHref(id: TermId, locale: Locale): string {
	return `${locale === "fr" ? "/fr" : ""}${TERMS[id].href}`;
}
