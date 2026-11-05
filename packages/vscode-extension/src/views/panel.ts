import * as path from "node:path";
import * as vscode from "vscode";
import {
	isPlanned,
	type OutputInfo,
	type PausedError,
	readServeAt,
	type ServeSuggestions,
	type ViewsCapability,
} from "./protocol";
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

/** What a panel asks of the extension for a view laid out in time. */
export interface PanelServing {
	/** The cook picked a serving time for `uri`, or cleared it (`undefined`). */
	setServeAt(uri: string, serveAt: string | undefined): void;
	/** The serving times to propose for `uri`. */
	suggest(uri: string): Promise<ServeSuggestions | null>;
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
	/** The serving time of the recipe shown, for a view laid out in time. */
	private serveAt: string | undefined;
	/** Whether the page shows the suggestions: only then are they asked for. */
	private suggestOpen = false;
	/** Counts the requests, so an answer for an older one is dropped. */
	private suggestSeq = 0;

	private constructor(
		private readonly panel: vscode.WebviewPanel,
		readonly output: OutputInfo,
		capability: ViewsCapability,
		extensionUri: vscode.Uri,
		private readonly onDispose: () => void,
		private readonly serving: PanelServing | undefined,
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
			...(serving &&
				capability.strings.serving && {
					serving: capability.strings.serving,
				}),
		});
		panel.onDidDispose(() => this.dispose(), null, this.disposables);
		panel.webview.onDidReceiveMessage(
			(message: { type?: string; serveAt?: unknown; open?: unknown }) => {
				if (message.type === "ready") {
					// The page was (re)built, a hidden panel shown again included:
					// it starts empty, with its suggestions folded, so it gets
					// everything.
					this.ready = true;
					this.suggestOpen = false;
					this.post(true);
					this.postServing();
					if (this.macrosPending) this.showMacros();
				} else if (message.type === "showError") {
					void this.showError();
				} else if (message.type === "setServeAt" && this.uri) {
					this.serving?.setServeAt(this.uri, readServeAt(message.serveAt));
				} else if (message.type === "suggest") {
					this.suggestOpen = message.open === true;
					if (this.suggestOpen) void this.refreshSuggestions();
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
		serving?: PanelServing,
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
		return new ViewPanel(
			panel,
			output,
			capability,
			extensionUri,
			onDispose,
			isPlanned(output) ? serving : undefined,
		);
	}

	reveal(): void {
		this.panel.reveal(undefined, true);
	}

	/** Shows `view` of the document `uri`, served at `serveAt` for a view laid out in time. */
	show(uri: string, view: PanelView, serveAt?: string): void {
		const contentChanged =
			uri !== this.uri || view.content !== this.view.content;
		const pausedChanged = view.paused !== this.view.paused;
		const servingChanged = uri !== this.uri || serveAt !== this.serveAt;
		this.uri = uri;
		this.view = view;
		this.serveAt = serveAt;
		const name = path.basename(vscode.Uri.parse(uri).fsPath);
		this.panel.title = `${this.output.label}: ${name}`;
		if (!this.ready) return;
		if (contentChanged || pausedChanged) this.post(contentChanged);
		if (servingChanged) this.postServing();
		// A new plan (an edit, another recipe, other settings) may change what
		// can be served when: ask again while the suggestions are shown.
		if (contentChanged && this.suggestOpen) void this.refreshSuggestions();
	}

	private postServing(): void {
		if (!this.serving) return;
		void this.panel.webview.postMessage({
			type: "serving",
			serveAt: this.serveAt ?? null,
		});
	}

	private async refreshSuggestions(): Promise<void> {
		const uri = this.uri;
		if (!this.serving || !uri) return;
		const seq = ++this.suggestSeq;
		let data: ServeSuggestions | null = null;
		try {
			data = await this.serving.suggest(uri);
		} catch {
			// The server is gone or failed: no suggestions, the field still works.
		}
		if (seq !== this.suggestSeq || this.disposed || uri !== this.uri) return;
		void this.panel.webview.postMessage({ type: "suggestions", data });
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
