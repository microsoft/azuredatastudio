/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';

const knownSchemes = ['http:', 'https:', 'file:', 'mailto:', 'data:', 'vscode-resource:'];

export function getUriForLinkWithKnownExternalScheme(
	link: string,
): vscode.Uri | undefined {
	if (knownSchemes.some(knownScheme => link.toLowerCase().startsWith(knownScheme))) {
		return vscode.Uri.parse(link);
	}

	return undefined;
}