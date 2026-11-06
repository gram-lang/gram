/*
 * The views protocol of the language server, as types only: what it sends
 * (`initialize`'s `gramViews`, `gram/viewUpdated`) and answers
 * (`gram/serveTimes`, `gram/sessionChoices`), and what it reads
 * (`gram/setSession`). A client imports these with `import type`, so it
 * speaks the same shapes without a copy of its own; nothing here runs.
 */

import type { GramLocale } from "@gram-lang/i18n";
import type {
	DescribableDiagnostic,
	ErrorDescription,
	InspectorDefinition,
	OutputDefinition,
	ServeSuggestions,
} from "@gram-lang/renderer";
import type { Session } from "./session";

export type { ServeSuggestions, Session };

/** The words of the serving time controls of a view laid out in time. */
export type ServingStrings = GramLocale["renderer"]["serving"];

/** The words of the session controls of a view: scale, baker's reference, stock. */
export type SessionStrings = GramLocale["renderer"]["session"];

/**
 * What a client of the views protocol can show, sent in the `initialize`
 * result (`capabilities.experimental.gramViews`): every output with its name,
 * and the few words a client writes around them, in the editor's language.
 */
export interface ViewsCapability {
	outputs: {
		id: string;
		kind: OutputDefinition["kind"];
		label: string;
		presentation?: InspectorDefinition["presentation"];
		/**
		 * What a view reads from the plan (`schedule`, `runSheet`, ...): a view
		 * that reads the run sheet is laid out in time, so a client offers its
		 * serving time controls.
		 */
		needs?: readonly string[];
	}[];
	strings: {
		showError: string;
		outputEmpty: string;
		/** The serving time controls of a view laid out in time. */
		serving: ServingStrings;
		/** The session controls of a view: scale, baker's reference, stock. */
		session: SessionStrings;
	};
}

/** What an inspector sends: text for a code pane, or the tree's HTML. */
export interface InspectorPayload {
	presentation: InspectorDefinition["presentation"];
	language?: InspectorDefinition["language"];
	text: string;
}

/** Why an output is paused: the primary error, for a banner and a "show problems" button. */
export type PausedError = Omit<
	ErrorDescription<DescribableDiagnostic>,
	"diagnostic"
>;

/**
 * The `gram/viewUpdated` notification: one output of one document.
 *
 * - `ok`: `payload` is the output. A view's HTML, or `null` when the recipe has
 *   nothing for it (a work plan of a recipe with no tasks); an inspector's
 *   `InspectorPayload`.
 * - `paused`: the recipe stopped compiling. No payload: the client keeps the
 *   last one it showed, under a banner made from `error`. `error.range` is in
 *   offsets into `error.uri` (an imported module), or into the document itself
 *   without it.
 */
export type ViewUpdate =
	| {
			uri: string;
			outputId: string;
			kind: OutputDefinition["kind"];
			state: "ok";
			payload: string | InspectorPayload | null;
	  }
	| {
			uri: string;
			outputId: string;
			kind: OutputDefinition["kind"];
			state: "paused";
			error: PausedError;
	  };

/** The answer of `gram/sessionChoices`: what a client offers in its session controls. */
export interface SessionChoices {
	/** The ingredients of the recipe as written, for a target quantity and the baker's reference. */
	ingredients: { id: string; name: string; qty?: number; unit?: string }[];
	/** Every `@use` import of the recipe, nested ones included, that can be marked in stock. */
	imports: { uri: string; specifier: string }[];
	/** Whether baker's percentages are on (`gram.bakersMath`): the reference only matters then. */
	bakersMath: boolean;
	/** Why the session's scale could not be applied, when it could not. */
	scaleError?: string;
}
