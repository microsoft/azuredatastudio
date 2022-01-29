/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

export function removeLineBreaks(str: string): string {
	return str.replace(/(\r\n|\n|\r)/gm, '');
}
