import * as path from 'node:path';
import * as vscode from 'vscode';
import type { ExtensionContext } from 'vscode';
import { PreviewPanel } from './preview';
import {
    LanguageClient,
    type LanguageClientOptions,
    type ServerOptions,
    TransportKind,
} from 'vscode-languageclient/node';

let client: LanguageClient | undefined;

export async function activate(context: ExtensionContext): Promise<void> {
    const serverModule = context.asAbsolutePath(path.join('dist', 'server.cjs'));

    const serverOptions: ServerOptions = {
        run: { module: serverModule, transport: TransportKind.ipc },
        debug: {
            module: serverModule,
            transport: TransportKind.ipc,
            options: { execArgv: ['--nolazy', '--inspect=6009'] },
        },
    };

    const clientOptions: LanguageClientOptions = {
        documentSelector: [{ scheme: 'file', language: 'gram' }],
    };

    let latestHtml = '';

    client = new LanguageClient('gramLanguageServer', 'Gram Language Server', serverOptions, clientOptions);

    try {
        await client.start();

        client.onNotification('gram/previewUpdated', (params: { uri: string; html: string }) => {
            latestHtml = params.html;
            if (PreviewPanel.currentPanel) {
                PreviewPanel.currentPanel.updateHTML(params.html);
            }
        });
    } catch (error) {
        vscode.window.showErrorMessage(`Échec du démarrage du serveur de langage Gram: ${error instanceof Error ? error.message : String(error)}`);
    }

    context.subscriptions.push(
        vscode.commands.registerCommand('gram.showPreview', () => {
            PreviewPanel.createOrShow(context.extensionUri, latestHtml);
            if (PreviewPanel.currentPanel) {
                PreviewPanel.currentPanel.updateHTML(latestHtml);
            }
        }),
        vscode.commands.registerCommand('gram.showNutrition', () => {
            PreviewPanel.createOrShow(context.extensionUri, latestHtml);
            if (PreviewPanel.currentPanel) {
                PreviewPanel.currentPanel.updateHTML(latestHtml);
                PreviewPanel.currentPanel.showMacros();
            }
            vscode.window.showInformationMessage('Panneau des macros ouvert dans l\'Aperçu.');
        })
    );
}

export function deactivate(): Thenable<void> | undefined {
    return client?.stop();
}
