import * as vscode from "vscode";

export class PreviewPanel {
	public static readonly viewType = "gramPreview";
	public static currentPanel: PreviewPanel | undefined;

	private readonly _panel: vscode.WebviewPanel;
	private _disposables: vscode.Disposable[] = [];
	private _showMacros = false;
	private readonly _extensionUri: vscode.Uri;

	private constructor(
		panel: vscode.WebviewPanel,
		extensionUri: vscode.Uri,
		initialHtml: string,
	) {
		this._panel = panel;
		this._extensionUri = extensionUri;
		this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
		this._panel.webview.html = this._getHtmlForWebview(initialHtml);
	}

	public static createOrShow(extensionUri: vscode.Uri, initialHtml = ""): void {
		const column = vscode.window.activeTextEditor
			? vscode.ViewColumn.Beside
			: vscode.ViewColumn.One;

		if (PreviewPanel.currentPanel) {
			PreviewPanel.currentPanel._panel.reveal(column, true);
			return;
		}

		const panel = vscode.window.createWebviewPanel(
			PreviewPanel.viewType,
			"Live Preview",
			{ viewColumn: column, preserveFocus: true },
			{
				enableScripts: true,
				localResourceRoots: [vscode.Uri.joinPath(extensionUri, "media")],
			},
		);

		PreviewPanel.currentPanel = new PreviewPanel(
			panel,
			extensionUri,
			initialHtml,
		);
	}

	public updateHTML(html: string): void {
		this._panel.webview.postMessage({ command: "updateContent", html });
	}

	public showMacros(): void {
		this._showMacros = true;
		this._panel.webview.postMessage({ command: "showMacros" });
	}

	public dispose(): void {
		PreviewPanel.currentPanel = undefined;
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

		// Link to extracted CSS
		const cssPathOnDisk = vscode.Uri.joinPath(
			this._extensionUri,
			"media",
			"preview.css",
		);
		const cssUri = this._panel.webview.asWebviewUri(cssPathOnDisk);

		return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline' ${this._panel.webview.cspSource} https://fonts.googleapis.com https://unpkg.com https://cdn.jsdelivr.net; font-src https://fonts.gstatic.com https://unpkg.com https://cdn.jsdelivr.net; script-src 'nonce-${nonce}' https://unpkg.com;">
    <title>Gram Preview</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
    <link href="${cssUri}" rel="stylesheet">
    <script nonce="${nonce}" src="https://unpkg.com/@phosphor-icons/web"></script>
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
        }
    </style>
</head>
<body class="gram-preview ${this._showMacros ? "show-macros" : ""}">
    <div id="content">${initialHtml}</div>
    <script nonce="${nonce}">
        window.addEventListener('message', event => {
            const message = event.data;
            if (message.command === 'showMacros') {
                document.body.classList.add('show-macros');
                const panel = document.querySelector('.nutrition-panel');
                if (panel) {
                    panel.scrollIntoView({ behavior: 'smooth' });
                }
            } else if (message.command === 'updateContent') {
                const contentDiv = document.getElementById('content');
                if (contentDiv) {
                    contentDiv.innerHTML = message.html;
                }
            }
        });
    </script>
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
