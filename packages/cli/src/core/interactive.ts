/**
 * Can we put a prompt in front of a human right now?
 *
 * Both ends have to be a terminal. Commands used to test `process.stdout.isTTY`
 * alone, which is true under `gram import … < /dev/null` or with stdin piped
 * from a script: the prompt renders and then blocks forever waiting on input
 * nobody can give. Checking stdin as well makes those runs take the
 * non-interactive branch, which is the branch that terminates.
 */
export function canPrompt(): boolean {
	return Boolean(process.stdin.isTTY && process.stdout.isTTY);
}
