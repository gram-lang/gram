import * as vscode from "vscode";
import { ViewPanel } from "./panel";
import type { OutputInfo, ViewUpdate, ViewsCapability } from "./protocol";
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

	constructor(
		private readonly capability: ViewsCapability,
		private readonly extensionUri: vscode.Uri,
		sendOpenViews: (uri: string, viewIds: string[]) => void,
	) {
		this.state = new ViewsState(sendOpenViews);
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
			);
			this.panels.set(outputId, panel);
		}
		panel.show(uri, this.state.viewOf(uri, outputId));
		this.sync();
		return panel;
	}

	/** Records a `gram/viewUpdated` and shows it if its panel is on that recipe. */
	update(update: ViewUpdate): void {
		const view = this.state.apply(update);
		if (update.uri !== this.uri) return;
		this.panels.get(update.outputId)?.show(update.uri, view);
	}

	private follow(uri: string): void {
		if (uri === this.uri) return;
		this.uri = uri;
		for (const [id, panel] of this.panels) {
			panel.show(uri, this.state.viewOf(uri, id));
		}
		this.sync();
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
