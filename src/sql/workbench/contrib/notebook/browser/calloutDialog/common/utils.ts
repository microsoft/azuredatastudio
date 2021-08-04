/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as strings from 'vs/base/common/strings';

/**
 * Escape string to be used as label in markdown link
 * @param unescapedLabel label to escape
 */
export function escapeLabel(unescapedLabel: string): string {
	let firstEscape = strings.escape(unescapedLabel);
	return firstEscape.replace(/[[]]/g, function (match) {
		switch (match) {
			case '[': return '\[';
			case ']': return '\]';
			default: return match;
		}
	});
}

/**
 * Escape string to be used as url in markdown link
 * @param unescapedUrl url to escapes
 */
export function escapeUrl(unescapedUrl: string): string {
	let firstEscape = strings.escape(unescapedUrl);
	return firstEscape.replace(/[()]/g, function (match) {
		switch (match) {
			case '(': return '%28';
			case ')': return '%29';
			default: return match;
		}
	});
}

/**
 * Removes single or double quotes that enclose another string.
 * @param quotedText The text to unquote
 */
export function unquoteText(quotedText: string): string {
	let doubleQuotesRegex = /^[\"\'](.*)[\"\']$/;
	let matches = doubleQuotesRegex.exec(quotedText);
	if (matches && matches[1]) {
		quotedText = matches[1];
	}
	return quotedText;
}
