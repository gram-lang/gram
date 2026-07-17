---
"@gram-lang/cli": minor
---

`@gram-lang/cli` now exports a library entry point (`main`/`types`/`exports`) alongside its `gram` binary: `runPipeline(filePath, options?)`, `PipelineResult`, `PipelineOptions`, `GramCLIError`, and `ExitCode`. This is the same file-reading + parse/compile/analyze orchestration the CLI's own commands use internally — previously undocumented and unexported despite being referenced by the docs.
