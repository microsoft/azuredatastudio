/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * Converts HTML characters inside the string to use entities instead. Makes the string safe from
 * being used e.g. in HTMLElement.innerHTML.
 */
export function escape(html: string): string {
	return html.replace(/[<|>|&|"]/g, function (match) {
		switch (match) {
			case '<': return '&lt;';
			case '>': return '&gt;';
			case '&': return '&amp;';
			case '"': return '&quot;';
			case '\'': return '&#39';
			default: return match;
		}
	});
}

// gotten from https://github.com/59naga/string-raw/blob/master/src/index.js
export function raw(callSite: any, ...substitutions: any[]): string {
	let template;
	try {
		template = Array.from(callSite.raw);
	} catch (e) {
		throw new TypeError('Cannot convert undefined or null to object');
	}

	return template.map((chunk, i) => {
		if (callSite.raw.length <= i) {
			return chunk;
		}
		return substitutions[i - 1] ? substitutions[i - 1] + chunk : chunk;
	}).join('');
}

/**
 * @deprecated ES6: use `String.startsWith`
 */
export function startsWith(haystack: string, needle: string): boolean {
	if (haystack.length < needle.length) {
		return false;
	}

	if (haystack === needle) {
		return true;
	}

	for (let i = 0; i < needle.length; i++) {
		if (haystack[i] !== needle[i]) {
			return false;
		}
	}

	return true;
}

/**
 * @deprecated ES6: use `String.endsWith`
 */
export function endsWith(haystack: string, needle: string): boolean {
	const diff = haystack.length - needle.length;
	if (diff > 0) {
		return haystack.indexOf(needle, diff) === diff;
	} else if (diff === 0) {
		return haystack === needle;
	} else {
		return false;
	}
}
