import * as path from "node:path";
import * as vscode from "vscode";
import type { OutputInfo, PausedError, ViewsCapability } from "./protocol";
import type { PanelView } from "./state";
import { webviewPage } from "./webview";

function nonce(): string {
	const chars =
		"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
	let text = "";
	for (let i = 0; i < 32; i++) {
		text += chars.charAt(Math.floor(Math.random() * chars.length));
	}
	return text;
}

/**
 * One output in a webview panel: the recipe, the work plan, an inspector. Any
 * output of the server opens in this same panel; it shows the document the
 * panels follow, and what it is told to show.
 */
export class ViewPanel {
	private readonly disposables: vscode.Disposable[] = [];
	private uri: string | undefined;
	private view: PanelView = { content: undefined, paused: undefined };
	private ready = false;
	private macrosPending = false;
	private disposed = false;

	private constructor(
		private readonly panel: vscode.WebviewPanel,
		readonly output: OutputInfo,
		capability: ViewsCapability,
		extensionUri: vscode.Uri,
		private readonly onDispose: () => void,
	) {
		const media = (file: string) =>
			panel.webview
				.asWebviewUri(vscode.Uri.joinPath(extensionUri, "media", file))
				.toString();
		panel.webview.html = webviewPage({
			nonce: nonce(),
			cspSource: panel.webview.cspSource,
			styles: {
				preview: media("preview.css"),
				jsonTree: media("json-tree.css"),
			},
			title: output.label,
			showError: capability.strings.showError,
			outputEmpty: capability.strings.outputEmpty,
		});
		panel.onDidDispose(() => this.dispose(), null, this.disposables);
		panel.webview.onDidReceiveMessage(
			(message: { type?: string }) => {
				if (message.type === "ready") {
					// The page was (re)built, a hidden panel shown again included:
					// it starts empty, so it gets everything.
					this.ready = true;
					this.post(true);
					if (this.macrosPending) this.showMacros();
				} else if (message.type === "showError") {
					void this.showError();
				}
			},
			null,
			this.disposables,
		);
	}

	static create(
		output: OutputInfo,
		capability: ViewsCapability,
		extensionUri: vscode.Uri,
		onDispose: () => void,
	): ViewPanel {
		const column = vscode.window.activeTextEditor
			? vscode.ViewColumn.Beside
			: vscode.ViewColumn.One;
		const panel = vscode.window.createWebviewPanel(
			`gramView.${output.id}`,
			output.label,
			{ viewColumn: column, preserveFocus: true },
			{
				enableScripts: true,
				localResourceRoots: [vscode.Uri.joinPath(extensionUri, "media")],
			},
		);
		return new ViewPanel(panel, output, capability, extensionUri, onDispose);
	}

	reveal(): void {
		this.panel.reveal(undefined, true);
	}

	/** Shows `view` of the document `uri`. */
	show(uri: string, view: PanelView): void {
		const contentChanged =
			uri !== this.uri || view.content !== this.view.content;
		const pausedChanged = view.paused !== this.view.paused;
		this.uri = uri;
		this.view = view;
		const name = path.basename(vscode.Uri.parse(uri).fsPath);
		this.panel.title = `${this.output.label}: ${name}`;
		if (!this.ready) return;
		if (contentChanged || pausedChanged) this.post(contentChanged);
	}

	/** Scrolls the recipe to its nutrition panel, now or once the page is ready. */
	showMacros(): void {
		if (!this.ready) {
			this.macrosPending = true;
			return;
		}
		this.macrosPending = false;
		void this.panel.webview.postMessage({ type: "showMacros" });
	}

	private post(withContent: boolean): void {
		const { content, paused } = this.view;
		if (withContent && content) {
			void this.panel.webview.postMessage({ type: "content", content });
		}
		void this.panel.webview.postMessage({
			type: "paused",
			error: paused ?? null,
		});
	}

	/** Jumps to the error that paused the views, else opens the Problems panel. */
	private async showError(): Promise<void> {
		const error: PausedError | undefined = this.view.paused;
		const target = error?.uri ?? this.uri;
		if (!error?.range || !target) {
			await vscode.commands.executeCommand("workbench.actions.view.problems");
			return;
		}
		try {
			const doc = await vscode.workspace.openTextDocument(
				vscode.Uri.parse(target),
			);
			const start = doc.positionAt(error.range.start);
			const end = doc.positionAt(error.range.end);
			const editor = await vscode.window.showTextDocument(
				doc,
				vscode.ViewColumn.One,
			);
			editor.selection = new vscode.Selection(start, end);
			editor.revealRange(
				new vscode.Range(start, end),
				vscode.TextEditorRevealType.InCenter,
			);
		} catch {
			await vscode.commands.executeCommand("workbench.actions.view.problems");
		}
	}

	dispose(): void {
		if (this.disposed) return;
		this.disposed = true;
		this.onDispose();
		this.panel.dispose();
		while (this.disposables.length) this.disposables.pop()?.dispose();
	}
}
