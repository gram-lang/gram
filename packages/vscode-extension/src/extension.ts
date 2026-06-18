import * as path from 'path';
import * as vscode from 'vscode';
import { ExtensionContext } from 'vscode';
import { PreviewPanel } from './preview';
import {
    LanguageClient,
    LanguageClientOptions,
    ServerOptions,
    TransportKind,
} from 'vscode-languageclient/node';

let client: LanguageClient;

export function activate(context: ExtensionContext) {
    const serverModule = context.asAbsolutePath(path.join('dist', 'server.js'));

    // To swap in the Rust binary when ready, change serverOptions to:
    // { run: { command: context.asAbsolutePath('bin/gram-ls'), args: ['--stdio'] }, ... }
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

    let latestHtml: string = '';

    client = new LanguageClient('gramLanguageServer', 'GRAM Language Server', serverOptions, clientOptions);
    client.start().then(() => {
        client.onNotification('gram/previewUpdated', (params: { uri: string; html: string }) => {
            latestHtml = params.html;
            if (PreviewPanel.currentPanel) {
                PreviewPanel.currentPanel.updateHTML(params.html);
            }
        });
    });

    context.subscriptions.push(
        client,
        vscode.commands.registerCommand('gram.showPreview', () => {
            PreviewPanel.createOrShow(context.extensionUri);
            if (latestHtml && PreviewPanel.currentPanel) {
                PreviewPanel.currentPanel.updateHTML(latestHtml);
            } else {
                // If we don't have HTML yet, we could show a loading state, but typing immediately triggers it.
                // Best is to trigger a fake edit to force an update, but saving state is usually enough.
            }
        }),
        vscode.commands.registerCommand('gram.showNutrition', () => {
            PreviewPanel.createOrShow(context.extensionUri);
            if (latestHtml && PreviewPanel.currentPanel) {
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
