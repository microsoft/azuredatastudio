/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as editorCommon from 'vs/editor/common/editorCommon';

/**
 * Swaps the original and modified line changes
 * @param lineChanges The line changes to be reversed
 */
export function reverseLineChanges(lineChanges: editorCommon.ILineChange[]): editorCommon.ILineChange[] {
	let reversedLineChanges = lineChanges.map(linechange => {
		return {
			modifiedStartLineNumber: linechange.originalStartLineNumber,
			modifiedEndLineNumber: linechange.originalEndLineNumber,
			originalStartLineNumber: linechange.modifiedStartLineNumber,
			originalEndLineNumber: linechange.modifiedEndLineNumber,
			charChanges: (linechange.charChanges) ?
				linechange.charChanges.map(charchange => {
					return {
						originalStartColumn: charchange.modifiedStartColumn,
						originalEndColumn: charchange.modifiedEndColumn,
						modifiedStartColumn: charchange.originalStartColumn,
						modifiedEndColumn: charchange.originalEndColumn,
						modifiedStartLineNumber: charchange.originalStartLineNumber,
						modifiedEndLineNumber: charchange.originalEndLineNumber,
						originalStartLineNumber: charchange.modifiedStartLineNumber,
						originalEndLineNumber: charchange.modifiedEndLineNumber,
					};
				}) : undefined
		};
	});
	return reversedLineChanges;
}
