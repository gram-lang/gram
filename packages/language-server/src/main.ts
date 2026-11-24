import { commandLineAnswer } from "./transport";

// Replaced by the package version at build time (see build.cjs).
declare const __GRAM_LS_VERSION__: string;

// The binary's entry point. `--version` and `--help` are answered here,
// before `./server` is loaded: loading it opens the connection, which would
// sit waiting on stdin.
const answer = commandLineAnswer(process.argv.slice(2), __GRAM_LS_VERSION__);
if (answer !== undefined) process.stdout.write(answer);
else require("./server");
