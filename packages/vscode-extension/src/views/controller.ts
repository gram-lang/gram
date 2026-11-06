import * as vscode from "vscode";
import { type PanelSession, ViewPanel } from "./panel";
import type {
	OutputInfo,
	ServeSuggestions,
	Session,
	SessionChoices,
	ViewUpdate,
	ViewsCapability,
} from "./protocol";
import { ViewsState } from "./state";

/**
 * The view panels of the extension: one per output, all following the active
 * `.gram` editor. It tells the language server what is open, and shows what
 * the server sends back.
 */
export class ViewsController implements vscode.Disposable {
	private readonly panels = new Map<string, ViewPanel>();
	private readonly state: ViewsState;
	private readonly disposables: vscode.Disposable[] = [];
	private uri: string | undefined;
	private readonly session: PanelSession;

	constructor(
		private readonly capability: ViewsCapability,
		private readonly extensionUri: vscode.Uri,
		sendOpenViews: (uri: string, viewIds: string[]) => void,
		server: {
			/** `gram/setSession`: the whole session of `uri`, which replaces the last. */
			sendSession(uri: string, session: Session): void;
			/** `gram/serveTimes`. */
			serveTimes(uri: string): Promise<ServeSuggestions | null>;
			/** `gram/sessionChoices`. */
			sessionChoices(uri: string): Promise<SessionChoices | null>;
		},
	) {
		this.state = new ViewsState(sendOpenViews);
		this.session = {
			update: (uri, patch) => {
				const session = this.state.updateSession(uri, patch);
				if (!session) return;
				server.sendSession(uri, session);
				// Every panel of the recipe shows the choice now; the views
				// follow from the server.
				if (uri === this.uri) this.showAll();
			},
			suggest: (uri) => server.serveTimes(uri),
			choices: (uri) => server.sessionChoices(uri),
		};
		this.uri = activeGramUri();
		this.disposables.push(
			vscode.window.onDidChangeActiveTextEditor((editor) => {
				// Focusing a panel leaves no active text editor: the panels keep
				// following the last recipe.
				if (editor?.document.languageId !== "gram") return;
				this.follow(editor.document.uri.toString());
			}),
			vscode.workspace.onDidCloseTextDocument((doc) => {
				const uri = doc.uri.toString();
				// The server forgot what was open for it: if it is reopened,
				// the open set is sent again.
				this.state.forget(uri);
			}),
			vscode.workspace.onDidOpenTextDocument((doc) => {
				if (doc.uri.toString() === this.uri) this.sync();
			}),
		);
	}

	/** The outputs the server can render, in its order. */
	get outputs(): readonly OutputInfo[] {
		return this.capability.outputs;
	}

	/** Opens (or reveals) the panel of `outputId` on the active recipe. */
	open(outputId: string): ViewPanel | undefined {
		const output = this.capability.outputs.find((o) => o.id === outputId);
		const uri = activeGramUri() ?? this.uri;
		if (!output || !uri) return undefined;
		this.uri = uri;
		let panel = this.panels.get(outputId);
		if (panel) {
			panel.reveal();
		} else {
			panel = ViewPanel.create(
				output,
				this.capability,
				this.extensionUri,
				() => {
					this.panels.delete(outputId);
					this.sync();
				},
				this.session,
			);
			this.panels.set(outputId, panel);
		}
		panel.show(
			uri,
			this.state.viewOf(uri, outputId),
			this.state.sessionOf(uri),
		);
		this.sync();
		return panel;
	}

	/** Records a `gram/viewUpdated` and shows it if its panel is on that recipe. */
	update(update: ViewUpdate): void {
		const view = this.state.apply(update);
		if (update.uri !== this.uri) return;
		this.panels
			.get(update.outputId)
			?.show(update.uri, view, this.state.sessionOf(update.uri));
	}

	private follow(uri: string): void {
		if (uri === this.uri) return;
		this.uri = uri;
		this.showAll();
		this.sync();
	}

	private showAll(): void {
		const uri = this.uri;
		if (!uri) return;
		const session = this.state.sessionOf(uri);
		for (const [id, panel] of this.panels) {
			panel.show(uri, this.state.viewOf(uri, id), session);
		}
	}

	private sync(): void {
		this.state.syncOpen(this.uri, this.panels.keys());
	}

	dispose(): void {
		for (const panel of [...this.panels.values()]) panel.dispose();
		while (this.disposables.length) this.disposables.pop()?.dispose();
	}
}

function activeGramUri(): string | undefined {
	const editor = vscode.window.activeTextEditor;
	return editor?.document.languageId === "gram"
		? editor.document.uri.toString()
		: undefined;
}
