import { describe, expect, it } from "bun:test";
import type { InitializeParams } from "vscode-languageserver/node";
import { clientProfileOf } from "../src/client-profile";

const params = (over: Partial<InitializeParams> = {}): InitializeParams => ({
	processId: null,
	rootUri: null,
	capabilities: {},
	...over,
});

const viewsOf = (initializationOptions: unknown) =>
	clientProfileOf(params({ initializationOptions })).views;

describe("clientProfileOf", () => {
	describe("views", () => {
		it("is the views protocol for views: true", () => {
			expect(viewsOf({ views: true })).toBe("protocol");
		});

		it("is off for views: false", () => {
			expect(viewsOf({ views: false })).toBe("off");
		});

		it("is legacy when the client says nothing", () => {
			expect(viewsOf(undefined)).toBe("legacy");
			expect(viewsOf(null)).toBe("legacy");
			expect(viewsOf({})).toBe("legacy");
		});

		it("is legacy for any value other than a boolean", () => {
			for (const views of ["true", "false", 0, 1, null, {}, []]) {
				expect(viewsOf({ views })).toBe("legacy");
			}
			expect(viewsOf("views")).toBe("legacy");
			expect(viewsOf(42)).toBe("legacy");
		});
	});

	it("declares nothing for a client with empty capabilities", () => {
		expect(clientProfileOf(params())).toEqual({
			views: "legacy",
			configuration: false,
			watchedFiles: false,
			inlayHintRefresh: false,
			snippets: false,
			documentChanges: false,
		});
	});

	it("reads documentChanges support from the workspace edit capability", () => {
		const of = (documentChanges: unknown) =>
			clientProfileOf(
				params({
					capabilities: {
						workspace: { workspaceEdit: { documentChanges } },
					} as InitializeParams["capabilities"],
				}),
			).documentChanges;
		expect(of(true)).toBe(true);
		expect(of(false)).toBe(false);
		expect(of(undefined)).toBe(false);
	});

	it("reads snippet support from the completion capability", () => {
		const completion = (snippetSupport: unknown) =>
			clientProfileOf(
				params({
					capabilities: {
						textDocument: {
							completion: { completionItem: { snippetSupport } },
						},
					} as InitializeParams["capabilities"],
				}),
			).snippets;
		expect(completion(true)).toBe(true);
		expect(completion(false)).toBe(false);
		expect(completion("true")).toBe(false);
	});

	it("reads the three workspace capabilities", () => {
		const profile = clientProfileOf(
			params({
				capabilities: {
					workspace: {
						configuration: true,
						didChangeWatchedFiles: { dynamicRegistration: true },
						inlayHint: { refreshSupport: true },
					},
				},
			}),
		);
		expect(profile.configuration).toBe(true);
		expect(profile.watchedFiles).toBe(true);
		expect(profile.inlayHintRefresh).toBe(true);
	});

	it("reads each capability on its own", () => {
		const only = (workspace: object) =>
			clientProfileOf(params({ capabilities: { workspace } }));
		expect(only({ configuration: true })).toMatchObject({
			configuration: true,
			watchedFiles: false,
			inlayHintRefresh: false,
		});
		expect(
			only({ didChangeWatchedFiles: { dynamicRegistration: true } }),
		).toMatchObject({
			configuration: false,
			watchedFiles: true,
			inlayHintRefresh: false,
		});
		expect(only({ inlayHint: { refreshSupport: true } })).toMatchObject({
			configuration: false,
			watchedFiles: false,
			inlayHintRefresh: true,
		});
	});

	it("needs dynamic registration, not just the watched files capability", () => {
		const profile = clientProfileOf(
			params({
				capabilities: {
					workspace: { didChangeWatchedFiles: { dynamicRegistration: false } },
				},
			}),
		);
		expect(profile.watchedFiles).toBe(false);
	});
});
