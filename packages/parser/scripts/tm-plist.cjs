// Converts the JSON TextMate grammar into the XML property list that
// Sublime Text (and older TextMate hosts) read as a `.tmLanguage` file.
// Pure and deterministic: the same JSON always gives the same bytes, so the
// generated file only changes when the grammar does.

// Fixed so the generated grammar keeps its identity across rebuilds.
const UUID = '6F1B6C2E-3A57-4C8E-9D1F-6A2B9E0C4D73';

// XML 1.0 rejects these control characters, even escaped.
// biome-ignore lint/suspicious/noControlCharactersInRegex: the point is to find them
const FORBIDDEN = /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/;

function escapeXml(text) {
	if (FORBIDDEN.test(text)) {
		throw new Error(`tm-plist: control character not allowed in XML: ${JSON.stringify(text)}`);
	}
	return text
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;');
}

function value(node, depth) {
	const pad = '\t'.repeat(depth);
	if (typeof node === 'string') return `${pad}<string>${escapeXml(node)}</string>`;
	if (typeof node === 'boolean') return `${pad}<${node}/>`;
	if (typeof node === 'number') {
		return Number.isInteger(node) ? `${pad}<integer>${node}</integer>` : `${pad}<real>${node}</real>`;
	}
	if (Array.isArray(node)) {
		if (node.length === 0) return `${pad}<array/>`;
		return [`${pad}<array>`, ...node.map((item) => value(item, depth + 1)), `${pad}</array>`].join('\n');
	}
	if (node && typeof node === 'object') {
		const keys = Object.keys(node);
		if (keys.length === 0) return `${pad}<dict/>`;
		const lines = [`${pad}<dict>`];
		for (const key of keys) {
			lines.push(`${pad}\t<key>${escapeXml(key)}</key>`, value(node[key], depth + 1));
		}
		lines.push(`${pad}</dict>`);
		return lines.join('\n');
	}
	throw new Error(`tm-plist: unsupported value ${JSON.stringify(node)}`);
}

/**
 * @param {Record<string, unknown>} grammar the parsed `gram.tmLanguage.json`
 * @returns {string} the `.tmLanguage` plist, ending with a newline
 */
function tmJsonToPlist(grammar) {
	const { $schema: _schema, ...rest } = grammar;
	// Key order follows the JSON file; `fileTypes` lets Sublime Text pick the
	// syntax for `.gram` files on its own, `uuid` identifies it.
	const { name, scopeName, ...body } = rest;
	const plist = { name, scopeName, fileTypes: ['gram'], ...body, uuid: UUID };
	return [
		'<?xml version="1.0" encoding="UTF-8"?>',
		'<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">',
		'<!-- AUTO-GENERATED from gram.tmLanguage.json by scripts/build-tmlanguage-plist.cjs. DO NOT EDIT. -->',
		'<plist version="1.0">',
		value(plist, 0),
		'</plist>',
		'',
	].join('\n');
}

module.exports = { tmJsonToPlist, UUID };
