/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { IClipboardService } from 'sql/platform/clipboard/common/clipboardService';
import { ITextResourcePropertiesService } from 'vs/editor/common/services/textResourceConfigurationService';
import { Schemas } from 'vs/base/common/network';
import { URI } from 'vs/base/common/uri';

export function handleCopyRequest(clipboardService: IClipboardService, textResourcePropertiesService: ITextResourcePropertiesService, range: Slick.Range, getCellValue: (row, cell) => string): void {
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
				results += textResourcePropertiesService.getEOL(URI.from({ scheme: Schemas.untitled }));
			}
		}
		clipboardService.writeText(results);
	}
}
