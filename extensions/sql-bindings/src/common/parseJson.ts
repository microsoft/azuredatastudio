/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// copied from vscode-azurefunctions extension

import * as jsonc from 'jsonc-parser';
import * as constants from './constants';

/**
 * Parses and returns JSON
 * Has extra logic to remove a BOM character if it exists and handle comments
 */
export function parseJson<T extends object>(data: string): T {
	if (data.charCodeAt(0) === 0xFEFF) {
		data = data.slice(1);
	}

	const errors: jsonc.ParseError[] = [];
	const result: T = <T>jsonc.parse(data, errors, { allowTrailingComma: true });
	if (errors.length > 0) {
		const [line, column]: [number, number] = getLineAndColumnFromOffset(data, errors[0].offset);
		throw new Error(constants.jsonParseError(jsonc.printParseErrorCode(errors[0].error), line, column));
	} else {
		return result;
	}
}

export function getLineAndColumnFromOffset(data: string, offset: number): [number, number] {
	const lines: string[] = data.split('\n');
	let charCount: number = 0;
	let lineCount: number = 0;
	let column: number = 0;
	for (const line of lines) {
		lineCount += 1;
		const lineLength: number = line.length + 1;
		charCount += lineLength;
		if (charCount >= offset) {
			column = offset - (charCount - lineLength);
			break;
		}
	}
	return [lineCount, column];
}
