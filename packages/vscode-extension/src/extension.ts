import * as path from "node:path";
import * as vscode from "vscode";
import type { ExtensionContext } from "vscode";
import { createClientOptions } from "./client-options";
import {
	LanguageClient,
	type ServerOptions,
	TransportKind,
} from "vscode-languageclient/node";
import { ViewsController } from "./views/controller";
import {
	readViewsCapability,
	type ServeSuggestions,
	type SessionChoices,
	type ViewUpdate,
} from "./views/protocol";

let client: LanguageClient | undefined;

export async function activate(context: ExtensionContext): Promise<void> {
	const serverModule = context.asAbsolutePath(path.join("dist", "server.cjs"));

	const serverOptions: ServerOptions = {
		run: { module: serverModule, transport: TransportKind.ipc },
		debug: {
			module: serverModule,
			transport: TransportKind.ipc,
			options: { execArgv: ["--nolazy", "--inspect=6009"] },
		},
	};

	client = new LanguageClient(
		"gramLanguageServer",
		"Gram Language Server",
		serverOptions,
		createClientOptions(),
	);

	let views: ViewsController | undefined;
	try {
		await client.start();
		const capability = readViewsCapability(client.initializeResult);
		if (capability) {
			const languageClient = client;
			views = new ViewsController(
				capability,
				context.extensionUri,
				(uri, viewIds) => {
					void languageClient.sendNotification("gram/setOpenViews", {
						uri,
						viewIds,
					});
				},
				{
					sendSession: (uri, session) => {
						void languageClient.sendNotification("gram/setSession", {
							uri,
							...session,
						});
					},
					serveTimes: (uri) =>
						languageClient.sendRequest<ServeSuggestions | null>(
							"gram/serveTimes",
							{ uri },
						),
					sessionChoices: (uri) =>
						languageClient.sendRequest<SessionChoices | null>(
							"gram/sessionChoices",
							{ uri },
						),
				},
			);
			context.subscriptions.push(views);
			client.onNotification("gram/viewUpdated", (update: ViewUpdate) =>
				views?.update(update),
			);
		}
	} catch (error) {
		vscode.window.showErrorMessage(
			`The Gram language server failed to start: ${error instanceof Error ? error.message : String(error)}`,
		);
	}

	const open = (outputId: string) => views?.open(outputId);
	let warnedGanttCommand = false;

	context.subscriptions.push(
		vscode.commands.registerCommand("gram.showView", async () => {
			if (!views) return;
			const picked = await vscode.window.showQuickPick(
				views.outputs.map((output) => ({
					label: output.label,
					description: output.kind === "inspector" ? output.id : undefined,
					outputId: output.id,
				})),
				{ placeHolder: "Show a view of the recipe" },
			);
			if (picked) open(picked.outputId);
		}),
		vscode.commands.registerCommand("gram.showPreview", () => open("recipe")),
		vscode.commands.registerCommand("gram.showNutrition", () =>
			open("recipe")?.showMacros(),
		),
		vscode.commands.registerCommand("gram.showRunSheet", () =>
			open("workPlan"),
		),
		// The Gantt chart is gone from the editor: the command still works for
		// anyone who bound a key to it, and opens the work plan.
		// @remove-in: 2.0.0 [vscode-show-gantt]
		vscode.commands.registerCommand("gram.showGantt", () => {
			if (!warnedGanttCommand) {
				warnedGanttCommand = true;
				vscode.window.showInformationMessage(
					"The Gantt chart has been replaced by the work plan. `Gram: Gantt Chart` opens it for now and will be removed in 2.0.0: use `Gram: Work Plan`.",
				);
			}
			open("workPlan");
		}),
	);
}

export function deactivate(): Thenable<void> | undefined {
	return client?.stop();
}
