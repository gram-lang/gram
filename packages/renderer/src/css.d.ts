/** Stylesheets are bundled as text (`--loader:.css=text` in the build, native in Bun). */
declare module "*.css" {
	const css: string;
	export default css;
}
