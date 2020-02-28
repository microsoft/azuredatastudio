/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

export function tryMatchCellMagic(input: string): string {
	if (!input) {
		return input;
	}
	let firstLine = input.trimLeft();
	let magicRegex = /^%%(\w+)/g;
	let match = magicRegex.exec(firstLine);
	let magicName = match && match[1];
	return magicName;
}
