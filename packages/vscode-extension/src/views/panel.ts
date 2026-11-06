import * as path from "node:path";
import * as vscode from "vscode";
import {
	isPlanned,
	type OutputInfo,
	type PausedError,
	readSessionPatch,
	type ServeSuggestions,
	type Session,
	type SessionChoices,
	type SessionPatch,
	type ViewsCapability,
} from "./protocol";
import type { PanelView } from "./state";
import type { FromPage, ToPage } from "../webview/messages";
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

/** What a panel of a view asks of the extension for the session of its recipe. */
export interface PanelSession {
	/** The cook changed a part of the session of `uri` (`null` clears it). */
	update(uri: string, patch: SessionPatch): void;
	/** The serving times to propose for `uri` (a view laid out in time). */
	suggest(uri: string): Promise<ServeSuggestions | null>;
	/** What the session controls offer for `uri`. */
	choices(uri: string): Promise<SessionChoices | null>;
}

/** An answer asked while a part of the page is shown, dropped when an older one comes late. */
class Asked<T> {
	open = false;
	private seq = 0;

	async ask(
		fetch: () => Promise<T | null>,
		deliver: (data: T | null) => void,
		stillWanted: () => boolean,
	): Promise<void> {
		const seq = ++this.seq;
		let data: T | null = null;
		try {
			data = await fetch();
		} catch {
			// The server is gone or failed: nothing to offer, the fields still work.
		}
		if (seq === this.seq && stillWanted()) deliver(data);
	}
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
	/** What the cook chose for the recipe shown. */
	private session: Session = {};
	/** The serving time suggestions, asked only while the page shows them. */
	private readonly suggestions = new Asked<ServeSuggestions>();
	/** The session choices, asked only while the page shows the controls. */
	private readonly choices = new Asked<SessionChoices>();
	/** Whether this view is laid out in time, and so offers a serving time. */
	private readonly planned: boolean;

	private constructor(
		private readonly panel: vscode.WebviewPanel,
		readonly output: OutputInfo,
		capability: ViewsCapability,
		extensionUri: vscode.Uri,
		private readonly onDispose: () => void,
		private readonly sessionHost: PanelSession | undefined,
	) {
		this.planned = isPlanned(output);
		const asset = (...segments: string[]) =>
			panel.webview
				.asWebviewUri(vscode.Uri.joinPath(extensionUri, ...segments))
				.toString();
		panel.webview.html = webviewPage({
			nonce: nonce(),
			cspSource: panel.webview.cspSource,
			styles: {
				preview: asset("media", "preview.css"),
				jsonTree: asset("media", "json-tree.css"),
				view: asset("dist", "webview", "view.css"),
			},
			script: asset("dist", "webview", "view.js"),
			title: output.label,
			showError: capability.strings.showError,
			outputEmpty: capability.strings.outputEmpty,
			...(sessionHost &&
				this.planned &&
				capability.strings.serving && {
					serving: capability.strings.serving,
				}),
			...(sessionHost &&
				capability.strings.session && {
					session: capability.strings.session,
				}),
		});
		panel.onDidDispose(() => this.dispose(), null, this.disposables);
		panel.webview.onDidReceiveMessage(
			// Typed as the page sends them, but read with care: the page shows
			// a recipe's HTML.
			(message: Partial<FromPage> & { patch?: unknown; open?: unknown }) => {
				if (message.type === "ready") {
					// The page was (re)built, a hidden panel shown again included:
					// it starts empty, with its suggestions folded, so it gets
					// everything.
					this.ready = true;
					this.suggestions.open = false;
					this.choices.open = false;
					this.postView(true);
					this.postSession();
					if (this.macrosPending) this.showMacros();
				} else if (message.type === "showError") {
					void this.showError();
				} else if (message.type === "setSession" && this.uri) {
					this.sessionHost?.update(this.uri, readSessionPatch(message.patch));
				} else if (message.type === "suggest") {
					this.suggestions.open = message.open === true;
					if (this.suggestions.open) void this.refreshSuggestions();
				} else if (message.type === "choose") {
					this.choices.open = message.open === true;
					if (this.choices.open) void this.refreshChoices();
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
		session?: PanelSession,
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
				localResourceRoots: [
					vscode.Uri.joinPath(extensionUri, "media"),
					vscode.Uri.joinPath(extensionUri, "dist", "webview"),
				],
			},
		);
		return new ViewPanel(
			panel,
			output,
			capability,
			extensionUri,
			onDispose,
			output.kind === "renderer" ? session : undefined,
		);
	}

	reveal(): void {
		this.panel.reveal(undefined, true);
	}

	/** Shows `view` of the document `uri`, with the session the cook chose for it. */
	show(uri: string, view: PanelView, session: Session = {}): void {
		const contentChanged =
			uri !== this.uri || view.content !== this.view.content;
		const pausedChanged = view.paused !== this.view.paused;
		const sessionChanged =
			uri !== this.uri ||
			JSON.stringify(session) !== JSON.stringify(this.session);
		this.uri = uri;
		this.view = view;
		this.session = session;
		const name = path.basename(vscode.Uri.parse(uri).fsPath);
		this.panel.title = `${this.output.label}: ${name}`;
		if (!this.ready) return;
		if (contentChanged || pausedChanged) this.postView(contentChanged);
		if (sessionChanged) this.postSession();
		// A new content (an edit, another recipe, other settings, a new
		// session) may change what can be served when, and what can be chosen:
		// ask again while it is shown.
		if (contentChanged) {
			if (this.suggestions.open) void this.refreshSuggestions();
			if (this.choices.open) void this.refreshChoices();
		}
	}

	private postSession(): void {
		if (!this.sessionHost) return;
		void this.post({
			type: "session",
			session: this.session,
		});
	}

	private refreshSuggestions(): Promise<void> {
		const uri = this.uri;
		const host = this.sessionHost;
		if (!host || !uri || !this.planned) return Promise.resolve();
		return this.suggestions.ask(
			() => host.suggest(uri),
			(data) => void this.post({ type: "suggestions", data }),
			() => !this.disposed && uri === this.uri,
		);
	}

	private refreshChoices(): Promise<void> {
		const uri = this.uri;
		const host = this.sessionHost;
		if (!host || !uri) return Promise.resolve();
		return this.choices.ask(
			() => host.choices(uri),
			(data) => void this.post({ type: "choices", data }),
			() => !this.disposed && uri === this.uri,
		);
	}

	/** Scrolls the recipe to its nutrition panel, now or once the page is ready. */
	showMacros(): void {
		if (!this.ready) {
			this.macrosPending = true;
			return;
		}
		this.macrosPending = false;
		void this.post({ type: "showMacros" });
	}

	/** Sends the page a message, typed as it reads them. */
	private post(message: ToPage): Thenable<boolean> {
		return this.panel.webview.postMessage(message);
	}

	private postView(withContent: boolean): void {
		const { content, paused } = this.view;
		if (withContent && content) {
			void this.post({ type: "content", content });
		}
		void this.post({
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
