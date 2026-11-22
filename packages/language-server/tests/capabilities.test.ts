import { describe, expect, it } from "bun:test";
import { TextDocumentSyncKind } from "vscode-languageserver/node";
import { serverCapabilities } from "../src/capabilities";
import type { ClientProfile, ViewsMode } from "../src/client-profile";
import { describeOutputs } from "../src/views";

const profile = (views: ViewsMode): ClientProfile => ({
	views,
	configuration: false,
	watchedFiles: false,
	inlayHintRefresh: false,
});

const MODES: ViewsMode[] = ["protocol", "legacy", "off"];

describe("serverCapabilities", () => {
	it("announces the standard features to every client", () => {
		for (const mode of MODES) {
			const caps = serverCapabilities(profile(mode), "en");
			expect(caps.textDocumentSync).toBe(TextDocumentSyncKind.Incremental);
			expect(caps.documentSymbolProvider).toBe(true);
			expect(caps.definitionProvider).toBe(true);
			expect(caps.hoverProvider).toBe(true);
			expect(caps.foldingRangeProvider).toBe(true);
			expect(caps.completionProvider).toEqual({
				triggerCharacters: ["&", "@", '"'],
			});
			expect(caps.semanticTokensProvider).toMatchObject({ full: true });
			expect(caps.referencesProvider).toBe(true);
			expect(caps.renameProvider).toEqual({ prepareProvider: true });
			expect(caps.documentFormattingProvider).toBe(true);
			expect(caps.codeActionProvider).toBe(true);
			expect(caps.inlayHintProvider).toBe(true);
		}
	});

	it("gives the semantic tokens a non-empty legend", () => {
		const legend = serverCapabilities(profile("off"), undefined)
			.semanticTokensProvider?.legend;
		expect(legend?.tokenTypes.length).toBeGreaterThan(0);
	});

	// Unchanged behavior for now: every client gets the CodeLens and the views.
	it("announces the CodeLens and the views to every client", () => {
		for (const mode of MODES) {
			const caps = serverCapabilities(profile(mode), "en");
			expect(caps.codeLensProvider).toEqual({ resolveProvider: false });
			expect(caps.experimental).toEqual({ gramViews: describeOutputs("en") });
		}
	});

	it("names the views in the editor's language", () => {
		const caps = serverCapabilities(profile("protocol"), "fr");
		expect(caps.experimental).toEqual({ gramViews: describeOutputs("fr") });
	});

	it("does not depend on the workspace capabilities", () => {
		const declared: ClientProfile = {
			views: "protocol",
			configuration: true,
			watchedFiles: true,
			inlayHintRefresh: true,
		};
		expect(serverCapabilities(declared, "en")).toEqual(
			serverCapabilities(profile("protocol"), "en"),
		);
	});
});
