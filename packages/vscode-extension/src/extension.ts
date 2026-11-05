import * as path from "node:path";
import * as vscode from "vscode";
import type { ExtensionContext } from "vscode";
import { PreviewPanel } from "./preview";
import { WorkPlanPanel } from "./work-plan-panel";
import { createClientOptions } from "./client-options";
import {
	LanguageClient,
	type ServerOptions,
	TransportKind,
} from "vscode-languageclient/node";

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

	const clientOptions = createClientOptions();

	const previewHtmlCache = new Map<string, string>();
	const workPlanHtmlCache = new Map<string, string>();
	let warnedGanttCommand = false;

	client = new LanguageClient(
		"gramLanguageServer",
		"Gram Language Server",
		serverOptions,
		clientOptions,
	);

	try {
		await client.start();

		client.onNotification(
			"gram/previewUpdated",
			(params: { uri: string; html: string }) => {
				previewHtmlCache.set(params.uri, params.html);
				if (
					PreviewPanel.currentPanel &&
					PreviewPanel.currentPanel.uri === params.uri
				) {
					PreviewPanel.currentPanel.updateHTML(params.html);
				}
			},
		);

		client.onNotification(
			"gram/runSheetUpdated",
			(params: { uri: string; html: string }) => {
				workPlanHtmlCache.set(params.uri, params.html);
				if (
					WorkPlanPanel.currentPanel &&
					WorkPlanPanel.currentPanel.uri === params.uri
				) {
					WorkPlanPanel.currentPanel.updateHTML(params.html);
				}
			},
		);
	} catch (error) {
		vscode.window.showErrorMessage(
			`Échec du démarrage du serveur de langage Gram: ${error instanceof Error ? error.message : String(error)}`,
		);
	}

	const getActiveGramUri = (): string | undefined => {
		const editor = vscode.window.activeTextEditor;
		if (editor && editor.document.languageId === "gram") {
			return editor.document.uri.toString();
		}
		return undefined;
	};

	context.subscriptions.push(
		vscode.window.onDidChangeActiveTextEditor((editor) => {
			if (editor && editor.document.languageId === "gram") {
				const uri = editor.document.uri.toString();
				if (PreviewPanel.currentPanel) {
					PreviewPanel.currentPanel.setUriAndHTML(
						uri,
						previewHtmlCache.get(uri) ?? "",
					);
				}
				if (WorkPlanPanel.currentPanel) {
					WorkPlanPanel.currentPanel.setUriAndHTML(
						uri,
						workPlanHtmlCache.get(uri) ?? "",
					);
				}
			}
		}),
		vscode.commands.registerCommand("gram.showPreview", () => {
			const uri = getActiveGramUri();
			if (!uri) return;
			const html = previewHtmlCache.get(uri) ?? "";
			PreviewPanel.createOrShow(context.extensionUri, uri, html);
		}),
		vscode.commands.registerCommand("gram.showNutrition", () => {
			const uri = getActiveGramUri();
			if (!uri) return;
			const html = previewHtmlCache.get(uri) ?? "";
			PreviewPanel.createOrShow(context.extensionUri, uri, html);
			if (PreviewPanel.currentPanel) {
				PreviewPanel.currentPanel.showMacros();
			}
			vscode.window.showInformationMessage(
				"Panneau des macros ouvert dans l'Aperçu.",
			);
		}),
		vscode.commands.registerCommand("gram.showRunSheet", () => {
			const uri = getActiveGramUri();
			if (!uri) return;
			const html = workPlanHtmlCache.get(uri) ?? "";
			WorkPlanPanel.createOrShow(context.extensionUri, uri, html);
		}),
		// The Gantt chart is gone from the editor: the command still works for
		// anyone who bound a key to it, and opens the work plan.
		// @remove-in: 2.0.0 [vscode-show-gantt]
		vscode.commands.registerCommand("gram.showGantt", () => {
			const uri = getActiveGramUri();
			if (!uri) return;
			if (!warnedGanttCommand) {
				warnedGanttCommand = true;
				vscode.window.showInformationMessage(
					"The Gantt chart has been replaced by the work plan. `Gram: Gantt Chart` opens it for now and will be removed in 2.0.0: use `Gram: Work Plan`.",
				);
			}
			const html = workPlanHtmlCache.get(uri) ?? "";
			WorkPlanPanel.createOrShow(context.extensionUri, uri, html);
		}),
	);
}

export function deactivate(): Thenable<void> | undefined {
	return client?.stop();
}
