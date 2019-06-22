/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as os from 'os';
import { IClipboardService } from 'sql/platform/clipboard/common/clipboardService';

export function HandleCopyRequest(clipboardService: IClipboardService, range: Slick.Range, getCellValue: (row, cell) => string): void {
	if (range) {
		let results = '';
		for (let i = range.fromRow; i <= range.toRow; i++) {
			for (let j = range.fromCell; j <= range.toCell; j++) {
				let value = getCellValue(i, j);
				if (j !== range.toCell) {
					value += '\t';
				}
				results += value;
			}

			if (i !== range.toRow) {
				results += os.EOL;
			}
		}
		clipboardService.writeText(results);
	}
}