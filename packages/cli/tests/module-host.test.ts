import { describe, it, expect } from "bun:test";
import { join } from "node:path";
import { createCliModuleHost } from "../src/core/module-host";

describe("createCliModuleHost", () => {
	const root = "/project";
	const entry = join(root, "recipe.gram");

	it("resolves a relative specifier against the importer's directory", () => {
		const host = createCliModuleHost(root);
		expect(host.resolve("./bases/pate.gram", entry)).toBe(
			join(root, "bases/pate.gram"),
		);
	});

	it("rejects a relative specifier that escapes the project root", () => {
		const host = createCliModuleHost(root);
		expect(() => host.resolve("../outside.gram", entry)).toThrow();
	});

	it("resolves a bare '@/' specifier against the project root", () => {
		const host = createCliModuleHost(root);
		const nested = join(root, "deep/nested/recipe.gram");
		expect(host.resolve("@/bases/pate.gram", nested)).toBe(
			join(root, "bases/pate.gram"),
		);
	});

	it("resolves an '@alias/' specifier against its declared paths: entry", () => {
		const host = createCliModuleHost(root, { bases: "./shared/bases" });
		expect(host.resolve("@bases/pate.gram", entry)).toBe(
			join(root, "shared/bases/pate.gram"),
		);
	});

	it("throws on an undeclared '@alias/' specifier", () => {
		const host = createCliModuleHost(root, { bases: "./shared/bases" });
		expect(() => host.resolve("@sauces/tomate.gram", entry)).toThrow(
			/"@sauces\/" is not declared/,
		);
	});

	it("throws on an undeclared alias when no paths: map was given at all", () => {
		const host = createCliModuleHost(root);
		expect(() => host.resolve("@bases/pate.gram", entry)).toThrow();
	});

	it("confines an '@alias/' specifier to the project root even if paths: points outside it", () => {
		const host = createCliModuleHost(root, { evil: "../../etc" });
		expect(() => host.resolve("@evil/passwd.gram", entry)).toThrow();
	});

	it("confines a bare '@/' specifier that tries to escape via '..'", () => {
		const host = createCliModuleHost(root);
		expect(() => host.resolve("@/../outside.gram", entry)).toThrow();
	});

	it("rejects a nested traversal that escapes the project root", () => {
		const host = createCliModuleHost(root);
		expect(() => host.resolve("./sub/../../outside.gram", entry)).toThrow(
			/outside the project root/,
		);
	});

	it("rejects a sibling folder whose name merely starts like the root", () => {
		const host = createCliModuleHost(root);
		expect(() => host.resolve("../project-other/a.gram", entry)).toThrow(
			/outside the project root/,
		);
	});

	it("accepts a legitimate folder whose name starts with '..'", () => {
		const host = createCliModuleHost(root);
		expect(host.resolve("./..notes/a.gram", entry)).toBe(
			join(root, "..notes/a.gram"),
		);
		expect(host.resolve("@/..notes/a.gram", join(root, "deep/r.gram"))).toBe(
			join(root, "..notes/a.gram"),
		);
	});
});
