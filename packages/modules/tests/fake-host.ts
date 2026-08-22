// `createMemoryHost` (src/memory-host.ts) started life here as a
// test-only helper; it's now promoted to a real package export because the
// docs playground needs the exact same thing (an in-memory, filesystem-free
// `ModuleHost`). Kept as a re-export under its original name so this
// package's own tests don't need to change.
export { createMemoryHost as createFakeHost } from "../src/memory-host";
