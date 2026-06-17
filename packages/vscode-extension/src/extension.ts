import * as path from 'path';
import { ExtensionContext } from 'vscode';
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

    client = new LanguageClient('gramLanguageServer', 'GRAM Language Server', serverOptions, clientOptions);
    client.start();
    context.subscriptions.push({ dispose: () => client.stop() });
}

export function deactivate(): Thenable<void> | undefined {
    return client?.stop();
}
