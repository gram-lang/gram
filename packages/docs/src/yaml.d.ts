// YAML files import as their parsed data (see `yamlData` in astro.config.mjs).
declare module "*.yaml" {
	const data: unknown;
	export default data;
}
