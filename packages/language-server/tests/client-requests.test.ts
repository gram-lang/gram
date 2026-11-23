import { afterEach, describe, expect, it } from "bun:test";
import { Client } from "./helpers/lsp-client";

/*
 * The server sends a client only the requests it declared support for at
 * `initialize`: `workspace/configuration`, the file watcher registration
 * (`client/registerCapability`) and `workspace/inlayHint/refresh`. Helix or
 * eglot log every request they do not understand.
 */

const RECIPE = `## Dough

Mix @flour{200g}.
`;

const GUARDED = [
	"workspace/configuration",
	"client/registerCapability",
	"workspace/inlayHint/refresh",
];

const sent = (client: Client, method: string) =>
	client.requests.filter((r) => r.method === method);

async function until(test: () => boolean, ms = 8000): Promise<void> {
	const started = Date.now();
	while (!test()) {
		if (Date.now() - started > ms) throw new Error(`timed out after ${ms}ms`);
		await new Promise((r) => setTimeout(r, 25));
	}
}

/** Opens a document, waits for its diagnostics, then changes a view setting. */
async function exercise(client: Client): Promise<void> {
	client.open(RECIPE);
	await until(() =>
		client.notes.some((n) => n.method === "textDocument/publishDiagnostics"),
	);
	client.setting = "upfront";
	client.settingChanged();
	await client.settle();
}

let client: Client | undefined;
afterEach(() => client?.stop());

describe("requests from the server to the client", () => {
	it("sends none of them to a client that declared nothing", async () => {
		client = new Client();
		await client.start({ views: false }, { capabilities: {} });
		await exercise(client);
		for (const method of GUARDED) expect(sent(client, method)).toEqual([]);
	}, 20_000);

	it("sends each of them to a client that declared it", async () => {
		client = new Client();
		await client.start(
			{ views: true },
			{
				capabilities: {
					workspace: {
						configuration: true,
						didChangeWatchedFiles: { dynamicRegistration: true },
						inlayHint: { refreshSupport: true },
					},
				},
			},
		);
		await until(
			() => sent(client as Client, "client/registerCapability").length > 0,
		);
		await exercise(client);
		expect(sent(client, "workspace/configuration").length).toBeGreaterThan(0);
		expect(sent(client, "workspace/inlayHint/refresh").length).toBeGreaterThan(
			0,
		);
		const [registration] = sent(client, "client/registerCapability");
		expect(JSON.stringify(registration?.params)).toContain(
			"workspace/didChangeWatchedFiles",
		);
	}, 20_000);

	it("asks for the settings but neither registers a watcher nor refreshes the hints when only the configuration is declared", async () => {
		client = new Client();
		await client.start({ views: false });
		await exercise(client);
		expect(sent(client, "workspace/configuration").length).toBeGreaterThan(0);
		expect(sent(client, "client/registerCapability")).toEqual([]);
		expect(sent(client, "workspace/inlayHint/refresh")).toEqual([]);
	}, 20_000);
});
