/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

export function isNumber(text: string): boolean {
	return !isNaN(parseInt(text)) && !isNaN(parseFloat(text));
}
