# Security policy

Gram is maintained by one person, in the open. This page says how to report a security problem without exposing other users, and what I consider a security problem in the first place.

## Supported versions

I fix security issues in the latest published `1.x` minor release only (the `@gram-lang/*` npm packages, the `gram` CLI and the `gram-lang` VS Code extension all share one version number). A fix ships as a patch release of that minor; please upgrade to get it.

## Reporting a vulnerability

Please **do not open a public issue** for a security problem, on any of the mirrors.

Send an e-mail to **[security@gram-lang.org](mailto:security@gram-lang.org)** with:

- the version of Gram and the tool involved (CLI, language server, VS Code extension, playground, a library package);
- what an attacker could achieve, and under which conditions;
- a minimal reproduction: a `.gram` file, a command, a URL, whatever triggers it.

The main repository lives on a self-hosted Forgejo (`git.gram-lang.org`), which has no private security advisories yet, so e-mail is the only private channel for now.

What you can expect from me:

- an acknowledgement within **7 days** (I read this inbox myself, there is no team behind it);
- an assessment and, if confirmed, a fix plan within a few weeks, depending on severity;
- credit in the release notes and the changelog if you want it, once a fixed version is published.

Please give me a reasonable chance to ship a fix before disclosing the issue publicly.

## Threat model

Gram compiles recipe files that sit on your own disk. It does not run a hosted service and keeps no user data. The realistic risks are about **untrusted input** reaching one of these places:

- **HTML rendering** of a recipe you did not write (a shared `.gram` file, a recipe imported from the web): the renderer, the playground, the VS Code preview and `gram view`.
- **The local preview server** (`gram view --serve`), which a malicious web page open in the same browser could try to reach.
- **Module resolution** of `@use` directives, which a crafted recipe could use to read files outside its project.
- **Network access by `gram import`**, which fetches the URL it is given and could be pointed at a machine on your local network.

### Safeguards in place

- **HTML escaping**: every piece of recipe text the renderer writes into HTML (names, notes, comments, attributes) is escaped.
- **Local preview server**: `gram view --serve` listens on `127.0.0.1` only, rejects any request whose `Host` header is not `127.0.0.1:<port>` or `localhost:<port>` (a DNS rebinding defence), accepts only `GET` and `HEAD`, and sends a strict Content Security Policy on each route (no remote resources, no framing by other sites).
- **VS Code preview**: the webview runs under a Content Security Policy with `default-src 'none'` and a per-load nonce on its only script.
- **`@use` confinement**: a module path must be relative (`./`, `../`) or a project path (`@/`, `@alias/`) and must end in `.gram`; absolute paths, URLs and paths that resolve outside the project folder (the one holding `.gram/`) are refused, and so are backslashes and null bytes in a path.
- **`gram import`**: before each request, the host name is resolved and refused if it points to a private, loopback or link-local address; redirects are followed by hand and every hop is checked again, so a public URL cannot redirect, or re-resolve, to your local network.
- **AI provider keys**: read from environment variables or from a `.env` file at the project root, which `gram config` writes with owner-only permissions (`0600`) and which `gram init` adds to `.gitignore`. A key is never written to `.gram/config.yaml`, and it is only ever sent to the provider it belongs to.

### Out of scope

- **Symbolic links** you create yourself inside a project: `@use` confinement checks the path as written, not where a symlink points. A link in your own project is your own choice.
- **The content of AI-imported recipes**: `gram import` asks a language model to turn a web page or a video into a `.gram` file. The result can be wrong, incomplete or misleading (quantities, temperatures, allergens); read it before you cook from it. This is a quality issue, not a vulnerability.
- Problems that need an attacker who can already write to your project files or run commands on your machine.
