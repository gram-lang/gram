import type { LanguageClientOptions } from "vscode-languageclient/node";

/**
 * The settings section the language server reads (`gram.*`). Listing it under
 * `synchronize.configurationSection` is what makes the client send
 * `workspace/didChangeConfiguration` when one of them changes: without it the
 * server is never told, so a changed `gram.miseEnPlace` (or the ingredient
 * database path) has no effect until the window is reloaded.
 */
export const CONFIGURATION_SECTION = "gram";

export function createClientOptions(): LanguageClientOptions {
	return {
		documentSelector: [{ scheme: "file", language: "gram" }],
		synchronize: { configurationSection: CONFIGURATION_SECTION },
	};
}
