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
import { provideReferences } from './features/references';
import { prepareName, provideRename } from './features/rename';
import { provideFormatting } from './features/formatting';
import { provideCodeActions } from './features/code-actions';
import { provideSemanticTokens, SEMANTIC_TOKEN_TYPES, SEMANTIC_TOKEN_MODIFIERS } from './features/semantic-tokens';
import { loadIngredientDB, IngredientDB, buildIngredientLookupSet } from './ingredient-loader';
import { join } from 'path';
import { existsSync } from 'fs';
import { fileURLToPath } from 'url';

const connection = createConnection(ProposedFeatures.all);
const documents = new TextDocuments(TextDocument);
const states = new Map<string, DocumentState>();

let ingredientDB: IngredientDB = {};
let ingredientLookupSet: Set<string> = new Set();
let workspaceFolders: string[] = [];

function loadDB(configPath?: string): void {
    if (configPath && configPath.trim()) {
        ingredientDB = loadIngredientDB(configPath.trim());
    } else {
        ingredientDB = {};
        for (const folder of workspaceFolders) {
            const auto = join(folder, '.gram', 'ingredients.yaml');
            if (existsSync(auto)) {
                ingredientDB = loadIngredientDB(auto);
                break;
            }
        }
    }
    // Rebuilt once here — all diagnostic checks are O(1) from this point
    ingredientLookupSet = buildIngredientLookupSet(ingredientDB);
}

connection.onInitialize((params: InitializeParams): InitializeResult => {
    workspaceFolders = params.workspaceFolders?.map(f => fileURLToPath(f.uri)) ?? [];
    return {
        capabilities: {
            textDocumentSync: TextDocumentSyncKind.Incremental,
            documentSymbolProvider: true,
            definitionProvider: true,
            hoverProvider: true,
            foldingRangeProvider: true,
            completionProvider: { triggerCharacters: ['&', '@'] },
            semanticTokensProvider: {
                full: true,
                legend: {
                    tokenTypes: SEMANTIC_TOKEN_TYPES as unknown as string[],
                    tokenModifiers: SEMANTIC_TOKEN_MODIFIERS,
                },
            },
            referencesProvider: true,
            renameProvider: { prepareProvider: true },
            documentFormattingProvider: true,
            codeActionProvider: true,
        },
    };
});

connection.onInitialized(async () => {
    try {
        const config = await connection.workspace.getConfiguration('gram');
        loadDB(config?.ingredientDatabase?.path);
    } catch {
        loadDB();
    }

    connection.onDidChangeConfiguration(async () => {
        try {
            const config = await connection.workspace.getConfiguration('gram');
            loadDB(config?.ingredientDatabase?.path);
        } catch {
            loadDB();
        }
        for (const [uri, state] of states) {
            connection.sendDiagnostics({ uri, diagnostics: provideDiagnostics(state, ingredientLookupSet) });
        }
    });
});

function refresh(uri: string, text: string) {
    const state = parseDocument(text);
    states.set(uri, state);
    connection.sendDiagnostics({ uri, diagnostics: provideDiagnostics(state, ingredientLookupSet) });
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
    return s ? provideHover(s, position, ingredientDB) : null;
});

connection.onFoldingRanges(({ textDocument: { uri } }) => {
    const s = states.get(uri);
    return s ? provideFoldingRanges(s) : [];
});

connection.onCompletion(({ textDocument: { uri }, position }) => {
    const s = states.get(uri);
    return s ? provideCompletions(s, position, ingredientDB) : [];
});

connection.onReferences(({ textDocument: { uri }, position }) => {
    const s = states.get(uri);
    if (!s) return [];
    return provideReferences(s, position).map(loc => ({ ...loc, uri }));
});

connection.onPrepareRename(({ textDocument: { uri }, position }) => {
    const s = states.get(uri);
    return s ? prepareName(s, position) : null;
});

connection.onRenameRequest(({ textDocument: { uri }, position, newName }) => {
    const s = states.get(uri);
    return s ? provideRename(s, position, newName, uri) : null;
});

connection.onDocumentFormatting(({ textDocument: { uri } }) => {
    const s = states.get(uri);
    return s ? provideFormatting(s) : [];
});

connection.onCodeAction(({ textDocument: { uri }, range, context }) => {
    const s = states.get(uri);
    return s ? provideCodeActions(s, range, context.diagnostics, uri, ingredientDB) : [];
});

connection.languages.semanticTokens.on(({ textDocument: { uri } }) => {
    const s = states.get(uri);
    return s ? provideSemanticTokens(s) : { data: [] };
});

documents.listen(connection);
connection.listen();
