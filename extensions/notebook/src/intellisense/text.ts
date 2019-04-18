// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.

// This code is originally from @jupyterlab/packages/coreutils/src/text.ts
// Note: this code doesn't seem to do anything in the sqlops environment since the
// surr

// javascript stores text as utf16 and string indices use "code units",
// which stores high-codepoint characters as "surrogate pairs",
// which occupy two indices in the javascript string.
// We need to translate cursor_pos in the Jupyter protocol (in characters)
// to js offset (with surrogate pairs taking two spots).

const HAS_SURROGATES: boolean = '𝐚'.length > 1;

/**
 * Convert a javascript string index into a unicode character offset
 *
 * @param jsIdx - The javascript string index (counting surrogate pairs)
 *
 * @param text - The text in which the offset is calculated
 *
 * @returns The unicode character offset
 */
export function jsIndexToCharIndex(jsIdx: number, text: string): number {
	if (!HAS_SURROGATES) {
		// not using surrogates, nothing to do
		return jsIdx;
	}
	let charIdx = jsIdx;
	for (let i = 0; i + 1 < text.length && i < jsIdx; i++) {
		let charCode = text.charCodeAt(i);
		// check for surrogate pair
		if (charCode >= 0xD800 && charCode <= 0xDBFF) {
			let nextCharCode = text.charCodeAt(i + 1);
			if (nextCharCode >= 0xDC00 && nextCharCode <= 0xDFFF) {
				charIdx--;
				i++;
			}
		}
	}
	return charIdx;
}

/**
 * Get the diff between pure character count and JS-based count with 2 chars per surrogate pair.
 *
 * @param charIdx - The index in unicode characters
 *
 * @param text - The text in which the offset is calculated
 *
 * @returns The js-native index
 */
export function charCountToJsCountDiff(text: string): number {
	let diff = 0;
	if (!HAS_SURROGATES) {
		// not using surrogates, nothing to do
		return diff;
	}
	for (let i = 0; i + 1 < text.length; i++) {
		let charCode = text.charCodeAt(i);
		// check for surrogate pair
		if (charCode >= 0xD800 && charCode <= 0xDBFF) {
			let nextCharCode = text.charCodeAt(i + 1);
			if (nextCharCode >= 0xDC00 && nextCharCode <= 0xDFFF) {
				diff++;
				i++;
			}
		}
	}
	return diff;
}
