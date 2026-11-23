// The language server ships a self-contained CommonJS bundle with no type
// declarations; `gram lsp` only imports it for its side effect (starting the
// server). Kept in an ambient file, without import/export: inside a module,
// TypeScript would read this as a module augmentation instead.
declare module "@gram-lang/language-server";
