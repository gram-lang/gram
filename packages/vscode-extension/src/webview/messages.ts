/*
 * The messages between a view panel and its page, typed once for both sides:
 * the extension (`views/panel.ts`) and the page script (`webview/view.ts`).
 */

import type {
	Content,
	PausedError,
	ServeSuggestions,
	ServingStrings,
	Session,
	SessionChoices,
	SessionPatch,
	SessionStrings,
} from "../views/protocol";

/** What the extension sends the page. */
export type ToPage =
	/** Replace what is shown. */
	| { type: "content"; content: Content }
	/** Dim the content under a banner, or, with `null`, show it normally again. */
	| { type: "paused"; error: PausedError | null }
	/** Scroll to the nutrition panel of the recipe. */
	| { type: "showMacros" }
	/** What the cook chose for the recipe this sitting. */
	| { type: "session"; session: Session }
	/** The serving times to propose (a view laid out in time). */
	| { type: "suggestions"; data: ServeSuggestions | null }
	/** What the session controls offer. */
	| { type: "choices"; data: SessionChoices | null };

/** What the page sends the extension. */
export type FromPage =
	/** It can receive; sent again whenever VS Code rebuilds a hidden panel. */
	| { type: "ready" }
	/** The banner's button. */
	| { type: "showError" }
	/** The cook changed a part of the session (`null` clears it). */
	| { type: "setSession"; patch: SessionPatch }
	/** The serving time suggestions were shown or hidden. */
	| { type: "suggest"; open: boolean }
	/** The session controls were shown or hidden. */
	| { type: "choose"; open: boolean };

/** The words the page writes, read from `data-strings` of its body. */
export interface PageStrings {
	outputEmpty: string;
	serving?: ServingStrings;
	session?: SessionStrings;
}
