import {
    createConnection,
    ProposedFeatures,
    TextDocuments,
    InitializeParams,
    InitializeResult,
    TextDocumentSyncKind,
} from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { parseDocument, DocumentState } from './document-state';
import { provideDocumentSymbols } from './features/document-symbols';
import { provideDiagnostics } from './features/diagnostics';
import { provideDefinition } from './features/go-to-definition';
import { provideHover } from './features/hover';
import { provideFoldingRanges } from './features/folding-ranges';
import { provideCompletions } from './features/completions';

const connection = createConnection(ProposedFeatures.all);
const documents = new TextDocuments(TextDocument);
const states = new Map<string, DocumentState>();

connection.onInitialize((_params: InitializeParams): InitializeResult => ({
    capabilities: {
        textDocumentSync: TextDocumentSyncKind.Incremental,
        documentSymbolProvider: true,
        definitionProvider: true,
        hoverProvider: true,
        foldingRangeProvider: true,
        completionProvider: { triggerCharacters: ['&'] },
    },
}));

function refresh(uri: string, text: string) {
    const state = parseDocument(text);
    states.set(uri, state);
    connection.sendDiagnostics({ uri, diagnostics: provideDiagnostics(state) });
}

documents.onDidOpen(e => refresh(e.document.uri, e.document.getText()));
documents.onDidChangeContent(e => refresh(e.document.uri, e.document.getText()));
documents.onDidClose(e => {
    states.delete(e.document.uri);
    connection.sendDiagnostics({ uri: e.document.uri, diagnostics: [] });
});

connection.onDocumentSymbol(({ textDocument: { uri } }) => {
    const s = states.get(uri);
    return s ? provideDocumentSymbols(s) : [];
});

connection.onDefinition(({ textDocument: { uri }, position }) => {
    const s = states.get(uri);
    if (!s) return null;
    const loc = provideDefinition(s, position);
    if (!loc) return null;
    return { ...loc, uri };
});

connection.onHover(({ textDocument: { uri }, position }) => {
    const s = states.get(uri);
    return s ? provideHover(s, position) : null;
});

connection.onFoldingRanges(({ textDocument: { uri } }) => {
    const s = states.get(uri);
    return s ? provideFoldingRanges(s) : [];
});

connection.onCompletion(({ textDocument: { uri }, position }) => {
    const s = states.get(uri);
    return s ? provideCompletions(s, position) : [];
});

documents.listen(connection);
connection.listen();
