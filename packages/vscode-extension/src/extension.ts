import * as path from "node:path";
import * as vscode from "vscode";
import type { ExtensionContext } from "vscode";
import { PreviewPanel } from "./preview";
import { GanttPanel } from "./gantt-panel";
import {
	LanguageClient,
	type LanguageClientOptions,
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

	const clientOptions: LanguageClientOptions = {
		documentSelector: [{ scheme: "file", language: "gram" }],
	};

	const previewHtmlCache = new Map<string, string>();
	const ganttHtmlCache = new Map<string, string>();

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
			"gram/ganttUpdated",
			(params: { uri: string; html: string }) => {
				ganttHtmlCache.set(params.uri, params.html);
				if (
					GanttPanel.currentPanel &&
					GanttPanel.currentPanel.uri === params.uri
				) {
					GanttPanel.currentPanel.updateHTML(params.html);
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
				if (GanttPanel.currentPanel) {
					GanttPanel.currentPanel.setUriAndHTML(
						uri,
						ganttHtmlCache.get(uri) ?? "",
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
		vscode.commands.registerCommand("gram.showGantt", () => {
			const uri = getActiveGramUri();
			if (!uri) return;
			const html = ganttHtmlCache.get(uri) ?? "";
			GanttPanel.createOrShow(context.extensionUri, uri, html);
		}),
	);
}

export function deactivate(): Thenable<void> | undefined {
	return client?.stop();
}
