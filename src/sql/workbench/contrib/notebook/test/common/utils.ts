/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

export const invalidRelativePathRegex = /^\.\.+(?=\.\.)/g;

export function replaceInvalidLinkPath(href: string): string {
	href = href.replace(invalidRelativePathRegex, '..\\');
	return href;
}
