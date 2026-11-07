import chalk from "chalk";
import type { TextStyle } from "@gram-lang/renderer";

/**
 * The colors of the recipe in the terminal, for the renderer's `text` format.
 * The renderer only says which part is which (`TextStyle`); the terminal, and
 * chalk, are the CLI's.
 */
export const terminalTextStyle: TextStyle = {
	title: chalk.bold,
	heading: chalk.bold,
	dim: chalk.dim,
	ingredient: chalk.yellow,
	reference: chalk.magenta,
	cookware: chalk.cyan,
	timer: chalk.dim,
	action: chalk.cyan,
};
