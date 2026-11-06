/**
 * A dictionary string with each `{name}` replaced from `values`
 * ("Serve at {time}" → "Serve at 20:00"). A name with no value is left as
 * written, so a missing value shows up instead of vanishing.
 */
export function fillTemplate(
	template: string,
	values: Readonly<Record<string, string>>,
): string {
	return template.replace(/\{(\w+)\}/g, (whole, key: string) =>
		Object.hasOwn(values, key) ? (values[key] as string) : whole,
	);
}
