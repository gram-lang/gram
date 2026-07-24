// Enforces that the number of `noExplicitAny` violations per package's
// `src/` never increases — including in packages where biome.json exempts
// the rule entirely (kitchen, analyzer) or only warns (everywhere else,
// which does NOT fail `bun run lint` / CI on its own: biome's default exit
// code only reflects errors, and the repo-wide default severity is "warn").
//
// Audit 2026-07-22, meta-finding (stress-test-v1 §3.2, confirmed still
// unresolved by the 2026-07-22 audit): "the rule being active isn't enough;
// it's the ratchet — a threshold that can only tighten — that's missing."
// `--only=lint/suspicious/noExplicitAny` on the biome CLI forces the rule on
// for this one invocation regardless of what biome.json says, which is what
// lets this script see the exempted packages' real counts without touching
// the committed config.
//
// Usage:
//   node scripts/any-ratchet.cjs          # check current counts against the baseline; exit 1 on regression
//   node scripts/any-ratchet.cjs --update # rewrite the baseline to the current counts (only after a deliberate reduction)

const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const baselinePath = path.join(__dirname, "any-ratchet-baseline.json");

const packages = fs
	.readdirSync(path.join(root, "packages"), { withFileTypes: true })
	.filter((entry) => entry.isDirectory())
	.map((entry) => entry.name)
	.filter((name) => fs.existsSync(path.join(root, "packages", name, "src")))
	.sort();

function countAny(pkg) {
	const srcDir = path.join(root, "packages", pkg, "src");
	let output;
	try {
		output = execFileSync(
			"bunx",
			[
				"biome",
				"check",
				"--reporter=json",
				"--only=lint/suspicious/noExplicitAny",
				srcDir,
			],
			{ cwd: root, encoding: "utf-8", stdio: ["ignore", "pipe", "ignore"] },
		);
	} catch (err) {
		// biome exits non-zero the moment it finds any diagnostic at all —
		// expected here, the JSON report is still on stdout.
		output = err.stdout;
	}
	return JSON.parse(output).diagnostics.length;
}

function main() {
	const update = process.argv.includes("--update");
	const current = {};
	for (const pkg of packages) current[pkg] = countAny(pkg);

	if (update) {
		fs.writeFileSync(baselinePath, `${JSON.stringify(current, null, "\t")}\n`);
		console.log("any-ratchet baseline updated:");
		for (const pkg of packages) console.log(`  ${pkg}: ${current[pkg]}`);
		return;
	}

	if (!fs.existsSync(baselinePath)) {
		console.error(
			`No baseline found at ${baselinePath}. Run with --update to create one.`,
		);
		process.exit(1);
	}
	const baseline = JSON.parse(fs.readFileSync(baselinePath, "utf-8"));

	let failed = false;
	for (const pkg of packages) {
		const count = current[pkg];
		const allowed = baseline[pkg] ?? 0;
		if (count > allowed) {
			failed = true;
			console.error(
				`✗ packages/${pkg}/src: ${count} \`any\` usages, baseline allows ${allowed} (+${count - allowed})`,
			);
		} else if (count < allowed) {
			console.log(
				`packages/${pkg}/src: ${count} \`any\` usages, ${allowed - count} below the baseline of ${allowed} — run \`node scripts/any-ratchet.cjs --update\` to tighten it`,
			);
		}
	}

	if (failed) {
		console.error(
			"\nThe number of `any` usages increased in at least one package. Fix them, or if the increase is truly deliberate, discuss it before updating the baseline.",
		);
		process.exit(1);
	}

	console.log("any-ratchet: no regressions.");
}

main();
