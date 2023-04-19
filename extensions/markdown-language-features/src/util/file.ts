/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as URI from 'vscode-uri';

export const markdownFileExtensions = Object.freeze<string[]>([
	'md',
	'mkd',
	'mdwn',
	'mdown',
	'markdown',
	'markdn',
	'mdtxt',
	'mdtext',
	'workbook',
]);

export function isMarkdownFile(document: vscode.TextDocument) {
	return document.languageId === 'markdown';
}

export function looksLikeMarkdownPath(resolvedHrefPath: vscode.Uri) {
	return markdownFileExtensions.includes(URI.Utils.extname(resolvedHrefPath).toLowerCase().replace('.', ''));
}
