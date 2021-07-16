/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

export const invalidRelativePathRegex = /^\.\.+(?=\.\.)/g;

export function replaceInvalidLinkPath(href: string): string {
	// Get first slash of link and use that create relative path format (..\) string
	// and then concatenate relative path format string to rest of href path after slash
	let slashIndex = href.indexOf('\\');
	href = '..\\'.repeat((slashIndex / 2)) + href.substring(slashIndex + 1);
	return href;
}
