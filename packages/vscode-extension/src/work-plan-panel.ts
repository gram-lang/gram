import * as path from "node:path";
import * as vscode from "vscode";

export class GanttPanel {
	public static readonly viewType = "gramGantt";
	public static currentPanel: GanttPanel | undefined;

	private readonly _panel: vscode.WebviewPanel;
	private _disposables: vscode.Disposable[] = [];
	private readonly _extensionUri: vscode.Uri;

	public uri: string;

	private constructor(
		panel: vscode.WebviewPanel,
		extensionUri: vscode.Uri,
		uri: string,
		initialHtml: string,
	) {
		this._panel = panel;
		this._extensionUri = extensionUri;
		this.uri = uri;
		this._updateTitle(uri);
		this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
		this._panel.webview.onDidReceiveMessage(
			async (message) => {
				if (message.command === "goToOffset") {
					await this._revealOffset(message.offset);
				}
			},
			null,
			this._disposables,
		);
		this._panel.webview.html = this._getHtmlForWebview(initialHtml);
	}

	private async _revealOffset(offset: number): Promise<void> {
		if (!this.uri) return;
		try {
			const docUri = vscode.Uri.parse(this.uri);
			const doc = await vscode.workspace.openTextDocument(docUri);
			const editor = await vscode.window.showTextDocument(
				doc,
				vscode.ViewColumn.One,
			);
			const pos = doc.positionAt(offset);
			editor.selection = new vscode.Selection(pos, pos);
			editor.revealRange(
				new vscode.Range(pos, pos),
				vscode.TextEditorRevealType.InCenter,
			);
		} catch (e) {
			console.error("Failed to reveal offset in editor:", e);
		}
	}

	public static createOrShow(
		extensionUri: vscode.Uri,
		uri: string,
		initialHtml = "",
	): void {
		const column = vscode.window.activeTextEditor
			? vscode.ViewColumn.Beside
			: vscode.ViewColumn.One;

		if (GanttPanel.currentPanel) {
			GanttPanel.currentPanel.setUriAndHTML(uri, initialHtml);
			GanttPanel.currentPanel._panel.reveal(column, true);
			return;
		}

		const panel = vscode.window.createWebviewPanel(
			GanttPanel.viewType,
			"Gantt Chart",
			{ viewColumn: column, preserveFocus: true },
			{
				enableScripts: true,
				localResourceRoots: [vscode.Uri.joinPath(extensionUri, "media")],
			},
		);

		GanttPanel.currentPanel = new GanttPanel(
			panel,
			extensionUri,
			uri,
			initialHtml,
		);
	}

	public setUriAndHTML(uri: string, html: string): void {
		this.uri = uri;
		this._updateTitle(uri);
		this.updateHTML(html);
	}

	private _updateTitle(uri: string): void {
		const filename = uri ? path.basename(vscode.Uri.parse(uri).fsPath) : "";
		this._panel.title = filename ? `Gantt: ${filename}` : "Gantt Chart";
	}

	public updateHTML(html: string): void {
		this._panel.webview.postMessage({ command: "updateContent", html });
	}

	public dispose(): void {
		GanttPanel.currentPanel = undefined;
		this._panel.dispose();
		while (this._disposables.length) {
			const disposable = this._disposables.pop();
			if (disposable) {
				disposable.dispose();
			}
		}
	}

	private _getHtmlForWebview(initialHtml: string): string {
		const nonce = getNonce();

		const previewCssUri = this._panel.webview.asWebviewUri(
			vscode.Uri.joinPath(this._extensionUri, "media", "preview.css"),
		);
		const ganttCssUri = this._panel.webview.asWebviewUri(
			vscode.Uri.joinPath(this._extensionUri, "media", "gantt.css"),
		);
		const scriptUri = this._panel.webview.asWebviewUri(
			vscode.Uri.joinPath(this._extensionUri, "media", "gantt-webview.js"),
		);

		return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline' ${this._panel.webview.cspSource} https://fonts.googleapis.com; font-src https://fonts.gstatic.com; script-src 'nonce-${nonce}';">
    <title>Gram Gantt Chart</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
    <link href="${previewCssUri}" rel="stylesheet">
    <link href="${ganttCssUri}" rel="stylesheet">
    <style nonce="${nonce}">
        :root, body.vscode-light, body.vscode-dark, body.vscode-high-contrast {
            /* Override gram.css colors to seamlessly blend with VSCode theme */
            --color-bg: var(--vscode-editor-background);
            --color-bg-subtle: var(--vscode-editorWidget-background);
            --color-bg-muted: var(--vscode-editorWidget-background);
            --color-surface: var(--vscode-editorWidget-background);
            --color-surface-raised: var(--vscode-editorWidget-background);
            --color-border: var(--vscode-widget-border);
            --color-border-strong: var(--vscode-focusBorder);
            --color-text-muted: var(--vscode-descriptionForeground);
            --color-text: var(--vscode-editor-foreground);
            --color-text-strong: var(--vscode-editor-foreground);

            --gram-font-sans: 'Inter', var(--vscode-font-family);
            --gram-font-mono: var(--vscode-editor-font-family);

            --gantt-accent: var(--vscode-charts-blue);
            --gantt-accent-soft: color-mix(in srgb, var(--vscode-charts-blue) 20%, transparent);
        }
        html, body {
            height: 100%;
            margin: 0;
            font-family: var(--gram-font-sans);
            color: var(--color-text-strong);
        }
    </style>
</head>
<body>
    <div id="content">${initialHtml}</div>
    <script nonce="${nonce}">
        const vscode = acquireVsCodeApi();
        document.addEventListener('click', event => {
            const btn = event.target.closest('.gram-goto-btn');
            if (btn) {
                const offset = btn.getAttribute('data-offset');
                vscode.postMessage({ command: 'goToOffset', offset: offset ? parseInt(offset, 10) : 0 });
            }
        });
    </script>
    <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
	}
}

function getNonce(): string {
	let text = "";
	const possible =
		"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
	for (let i = 0; i < 32; i++) {
		text += possible.charAt(Math.floor(Math.random() * possible.length));
	}
	return text;
}
